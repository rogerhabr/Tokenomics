"""Paper venue + account. No real funds, no network -- by construction.

Timing (no look-ahead): quotes chosen after observing block t are posted for
block t+1 and matched ONLY against block t+1's trades. `PaperVenue.match` takes
the quotes and the *next* block explicitly so the call site cannot get this wrong.

Fill model (assumptions, explicit):
  * Post-only: a bid >= next best ask (or ask <= next best bid) is REJECTED.
  * Price improvement (inside the spread): we are first in line, so we fill
    min(q, aggressive volume on that side) -- conservative only in that we
    assume aggressors sized against the visible book still trade with us.
  * At a book level: pro-rata with the resting size, q * min(1, printed / level_size).
  * Behind the deepest printed level: no fill.
  * We have no market impact on the simulator (documented limitation).
Accounting: average-cost inventory, realized + unrealized PnL marked to mid,
maker fee on fills, peak equity/drawdown, holding time.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from jev_trader.types import AccountState, BlockData, Level


@dataclass(frozen=True)
class Fill:
    side: str  # "buy" | "sell" (ours)
    price: float
    size: float


@dataclass
class MatchResult:
    fills: list[Fill] = field(default_factory=list)
    rejected: int = 0
    sent: int = 0


def _level_fill(price: float, q: float, levels: tuple[Level, ...], prints: dict[float, float], aggr_total: float,
                better_than_touch: bool) -> float:
    if q <= 0:
        return 0.0
    if better_than_touch:
        return min(q, aggr_total)
    for lv in levels:
        if abs(lv.price - price) < 1e-9:
            c = prints.get(lv.price, 0.0)
            return q * min(1.0, c / lv.size) if lv.size > 0 else 0.0
    return 0.0


class PaperVenue:
    def __init__(self, maker_bps: float = 0.0, taker_bps: float = 3.5) -> None:
        self.maker_bps, self.taker_bps = maker_bps, taker_bps

    def match(self, bid: float | None, bid_size: float, ask: float | None, ask_size: float,
              nxt: BlockData) -> MatchResult:
        r = MatchResult()
        if not nxt.bids or not nxt.asks:
            r.sent = (bid is not None) + (ask is not None)
            r.rejected = r.sent  # venue unusable -> treated as rejects
            return r
        buy_prints: dict[float, float] = {}  # aggressor buys hit asks
        sell_prints: dict[float, float] = {}
        for t in nxt.trades:
            d = buy_prints if t.aggressor == "buy" else sell_prints
            d[t.price] = d.get(t.price, 0.0) + t.size
        if bid is not None and bid_size > 0:
            r.sent += 1
            if bid >= nxt.asks[0].price - 1e-12:
                r.rejected += 1
            else:
                q = _level_fill(bid, bid_size, nxt.bids, sell_prints, sum(sell_prints.values()),
                                bid > nxt.bids[0].price + 1e-12)
                if q > 0:
                    r.fills.append(Fill("buy", bid, round(q, 6)))
        if ask is not None and ask_size > 0:
            r.sent += 1
            if ask <= nxt.bids[0].price + 1e-12:
                r.rejected += 1
            else:
                q = _level_fill(ask, ask_size, nxt.asks, buy_prints, sum(buy_prints.values()),
                                ask < nxt.asks[0].price - 1e-12)
                if q > 0:
                    r.fills.append(Fill("sell", ask, round(q, 6)))
        return r


class PaperAccount:
    """Tracks our book. The risk engine reads THIS, never a model's opinion of it."""

    def __init__(self, capital: float, maker_bps: float = 0.0, taker_bps: float = 3.5, flat_dust: float = 1.0) -> None:
        self.capital = capital
        self.flat_dust = flat_dust  # |inventory| at or below this counts as flat for holding time
        self.maker_bps, self.taker_bps = maker_bps, taker_bps
        self.inventory = 0.0
        self.avg_entry = 0.0
        self.realized = 0.0
        self.fees = 0.0
        self.peak_equity = capital
        self.hold_blocks = 0
        self.day_start_equity = capital
        self.last_mid = 0.0

    def apply(self, fill: Fill, taker: bool = False) -> None:
        sgn = 1.0 if fill.side == "buy" else -1.0
        fee = fill.price * fill.size * (self.taker_bps if taker else self.maker_bps) * 1e-4
        self.fees += fee
        self.realized -= fee
        q0, dq = self.inventory, sgn * fill.size
        if q0 == 0 or (q0 > 0) == (dq > 0):  # opening / adding
            tot = q0 + dq
            self.avg_entry = (self.avg_entry * abs(q0) + fill.price * abs(dq)) / abs(tot)
            self.inventory = tot
            return
        closed = min(abs(q0), abs(dq))  # reducing (maybe flipping)
        self.realized += closed * (fill.price - self.avg_entry) * (1.0 if q0 > 0 else -1.0)
        self.inventory = q0 + dq
        if abs(self.inventory) < 1e-12:
            self.inventory, self.avg_entry = 0.0, 0.0
        elif (self.inventory > 0) != (q0 > 0):  # flipped through zero
            self.avg_entry = fill.price

    def mark(self, mid: float) -> None:
        self.last_mid = mid
        # holding time = blocks since |inventory| was last <= dust (fractional
        # pro-rata fills almost never land exactly on zero)
        self.hold_blocks = 0 if abs(self.inventory) <= self.flat_dust else self.hold_blocks + 1
        self.peak_equity = max(self.peak_equity, self.equity)

    def flatten(self, best_bid: float, best_ask: float) -> Fill | None:
        """Kill-switch exit: cross the spread as taker (pays taker_bps)."""
        if self.inventory == 0:
            return None
        f = Fill("sell", best_bid, abs(self.inventory)) if self.inventory > 0 else Fill("buy", best_ask, abs(self.inventory))
        self.apply(f, taker=True)
        return f

    def new_day(self) -> None:
        self.day_start_equity = self.equity

    @property
    def unrealized(self) -> float:
        return self.inventory * (self.last_mid - self.avg_entry) if self.inventory else 0.0

    @property
    def equity(self) -> float:
        return self.capital + self.realized + self.unrealized

    @property
    def drawdown_frac(self) -> float:
        return 1.0 - self.equity / self.peak_equity if self.peak_equity > 0 else 0.0

    @property
    def daily_loss_frac(self) -> float:
        return max(0.0, (self.day_start_equity - self.equity) / self.capital)

    def state(self, queue_bid: float = 0.0, queue_ask: float = 0.0) -> AccountState:
        return AccountState(self.inventory, self.avg_entry, self.realized, self.peak_equity, self.equity,
                            self.hold_blocks, queue_bid, queue_ask)

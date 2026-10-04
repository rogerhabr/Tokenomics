"""Stage 1 -- State engine.

Turns the observable block stream + our account/health into a compact, numeric
snapshot for Jev. All arithmetic lives here; Jev never gets asked to do math.

Guarantees (each one has a test):
  1. No future data. The engine only ever sees blocks via `update()`, which
     rejects out-of-order/duplicate blocks; `snapshot(now_ms)` rejects a clock
     earlier than the last block (that block would be "from the future").
  2. Prefix invariance. The snapshot at block t is identical whether or not
     blocks after t exist anywhere -- tested by mutating the future.
  3. Bounded size. Fixed key set, fixed rounding; estimated tokens < budget.
  4. Never crashes on bad data. Crossed/empty books set `data_ok=0` and keep the
     last good mid; the risk engine (stage 4) treats data_ok=0 as a veto.

Units: prices in quote currency; returns/spreads/vols/gaps in basis points;
time windows defined in minutes and converted using `block_ms`.
"""

from __future__ import annotations

import json
import math
from collections import deque
from dataclasses import dataclass

from jev_trader.types import AccountState, BlockData, HealthState


class LookAheadError(RuntimeError):
    """Raised when an input would let future information into a snapshot."""


@dataclass(frozen=True)
class StateConfig:
    block_ms: int = 300
    flow_window_min: float = 1.0
    vol_micro_min: float = 0.5
    vol_short_min: float = 5.0
    vol_medium_min: float = 30.0
    vol_baseline_hours: float = 24.0  # EWMA half-life for the "normal" vol level
    depth_levels: int = 3
    token_budget: int = 400

    def blocks(self, minutes: float) -> int:
        return max(1, round(minutes * 60_000 / self.block_ms))


# Ordered field list + decimals. Order is fixed so prompts are stable/cacheable.
FIELDS: tuple[tuple[str, int], ...] = (
    ("mid", 6),
    ("microprice_bps", 2),  # microprice vs mid
    ("ret_1m_bps", 2),
    ("ret_5m_bps", 2),
    ("ret_30m_bps", 2),
    ("spread_bps", 2),
    ("bid_depth_l1_3", 0),
    ("ask_depth_l1_3", 0),
    ("imbalance", 3),  # (bid-ask)/(bid+ask) over top levels, -1..1
    ("depth_vs_norm", 2),  # top depth / its EWMA baseline
    ("aggr_buy_vol_1m", 0),
    ("aggr_sell_vol_1m", 0),
    ("aggr_buy_ratio_1m", 3),
    ("trades_per_block", 2),
    ("cancels_per_block", 2),
    ("rv_30s_bps", 2),
    ("rv_5m_bps", 2),
    ("rv_30m_bps", 2),
    ("rv_ratio_24h", 2),  # short vol / long-run baseline at the same horizon
    ("ref_gap_bps", 2),  # our mid vs reference venue
    ("funding_bps", 3),
    ("inventory", 2),
    ("upnl", 4),
    ("drawdown_pct", 3),
    ("hold_blocks", 0),
    ("queue_ahead_bid", 0),
    ("queue_ahead_ask", 0),
    ("fill_ratio", 3),
    ("reject_ratio", 3),
    ("slippage_bps", 2),
    ("lat_p50_ms", 0),
    ("lat_max_ms", 0),
    ("data_age_ms", 0),
    ("data_ok", 0),
)


@dataclass(frozen=True)
class Snapshot:
    block: int
    ts_ms: int
    fields: dict[str, float]

    def to_json(self) -> str:
        return json.dumps(self.fields, separators=(",", ":"))

    def est_tokens(self) -> int:
        return estimate_tokens(self.to_json())


MAX_CHARS_PER_TOKEN_FLOOR = 2.0
"""Pessimistic floor: no mainstream BPE tokenizer averages < 2 chars/token on
numeric JSON. Used for a tokenizer-independent hard cap (chars <= 2 * budget)."""


def estimate_tokens(text: str) -> int:
    """Conservative token estimate for dense numeric JSON.

    Digits/punctuation tokenize poorly (~2-3 chars/token). We assume 2.5, which
    over-counts English and under-promises on budget. This is a heuristic, NOT
    Jev's tokenizer -- replace with `response.usage.input_tokens` once a real key
    is available (stage 2 logs it per call).
    """
    return math.ceil(len(text) / 2.5)


class _RollingSum:
    __slots__ = ("q", "total")

    def __init__(self, n: int) -> None:
        self.q: deque[float] = deque(maxlen=n)
        self.total = 0.0

    def push(self, x: float) -> None:
        if len(self.q) == self.q.maxlen:
            self.total -= self.q[0]
        self.q.append(x)
        self.total += x

    def __len__(self) -> int:
        return len(self.q)


class StateEngine:
    def __init__(self, cfg: StateConfig | None = None) -> None:
        self.cfg = c = cfg or StateConfig()
        self.last_block: int | None = None
        self.last_ts_ms: int | None = None
        self.last_good: BlockData | None = None
        self.data_ok = False
        n30 = c.blocks(30)
        self.mids: deque[float] = deque(maxlen=n30 + 1)
        self.r2_micro = _RollingSum(c.blocks(c.vol_micro_min))
        self.r2_short = _RollingSum(c.blocks(c.vol_short_min))
        self.r2_medium = _RollingSum(c.blocks(c.vol_medium_min))
        nflow = c.blocks(c.flow_window_min)
        self.buy_vol = _RollingSum(nflow)
        self.sell_vol = _RollingSum(nflow)
        self.n_trades = _RollingSum(nflow)
        self.n_cancels = _RollingSum(nflow)
        # EWMA baselines (per-block quantities) -- O(1) memory instead of 24h buffers
        hl = c.blocks(c.vol_baseline_hours * 60)
        self._ewma_a = 1.0 - 0.5 ** (1.0 / hl)
        self.r2_ewma: float | None = None
        self.depth_ewma: float | None = None

    # ---- ingest -----------------------------------------------------------
    def update(self, b: BlockData) -> None:
        if self.last_block is not None and b.block <= self.last_block:
            raise LookAheadError(f"block {b.block} not after {self.last_block} (out-of-order or replay)")
        if self.last_ts_ms is not None and b.ts_ms < self.last_ts_ms:
            raise LookAheadError(f"block ts {b.ts_ms} earlier than previous {self.last_ts_ms}")
        self.last_block, self.last_ts_ms = b.block, b.ts_ms

        # flow is observable even if the book is broken
        bv = sum(t.size for t in b.trades if t.aggressor == "buy")
        sv = sum(t.size for t in b.trades if t.aggressor == "sell")
        self.buy_vol.push(bv)
        self.sell_vol.push(sv)
        self.n_trades.push(len(b.trades))
        self.n_cancels.push(b.cancels)

        self.data_ok = _book_ok(b)
        if not self.data_ok:
            return  # keep last good book/mid; do not poison returns/vol
        mid = (b.bids[0].price + b.asks[0].price) / 2
        if self.mids:
            r = math.log(mid / self.mids[-1]) * 1e4
            r2 = r * r
            self.r2_micro.push(r2)
            self.r2_short.push(r2)
            self.r2_medium.push(r2)
            a = self._ewma_a
            self.r2_ewma = r2 if self.r2_ewma is None else (1 - a) * self.r2_ewma + a * r2
        self.mids.append(mid)
        depth = _depth(b, self.cfg.depth_levels)
        a = self._ewma_a
        self.depth_ewma = depth if self.depth_ewma is None else (1 - a) * self.depth_ewma + a * depth
        self.last_good = b

    # ---- emit -------------------------------------------------------------
    def snapshot(self, now_ms: int, account: AccountState | None = None, health: HealthState | None = None) -> Snapshot:
        if self.last_block is None or self.last_ts_ms is None:
            raise LookAheadError("no data ingested yet")
        if now_ms < self.last_ts_ms:
            raise LookAheadError(f"now_ms {now_ms} precedes last block ts {self.last_ts_ms}: block is from the future")
        acct = account or AccountState()
        hl = health or HealthState()
        c = self.cfg
        f: dict[str, float] = {}
        b = self.last_good
        if b is not None:
            bb, ba = b.bids[0], b.asks[0]
            mid = (bb.price + ba.price) / 2
            micro = (bb.price * ba.size + ba.price * bb.size) / (bb.size + ba.size)
            bd = sum(lv.size for lv in b.bids[: c.depth_levels])
            ad = sum(lv.size for lv in b.asks[: c.depth_levels])
            f["mid"] = mid
            f["microprice_bps"] = (micro / mid - 1) * 1e4
            f["spread_bps"] = (ba.price - bb.price) / mid * 1e4
            f["bid_depth_l1_3"] = bd
            f["ask_depth_l1_3"] = ad
            f["imbalance"] = (bd - ad) / (bd + ad) if bd + ad > 0 else 0.0
            f["depth_vs_norm"] = (bd + ad) / self.depth_ewma if self.depth_ewma else 1.0
            f["ref_gap_bps"] = (mid / b.ref_price - 1) * 1e4 if b.ref_price else 0.0
            f["funding_bps"] = b.funding_bps or 0.0
        else:
            mid = 0.0
            for k in ("mid", "microprice_bps", "spread_bps", "bid_depth_l1_3", "ask_depth_l1_3",
                      "imbalance", "ref_gap_bps", "funding_bps"):
                f[k] = 0.0
            f["depth_vs_norm"] = 1.0

        for key, minutes in (("ret_1m_bps", 1), ("ret_5m_bps", 5), ("ret_30m_bps", 30)):
            n = c.blocks(minutes)
            # partial window early on: use oldest available (documented, not hidden)
            ref = self.mids[-1 - n] if len(self.mids) > n else (self.mids[0] if self.mids else 0.0)
            f[key] = math.log(self.mids[-1] / ref) * 1e4 if self.mids and ref > 0 else 0.0

        tv = self.buy_vol.total + self.sell_vol.total
        f["aggr_buy_vol_1m"] = self.buy_vol.total
        f["aggr_sell_vol_1m"] = self.sell_vol.total
        f["aggr_buy_ratio_1m"] = self.buy_vol.total / tv if tv > 0 else 0.5
        f["trades_per_block"] = self.n_trades.total / max(1, len(self.n_trades))
        f["cancels_per_block"] = self.n_cancels.total / max(1, len(self.n_cancels))

        rv5 = math.sqrt(max(0.0, self.r2_short.total))
        f["rv_30s_bps"] = math.sqrt(max(0.0, self.r2_micro.total))
        f["rv_5m_bps"] = rv5
        f["rv_30m_bps"] = math.sqrt(max(0.0, self.r2_medium.total))
        if self.r2_ewma and len(self.r2_short) > 0:
            baseline = math.sqrt(self.r2_ewma * len(self.r2_short))
            f["rv_ratio_24h"] = rv5 / baseline if baseline > 0 else 1.0
        else:
            f["rv_ratio_24h"] = 1.0

        f["inventory"] = acct.inventory
        f["upnl"] = acct.inventory * (mid - acct.avg_entry) if acct.inventory and mid else 0.0
        f["drawdown_pct"] = (1 - acct.equity / acct.peak_equity) * 100 if acct.peak_equity > 0 else 0.0
        f["hold_blocks"] = acct.hold_blocks
        f["queue_ahead_bid"] = acct.queue_ahead_bid
        f["queue_ahead_ask"] = acct.queue_ahead_ask

        f["fill_ratio"] = hl.orders_filled / hl.orders_sent if hl.orders_sent else 0.0
        f["reject_ratio"] = hl.orders_rejected / hl.orders_sent if hl.orders_sent else 0.0
        f["slippage_bps"] = hl.slippage_bps
        lat = sorted(hl.last_latencies_ms[-10:])
        f["lat_p50_ms"] = lat[len(lat) // 2] if lat else 0.0
        f["lat_max_ms"] = lat[-1] if lat else 0.0
        f["data_age_ms"] = now_ms - self.last_ts_ms
        f["data_ok"] = 1.0 if self.data_ok else 0.0

        out: dict[str, float] = {}
        for key, dp in FIELDS:
            v = f[key] if math.isfinite(f[key]) else 0.0
            out[key] = round(v, dp) if dp else float(round(v))
        if any(not math.isfinite(v) for v in f.values()):
            out["data_ok"] = 0.0
        return Snapshot(block=self.last_block, ts_ms=self.last_ts_ms, fields=out)


def _book_ok(b: BlockData) -> bool:
    if not b.bids or not b.asks:
        return False
    bb, ba = b.bids[0], b.asks[0]
    vals = (bb.price, ba.price, bb.size, ba.size)
    if not all(math.isfinite(v) and v > 0 for v in vals):
        return False
    return bb.price < ba.price


def _depth(b: BlockData, n: int) -> float:
    return sum(lv.size for lv in b.bids[:n]) + sum(lv.size for lv in b.asks[:n])

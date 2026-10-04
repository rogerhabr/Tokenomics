"""Stage 4 -- Risk engine. Final say, always. Checked before every order.

Independence rule: every input here is measured by code (paper account, clock,
counters), never taken from a model's answer. The risk engine does not import
the decision layer.

Verdict severity (highest wins):
  ALLOW < VETO (drop the offending order) < REDUCE_ONLY (only orders that shrink
  |inventory|) < HALT (pull everything this block) < KILL (latched: flatten as
  taker, stop until `reset()` by a human).

Limits come in two kinds (see `jev_trader/sim/limits.py` for derivation):
  * guard limits (data age, decision latency, API-error streak, reject ratio,
    order size): derived from models of normal operation so a false trip has
    probability <= 1e-9 per block ("literal 6σ");
  * budget limits (max position, daily loss, drawdown, leverage, hold time):
    from the operator's capital and risk appetite (`RiskBudget`). Required --
    there is no default for real money.
"""

from __future__ import annotations

import json
import math
from collections import deque
from dataclasses import asdict, dataclass, field
from enum import IntEnum
from pathlib import Path


class Severity(IntEnum):
    ALLOW = 0
    VETO = 1
    REDUCE_ONLY = 2
    HALT = 3
    KILL = 4


@dataclass(frozen=True)
class RiskLimits:
    # budget limits
    max_position: float
    max_daily_loss_frac: float
    max_drawdown_frac: float
    max_leverage: float
    max_hold_blocks: int
    # guard limits
    max_order_size: float
    max_data_age_ms: float
    max_latency_p50_ms: float  # median of the last `latency_window` decisions
    latency_window: int
    max_api_error_streak: int
    max_reject_ratio: float  # over the last `reject_window` orders
    reject_window: int

    def __post_init__(self) -> None:
        for k, v in asdict(self).items():
            if not isinstance(v, (int, float)) or not math.isfinite(v) or v <= 0:
                raise ValueError(f"risk limit {k}={v!r} must be a positive finite number")
        if not self.max_daily_loss_frac < 1 or not self.max_drawdown_frac < 1 or not self.max_reject_ratio <= 1:
            raise ValueError("fractions must be < 1")

    @classmethod
    def load(cls, path: str | Path) -> RiskLimits:
        raw = json.loads(Path(path).read_text())
        raw.pop("_meta", None)
        return cls(**raw)  # unknown or missing keys raise TypeError: no silent defaults


@dataclass(frozen=True)
class OrderIntent:
    side: str  # "buy" | "sell"
    price: float
    size: float


@dataclass(frozen=True)
class AccountView:
    """What the risk engine reads -- produced by PaperAccount (or a live venue reconciler)."""
    inventory: float
    equity: float
    capital: float
    daily_loss_frac: float
    drawdown_frac: float
    hold_blocks: int
    mid: float


@dataclass
class Verdict:
    severity: Severity
    reasons: list[str] = field(default_factory=list)
    allowed: list[OrderIntent] = field(default_factory=list)

    @property
    def kill(self) -> bool:
        return self.severity is Severity.KILL


class RiskEngine:
    def __init__(self, limits: RiskLimits) -> None:
        self.lim = limits
        self.killed = False
        self.kill_reason: str | None = None
        self.api_error_streak = 0
        self.latencies: deque[float] = deque(maxlen=limits.latency_window)
        self.order_outcomes: deque[int] = deque(maxlen=limits.reject_window)  # 1 = rejected

    # ---- counters fed by the loop (measured, not modeled) -------------------
    def record_api(self, ok: bool) -> None:
        self.api_error_streak = 0 if ok else self.api_error_streak + 1

    def record_latency(self, ms: float) -> None:
        self.latencies.append(ms)

    def record_orders(self, sent: int, rejected: int) -> None:
        for i in range(sent):
            self.order_outcomes.append(1 if i < rejected else 0)

    def reset(self) -> None:
        """Human action only."""
        self.killed, self.kill_reason = False, None

    # ---- the check ---------------------------------------------------------
    def check(self, intents: list[OrderIntent], acct: AccountView, data_age_ms: float, data_ok: bool) -> Verdict:
        L = self.lim
        v = Verdict(Severity.ALLOW)

        def raise_to(sev: Severity, why: str) -> None:
            v.reasons.append(why)
            if sev > v.severity:
                v.severity = sev

        if self.killed:
            raise_to(Severity.KILL, f"latched: {self.kill_reason}")
        if not all(math.isfinite(x) for x in (acct.inventory, acct.equity, acct.mid, data_age_ms)):
            raise_to(Severity.KILL, "non-finite account/clock state")
        if acct.daily_loss_frac >= L.max_daily_loss_frac:
            raise_to(Severity.KILL, f"daily loss {acct.daily_loss_frac:.4f} >= {L.max_daily_loss_frac}")
        if acct.drawdown_frac >= L.max_drawdown_frac:
            raise_to(Severity.KILL, f"drawdown {acct.drawdown_frac:.4f} >= {L.max_drawdown_frac}")
        if abs(acct.inventory) > L.max_position + 1e-9:
            raise_to(Severity.KILL, f"position {acct.inventory} beyond hard limit {L.max_position}")
        if v.severity is Severity.KILL:
            if not self.killed:
                self.killed, self.kill_reason = True, v.reasons[-1]
            return v

        if not data_ok:
            raise_to(Severity.HALT, "data not ok")
        if data_age_ms > L.max_data_age_ms:
            raise_to(Severity.HALT, f"data age {data_age_ms:.0f}ms > {L.max_data_age_ms:.0f}")
        if self.api_error_streak >= L.max_api_error_streak:
            raise_to(Severity.HALT, f"{self.api_error_streak} API errors in a row")
        if len(self.latencies) == L.latency_window:
            p50 = sorted(self.latencies)[L.latency_window // 2]
            if p50 > L.max_latency_p50_ms:
                raise_to(Severity.HALT, f"decision latency p50 {p50:.0f}ms > {L.max_latency_p50_ms:.0f}")
        if len(self.order_outcomes) == L.reject_window:
            rr = sum(self.order_outcomes) / L.reject_window
            if rr > L.max_reject_ratio:
                raise_to(Severity.HALT, f"reject ratio {rr:.3f} > {L.max_reject_ratio:.3f}")
        if v.severity is Severity.HALT:
            return v

        gross = abs(acct.inventory) * acct.mid
        lev = gross / acct.equity if acct.equity > 0 else float("inf")
        reduce_only = acct.hold_blocks > L.max_hold_blocks or lev > L.max_leverage
        if reduce_only:
            raise_to(Severity.REDUCE_ONLY, "hold time" if acct.hold_blocks > L.max_hold_blocks else f"leverage {lev:.2f}")

        # per-order checks: worst case assumes every resting order on a side fills
        pending_buy = pending_sell = 0.0
        for o in intents:
            if not (math.isfinite(o.price) and math.isfinite(o.size)) or o.size <= 0 or o.price <= 0:
                raise_to(Severity.VETO, f"malformed order {o}")
                continue
            if o.size > L.max_order_size + 1e-9:
                raise_to(Severity.VETO, f"order size {o.size} > {L.max_order_size}")
                continue
            opposite = (o.side == "sell" and acct.inventory > 0) or (o.side == "buy" and acct.inventory < 0)
            reduces = opposite and o.size <= abs(acct.inventory) + 1e-9  # a flip is not a reduction
            if reduce_only and not reduces:
                continue
            if o.side == "buy":
                worst = acct.inventory + pending_buy + o.size
            else:
                worst = acct.inventory - pending_sell - o.size
            if abs(worst) > L.max_position + 1e-9 and not reduces:
                raise_to(Severity.VETO, f"{o.side} {o.size} could breach max position")
                continue
            if (gross + o.size * acct.mid) / max(acct.equity, 1e-9) > L.max_leverage and not reduces:
                raise_to(Severity.VETO, f"{o.side} {o.size} could breach leverage")
                continue
            if o.side == "buy":
                pending_buy += o.size
            else:
                pending_sell += o.size
            v.allowed.append(o)
        return v

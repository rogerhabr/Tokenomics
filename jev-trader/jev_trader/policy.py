"""Stage 3 -- Policy engine. Code decides; Jev only informs.

Inputs: a validated Decision (stage 2) + the snapshot (stage 1).
Output: an Action and quotes. Hard limits (kill, drawdown, data age...) are NOT
here -- they belong to the risk engine (stage 4), which can veto anything this
returns. (The source blog put the drawdown kill inside the policy; separating
them means a policy bug can never disable a hard limit.)

Gates consume *probabilities*, not `Score.score` (an expected value -- a
50/50 split between "Do not quote" and "Excellent" has the same E=1.5 as a
confident "Marginal/Standard"). See stage-2 notes.

Thresholds live in a JSON file (`PolicyThresholds.load`) and are DERIVED, not
hand-tuned -- see `jev_trader/sim/derive.py`.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, fields
from enum import Enum
from pathlib import Path

from jev_trader.decision import Decision
from jev_trader.pricing import PricingConfig, Quotes, inventory_pressure, make_quotes
import math

from jev_trader.state import Snapshot, StateConfig

# rv_30s is sqrt(sum r^2) over N blocks -> per-block sigma = rv_30s / sqrt(N)
_RV30_BLOCKS = StateConfig().blocks(StateConfig().vol_micro_min)


class Action(str, Enum):
    QUOTE_BOTH = "QUOTE_BOTH"
    QUOTE_WIDE = "QUOTE_WIDE"
    WIDEN = "WIDEN"
    REDUCE_ONLY = "REDUCE_ONLY"
    PULL_QUOTES = "PULL_QUOTES"
    STAND_DOWN = "STAND_DOWN"


QUOTING = {Action.QUOTE_BOTH, Action.QUOTE_WIDE, Action.WIDEN, Action.REDUCE_ONLY}


@dataclass(frozen=True)
class PolicyThresholds:
    toxic_pull: float = 0.5  # P(toxic) above -> pull (cheap mistake vs. quoting into informed flow)
    stress_widen: float = 0.7  # P(liquidity stressed) above -> widen
    crisis_stand_down: float = 0.5  # P(regime = crisis) above -> stand down
    quote_both: float = 0.6  # P(quote_env >= Standard) above -> quote both sides at A-S width
    quote_wide: float = 0.6  # P(quote_env >= Marginal) above -> quote wide
    min_confidence: float = 0.0  # top-label confidence gate on quote_environment
    # code-only fallback (Jev unavailable): based purely on snapshot numbers
    fb_max_rv30s_bps: float = 12.0
    fb_min_depth_vs_norm: float = 0.5
    fb_max_abs_ret1m_bps: float = 60.0

    def __post_init__(self) -> None:
        for f in ("toxic_pull", "stress_widen", "crisis_stand_down", "quote_both", "quote_wide", "min_confidence"):
            v = getattr(self, f)
            if not 0.0 <= v <= 1.0:
                raise ValueError(f"{f}={v} not in [0,1]")

    @classmethod
    def load(cls, path: str | Path) -> PolicyThresholds:
        raw = json.loads(Path(path).read_text())
        known = {f.name for f in fields(cls)}
        unknown = set(raw) - known - {"_meta"}
        if unknown:
            raise ValueError(f"unknown threshold keys: {sorted(unknown)}")
        return cls(**{k: v for k, v in raw.items() if k in known})

    def dump(self, path: str | Path, meta: dict | None = None) -> None:
        d = asdict(self)
        if meta:
            d["_meta"] = meta
        Path(path).write_text(json.dumps(d, indent=2) + "\n")


@dataclass(frozen=True)
class PolicyResult:
    action: Action
    quotes: Quotes | None
    source: str  # "jev" | "fallback"
    reason: str


def p_at_least(probs: dict[str, float], level: int) -> float:
    return sum(v for k, v in probs.items() if int(k) >= level)


def jev_action(d: Decision, th: PolicyThresholds) -> tuple[Action, str]:
    a = d.policy_answers()  # advisory questions (direction) already stripped
    p_tox = float(a["toxic_flow"].value)
    if p_tox > th.toxic_pull:
        return Action.PULL_QUOTES, f"p_toxic={p_tox:.2f}>{th.toxic_pull}"
    p_crisis = a["regime"].probabilities.get("crisis", 0.0)
    if p_crisis > th.crisis_stand_down:
        return Action.STAND_DOWN, f"p_crisis={p_crisis:.2f}"
    if float(a["liquidity_stressed"].value) > th.stress_widen:
        return Action.WIDEN, "liquidity stressed"
    q = a["quote_environment"]
    if q.confidence >= th.min_confidence:
        if p_at_least(q.probabilities, 2) > th.quote_both:
            return Action.QUOTE_BOTH, "env>=Standard"
        if p_at_least(q.probabilities, 1) > th.quote_wide:
            return Action.QUOTE_WIDE, "env>=Marginal"
    return Action.STAND_DOWN, "env unfavorable/uncertain"


def fallback_action(snap: Snapshot, th: PolicyThresholds) -> tuple[Action, str]:
    """Code-only rules. Used when Jev is unavailable AND as the baseline Jev must beat."""
    f = snap.fields
    if f["data_ok"] < 1:
        return Action.PULL_QUOTES, "data not ok"
    if f["rv_30s_bps"] > th.fb_max_rv30s_bps or abs(f["ret_1m_bps"]) > th.fb_max_abs_ret1m_bps:
        return Action.PULL_QUOTES, "fallback: vol/trend too high"
    if f["depth_vs_norm"] < th.fb_min_depth_vs_norm:
        return Action.WIDEN, "fallback: thin book"
    return Action.QUOTE_WIDE, "fallback: conservative quoting"


class PolicyEngine:
    def __init__(self, th: PolicyThresholds, pricing: PricingConfig) -> None:
        self.th, self.pricing = th, pricing

    def decide(self, snap: Snapshot, decision: Decision | None, best_bid: float, best_ask: float) -> PolicyResult:
        if decision is not None and decision.usable:
            action, why = jev_action(decision, self.th)
            source = "jev"
        else:
            action, why = fallback_action(snap, self.th)
            source = "fallback"
        f = snap.fields
        # inventory pressure is code (replaces the old Jev question)
        if action in QUOTING and inventory_pressure(f["inventory"], f["hold_blocks"], self.pricing) >= 3:
            action, why = Action.REDUCE_ONLY, why + "; inventory pressure 3"
        if action not in QUOTING:
            return PolicyResult(action, None, source, why)
        width = self.pricing.wide_mult if action in (Action.QUOTE_WIDE, Action.WIDEN) else 1.0
        quotes = make_quotes(f["mid"], best_bid, best_ask, f["inventory"], max(f["rv_30s_bps"] / math.sqrt(_RV30_BLOCKS), 0.1),
                             self.pricing, width_mult=width, reduce_only=action is Action.REDUCE_ONLY)
        return PolicyResult(action, quotes, source, why)

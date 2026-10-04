"""Stage 2 -- Jev decision layer.

One call per block: the snapshot + a battery of six atomic questions. Jev
interprets; it never decides. This module only turns a backend reply into a
validated `Decision` with a status. The policy (stage 3) may act only when
`decision.usable` is True.

Facts verified against typesafe-sdk==0.7.2 (not the blog post):
  * Default model is the alias `jev-latest`; `response.model` "may differ from
    the alias supplied". We require a pinned name and treat any mismatch as
    unusable (`model_mismatch`), so a silent upgrade can't move our thresholds.
  * The SDK retries 2x with backoff by default -- fatal inside a 300 ms block.
    The real backend sets `RetryPolicy(max_retries=0)` and an HTTP timeout equal
    to the decision deadline.
  * `ScoreAnswer.score` is an expected value (float), not a level. `NoulAnswer`
    has no confidence field. Validation below checks those shapes exactly.

Both the mock and the real backend return *wire-shaped* dicts and go through the
same `validate_answers`, so the mock cannot hide parsing bugs.
"""

from __future__ import annotations

import json
import math
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

from jev_trader.state import Snapshot

# ---------------------------------------------------------------- battery ---

REGIMES = ("trending", "mean_reverting", "high_vol", "crisis")
DIRECTIONS = ("up", "down", "neutral")
QUOTE_LEVELS = ("Do not quote", "Marginal", "Standard", "Excellent")


@dataclass(frozen=True)
class QuestionSpec:
    kind: str  # "noul" | "choice" | "score"
    instructions: str
    criteria: Any = None  # choice: {label: description}; score: [level descriptions]

    def labels(self) -> tuple[str, ...]:
        if self.kind == "noul":
            return ("false", "true")
        if self.kind == "choice":
            return tuple(self.criteria)
        return tuple(str(i) for i in range(len(self.criteria)))


# Stage 3: `inventory_pressure` was removed -- it is position/limit and holding
# time, i.e. arithmetic (rule #1: never spend a Jev call on math). It now lives
# in `pricing.inventory_pressure`.
BATTERY: dict[str, QuestionSpec] = {
    "regime": QuestionSpec("choice", "What regime is the market in right now", {
        "trending": "Persistent move in one direction",
        "mean_reverting": "Oscillating around a stable level",
        "high_vol": "Large moves both ways",
        "crisis": "Disorderly, liquidity vanishing",
    }),
    "direction": QuestionSpec("choice", "Most likely price bias over the next 10 blocks", {
        "up": "Higher", "down": "Lower", "neutral": "No clear bias",
    }),
    "toxic_flow": QuestionSpec("noul", "Aggressive flow is likely informed traders, not noise"),
    "liquidity_stressed": QuestionSpec("noul", "The order book is thinner than its normal level"),
    "quote_environment": QuestionSpec("score", "How favorable is this state for providing liquidity", list(QUOTE_LEVELS)),
}

# Logged and calibrated, but the policy must not consume these until a
# calibration report shows they beat their base rate. "direction" is the
# closest question to "should I buy?", i.e. to asking the AI to trade.
ADVISORY: frozenset[str] = frozenset({"direction"})


# ----------------------------------------------------------------- config ---

class ConfigError(ValueError):
    pass


@dataclass(frozen=True)
class JevConfig:
    pinned_model: str
    deadline_ms: float = 250.0  # 300 ms block minus ~50 ms for policy/risk/order send
    prob_sum_tol: float = 0.02

    def __post_init__(self) -> None:
        m = (self.pinned_model or "").strip()
        if not m:
            raise ConfigError("pinned_model is required (set JEV_PINNED_MODEL)")
        if m.endswith("-latest") or m == "latest":
            raise ConfigError(f"{m!r} is a floating alias; pin a dated model name")
        if not 0 < self.deadline_ms < 10_000:
            raise ConfigError("deadline_ms out of range")

    @classmethod
    def from_env(cls, **overrides: Any) -> JevConfig:
        return cls(pinned_model=os.environ.get("JEV_PINNED_MODEL", ""), **overrides)


# ---------------------------------------------------------------- results ---

@dataclass(frozen=True)
class Judgment:
    kind: str
    value: float | str  # noul: P(yes); choice: label; score: expected level
    confidence: float  # noul: max(p, 1-p) (derived, SDK has none); others: from Jev
    probabilities: dict[str, float]


@dataclass(frozen=True)
class RawResult:
    model: str
    answers: dict[str, Any]  # wire-shaped, as in the HTTP JSON body
    input_tokens: int | None = None
    latency_ms: float | None = None  # backends that simulate time report it; else measured


class BackendError(RuntimeError):
    pass


class JevBackend(Protocol):
    def ask(self, block: int, state: dict[str, float], battery: dict[str, QuestionSpec]) -> RawResult: ...


OK, LATE, ERROR, INVALID, MODEL_MISMATCH = "ok", "late", "error", "invalid", "model_mismatch"


@dataclass(frozen=True)
class Decision:
    block: int
    status: str
    model: str | None
    latency_ms: float
    answers: dict[str, Judgment] = field(default_factory=dict)
    input_tokens: int | None = None
    error: str | None = None

    @property
    def usable(self) -> bool:
        return self.status == OK

    def policy_answers(self) -> dict[str, Judgment]:
        """Answers the policy may act on (advisory questions stripped)."""
        return {k: v for k, v in self.answers.items() if k not in ADVISORY} if self.usable else {}


# ------------------------------------------------------------- validation ---

def _finite_prob(x: Any) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x) and 0.0 <= x <= 1.0


def validate_answers(raw: dict[str, Any], battery: dict[str, QuestionSpec], tol: float = 0.02) -> dict[str, Judgment]:
    """Wire answers -> Judgments. Raises ValueError on anything off-spec."""
    if not isinstance(raw, dict):
        raise ValueError("answers is not an object")
    missing = battery.keys() - raw.keys()
    if missing:
        raise ValueError(f"missing answers: {sorted(missing)}")
    out: dict[str, Judgment] = {}
    for name, spec in battery.items():
        a = raw[name]
        if not isinstance(a, dict) or a.get("type") != spec.kind:
            raise ValueError(f"{name}: expected type {spec.kind}")
        if spec.kind == "noul":
            p = a.get("noul")
            if not _finite_prob(p):
                raise ValueError(f"{name}: noul not a probability: {p!r}")
            out[name] = Judgment("noul", float(p), max(p, 1 - p), {"true": float(p), "false": 1 - float(p)})
            continue
        probs = {str(k): v for k, v in (a.get("probabilities") or {}).items()}
        labels = spec.labels()
        if set(probs) != set(labels) or not all(_finite_prob(v) for v in probs.values()):
            raise ValueError(f"{name}: bad probabilities {probs!r}")
        if abs(sum(probs.values()) - 1.0) > tol:
            raise ValueError(f"{name}: probabilities sum to {sum(probs.values()):.4f}")
        conf = a.get("confidence")
        if not _finite_prob(conf):
            raise ValueError(f"{name}: confidence not a probability: {conf!r}")
        if spec.kind == "choice":
            choice = a.get("choice")
            if choice not in labels:
                raise ValueError(f"{name}: choice {choice!r} not in criteria")
            if probs[choice] + 1e-9 < max(probs.values()):
                raise ValueError(f"{name}: choice is not the most probable label")
            out[name] = Judgment("choice", choice, float(conf), probs)
        else:
            score = a.get("score")
            expected = sum(int(k) * v for k, v in probs.items())
            if not isinstance(score, (int, float)) or not math.isfinite(score) or abs(score - expected) > 0.05 + tol * len(labels):
                raise ValueError(f"{name}: score {score!r} inconsistent with probabilities (E={expected:.3f})")
            out[name] = Judgment("score", float(score), float(conf), probs)
    return out


# -------------------------------------------------------------------- log ---

class DecisionLog:
    """Append-only JSONL. Every decision -- including failures -- is logged with
    the pinned and returned model names. Logging must never take the loop down:
    write failures are counted (`write_errors`) for the risk engine to read."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.write_errors = 0
        self.records = 0

    def write(self, decision: Decision, snapshot: Snapshot, pinned: str) -> None:
        rec = {
            "block": decision.block,
            "ts_ms": snapshot.ts_ms,
            "status": decision.status,
            "pinned_model": pinned,
            "model": decision.model,
            "latency_ms": round(decision.latency_ms, 2),
            "input_tokens": decision.input_tokens,
            "error": decision.error,
            "snapshot": snapshot.fields,
            "answers": {k: {"v": j.value, "c": round(j.confidence, 4),
                            "p": {l: round(p, 4) for l, p in j.probabilities.items()}}
                        for k, j in decision.answers.items()},
        }
        try:
            with self.path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(rec, separators=(",", ":")) + "\n")
            self.records += 1
        except OSError:
            self.write_errors += 1


# ------------------------------------------------------------------ layer ---

class DecisionLayer:
    def __init__(self, backend: JevBackend, cfg: JevConfig, log: DecisionLog | None = None,
                 battery: dict[str, QuestionSpec] | None = None, clock=time.perf_counter) -> None:
        self.backend, self.cfg, self.log = backend, cfg, log
        self.battery = battery or BATTERY
        self.clock = clock

    def decide(self, snap: Snapshot) -> Decision:
        t0 = self.clock()
        raw: RawResult | None = None
        try:
            raw = self.backend.ask(snap.block, snap.fields, self.battery)
        except Exception as exc:  # any backend failure is a status, never a crash
            d = Decision(snap.block, ERROR, None, (self.clock() - t0) * 1000, error=f"{type(exc).__name__}: {exc}"[:200])
            return self._log(d, snap)
        latency = raw.latency_ms if raw.latency_ms is not None else (self.clock() - t0) * 1000
        if raw.model != self.cfg.pinned_model:
            d = Decision(snap.block, MODEL_MISMATCH, raw.model, latency, input_tokens=raw.input_tokens,
                         error=f"expected {self.cfg.pinned_model}")
            return self._log(d, snap)
        try:
            answers = validate_answers(raw.answers, self.battery, self.cfg.prob_sum_tol)
        except ValueError as exc:
            d = Decision(snap.block, INVALID, raw.model, latency, input_tokens=raw.input_tokens, error=str(exc)[:200])
            return self._log(d, snap)
        # A late answer is kept for calibration logging but is never usable.
        status = LATE if latency > self.cfg.deadline_ms else OK
        return self._log(Decision(snap.block, status, raw.model, latency, answers, raw.input_tokens), snap)

    def _log(self, d: Decision, snap: Snapshot) -> Decision:
        if self.log is not None:
            self.log.write(d, snap, self.cfg.pinned_model)
        return d


# ----------------------------------------------------------- real backend ---

class TypeSafeBackend:
    """Direct TypeSafe API (no gateway hop). The SDK is imported lazily so the
    rest of the system -- and every offline test -- runs without it."""

    def __init__(self, cfg: JevConfig, *, api_key: str | None = None, transport: Any = None) -> None:
        from typesafe_sdk import RetryPolicy, TypeSafeClient

        self.cfg = cfg
        self.client = TypeSafeClient(
            api_key=api_key,
            model=cfg.pinned_model,
            retry=RetryPolicy(max_retries=0),
            timeout=cfg.deadline_ms / 1000.0,
            transport=transport,
        )
        self._questions: dict[str, Any] | None = None

    def _sdk_questions(self, battery: dict[str, QuestionSpec]) -> dict[str, Any]:
        if self._questions is None:
            from typesafe_sdk import Choice, Noul, Score

            q: dict[str, Any] = {}
            for name, s in battery.items():
                if s.kind == "noul":
                    q[name] = Noul(instructions=s.instructions)
                elif s.kind == "choice":
                    q[name] = Choice(instructions=s.instructions, criteria=dict(s.criteria))
                else:
                    q[name] = Score(instructions=s.instructions, criteria=list(s.criteria))
            self._questions = q
        return self._questions

    def ask(self, block: int, state: dict[str, float], battery: dict[str, QuestionSpec]) -> RawResult:
        resp = self.client.system_one(state=state, questions=self._sdk_questions(battery))
        answers = {k: v.model_dump(mode="json") for k, v in resp.answers.items()}
        return RawResult(model=resp.model, answers=answers, input_tokens=resp.usage.input_tokens)

    def close(self) -> None:
        self.client.close()

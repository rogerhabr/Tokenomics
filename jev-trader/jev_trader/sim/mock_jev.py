"""Mock Jev: a backend with KNOWN skill and KNOWN calibration.

Why: with no API key, the only honest thing a mock can do is let us prove the
harness can tell skill from luck and calibrated from miscalibrated. It is not
evidence that real Jev has an edge.

Mechanism (calibrated by construction):
  For each question with K labels and true label y, draw per-call skill
  s ~ U(skill_lo, skill_hi). Observe a hint h = y with prob s, else uniform.
  Report the exact Bayes posterior  q_k ∝ prior_k * (s*[k=h] + (1-s)/K).
  Because the mock knows s and the prior, q is exactly calibrated.
  temperature < 1 sharpens q -> overconfident (miscalibrated on purpose).
  skill = (0, 0) -> posterior == prior -> zero information (the "no edge" null).

Ground truth (defined here, documented, partly arbitrary -- see README):
  regime              sim label
  direction           sign of fv[t+H] vs displayed mid[t], neutral band ±band_bps
  toxic_flow          informed share of aggressive volume over last W blocks > 0.5
  liquidity_stressed  sim thin_book flag
  quote_environment   crisis or toxic -> 0, high_vol -> 1, trending -> 2, mean_reverting -> 3
  inventory_pressure  bucket of |inventory| / max_position and hold time -- this is
                      ARITHMETIC; it stays in the battery only to test whether a Jev
                      call beats the one-line code rule (stage 3 decides).
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Any

from jev_trader.decision import BATTERY, BackendError, QuestionSpec, RawResult
from jev_trader.types import BlockData, HiddenLabels


@dataclass
class Truth:
    """Per-block ground-truth label index for each question (None = unknowable)."""
    labels: dict[str, list[int | None]]
    priors: dict[str, list[float]]


def build_truth(blocks: list[BlockData], labels: list[HiddenLabels], horizon: int = 10,
                band_bps: float = 2.0, toxic_window: int = 20, battery: dict[str, QuestionSpec] = BATTERY) -> Truth:
    n = len(blocks)
    lab: dict[str, list[int | None]] = {k: [None] * n for k in battery}
    reg = battery["regime"].labels()
    dirs = battery["direction"].labels()
    inf = tot = 0.0
    win: list[tuple[float, float]] = []
    for t in range(n):
        L, b = labels[t], blocks[t]
        lab["regime"][t] = reg.index(L.regime)
        if t + horizon < n:
            mid = (b.bids[0].price + b.asks[0].price) / 2
            r = (labels[t + horizon].fair_value / mid - 1) * 1e4
            lab["direction"][t] = dirs.index("up" if r > band_bps else "down" if r < -band_bps else "neutral")
        i_v, a_v = L.informed_buy + L.informed_sell, L.informed_buy + L.informed_sell + L.noise_buy + L.noise_sell
        win.append((i_v, a_v)); inf += i_v; tot += a_v
        if len(win) > toxic_window:
            o_i, o_a = win.pop(0); inf -= o_i; tot -= o_a
        toxic = tot > 0 and inf / tot > 0.5
        lab["toxic_flow"][t] = int(toxic)
        lab["liquidity_stressed"][t] = int(L.thin_book)
        lab["quote_environment"][t] = (0 if L.regime == "crisis" or toxic else
                                       {"high_vol": 1, "trending": 2, "mean_reverting": 3}[L.regime])
    priors = {}
    for k, spec in battery.items():
        K = len(spec.labels())
        if k == "inventory_pressure":
            priors[k] = [0.55, 0.25, 0.15, 0.05]
            continue
        counts = [1.0] * K  # Laplace
        for y in lab[k]:
            if y is not None:
                counts[y] += 1
        s = sum(counts)
        priors[k] = [c / s for c in counts]
    return Truth(lab, priors)


def inventory_truth(state: dict[str, float], max_position: float, max_hold_blocks: int) -> int:
    frac = abs(state.get("inventory", 0.0)) / max_position if max_position > 0 else 0.0
    lvl = 0 if frac < 0.25 else 1 if frac < 0.5 else 2 if frac < 0.8 else 3
    if state.get("hold_blocks", 0) > max_hold_blocks:
        lvl = min(3, lvl + 1)
    return lvl


@dataclass
class LatencyModel:
    median_ms: float = 150.0
    sigma: float = 0.45  # lognormal; p99 ≈ median * e^(2.33σ) ≈ 430 ms
    spike_prob: float = 0.005
    spike_ms: float = 1500.0

    def sample(self, rng: random.Random) -> float:
        if rng.random() < self.spike_prob:
            return self.spike_ms * rng.uniform(0.8, 1.5)
        return self.median_ms * math.exp(rng.gauss(0.0, self.sigma))


@dataclass
class FailurePlan:
    outages: list[tuple[int, int]] = field(default_factory=list)  # [start, end) blocks: raise
    error_rate: float = 0.0  # random BackendError
    malformed_rate: float = 0.0  # returns off-spec answers
    wrong_model_blocks: set[int] = field(default_factory=set)  # silent "upgrade"


class MockJev:
    def __init__(self, truth: Truth, *, model: str = "jev-mock-2026-09-15", skill: tuple[float, float] = (0.4, 0.95),
                 temperature: float = 1.0, latency: LatencyModel | None = None, failures: FailurePlan | None = None,
                 max_position: float = 1000.0, max_hold_blocks: int = 2000, seed: int = 11,
                 skill_by_question: dict[str, tuple[float, float]] | None = None) -> None:
        self.truth, self.model, self.skill, self.temperature = truth, model, skill, temperature
        self.latency = latency or LatencyModel()
        self.failures = failures or FailurePlan()
        self.max_position, self.max_hold_blocks = max_position, max_hold_blocks
        self.skill_by_question = skill_by_question or {}
        self.rng = random.Random(seed)
        self.calls = 0

    def _posterior(self, y: int, prior: list[float], skill: tuple[float, float]) -> list[float]:
        rng, K = self.rng, len(prior)
        s = rng.uniform(*skill)
        h = y if rng.random() < s else rng.randrange(K)
        q = [prior[k] * (s * (k == h) + (1 - s) / K) for k in range(K)]
        if self.temperature != 1.0:
            q = [max(v, 1e-12) ** (1.0 / self.temperature) for v in q]
        z = sum(q)
        return [v / z for v in q]

    def ask(self, block: int, state: dict[str, float], battery: dict[str, QuestionSpec]) -> RawResult:
        self.calls += 1
        rng, f = self.rng, self.failures
        latency = self.latency.sample(rng)
        if any(a <= block < b for a, b in f.outages):
            raise BackendError("service unavailable (mock outage)")
        if rng.random() < f.error_rate:
            raise BackendError("mock transient error")
        answers: dict[str, Any] = {}
        for name, spec in battery.items():
            if name == "inventory_pressure":
                y: int | None = inventory_truth(state, self.max_position, self.max_hold_blocks)
            else:
                y = self.truth.labels[name][block] if block < len(self.truth.labels[name]) else None
            prior = self.truth.priors[name]
            skill = self.skill_by_question.get(name, self.skill)
            q = list(prior) if y is None else self._posterior(y, prior, skill)
            labels = spec.labels()
            if spec.kind == "noul":
                answers[name] = {"type": "noul", "noul": q[1]}
            elif spec.kind == "choice":
                k = max(range(len(q)), key=q.__getitem__)
                answers[name] = {"type": "choice", "choice": labels[k], "confidence": q[k],
                                 "probabilities": dict(zip(labels, q))}
            else:
                answers[name] = {"type": "score", "score": sum(i * v for i, v in enumerate(q)),
                                 "confidence": max(q), "legend": dict(zip(labels, spec.criteria)),
                                 "probabilities": dict(zip(labels, q))}
        if rng.random() < f.malformed_rate:
            victim = rng.choice(list(answers))
            answers[victim] = {"type": "noul", "noul": float("nan")} if rng.random() < 0.5 else {"type": "bogus"}
        model = "jev-2026-10-01-silent-upgrade" if block in f.wrong_model_blocks else self.model
        return RawResult(model=model, answers=answers, input_tokens=None, latency_ms=latency)

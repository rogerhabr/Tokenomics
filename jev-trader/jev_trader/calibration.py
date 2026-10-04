"""Calibration scoring: "when it says 80%, is it right 80% of the time?"

Pure functions over (predicted probability, outcome) pairs, so the same code
scores the mock now and logged real Jev decisions later (stage 6).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence


@dataclass(frozen=True)
class Bin:
    lo: float
    hi: float
    n: int
    mean_pred: float
    freq: float


def reliability(probs: Sequence[float], outcomes: Sequence[bool], bins: int = 10) -> list[Bin]:
    if len(probs) != len(outcomes):
        raise ValueError("length mismatch")
    acc = [[0, 0.0, 0] for _ in range(bins)]
    for p, y in zip(probs, outcomes):
        i = min(bins - 1, int(p * bins))
        acc[i][0] += 1
        acc[i][1] += p
        acc[i][2] += 1 if y else 0
    return [Bin(i / bins, (i + 1) / bins, n, s / n, k / n) for i, (n, s, k) in enumerate(acc) if n]


def ece(probs: Sequence[float], outcomes: Sequence[bool], bins: int = 10) -> float:
    """Expected calibration error: sample-weighted |confidence - frequency|."""
    total = len(probs)
    return sum(b.n / total * abs(b.mean_pred - b.freq) for b in reliability(probs, outcomes, bins)) if total else 0.0


def brier(probs: Sequence[float], outcomes: Sequence[bool]) -> float:
    return sum((p - (1.0 if y else 0.0)) ** 2 for p, y in zip(probs, outcomes)) / len(probs)


def brier_skill(probs: Sequence[float], outcomes: Sequence[bool]) -> float:
    """1 - Brier / Brier(base rate). > 0 means better than always predicting the base rate.
    This is the 'does it beat a dumb rule?' test in one number. In-sample base rate,
    so it is slightly flattering to the baseline -- i.e. conservative for the model."""
    base = sum(outcomes) / len(outcomes)
    ref = brier([base] * len(outcomes), outcomes)
    return 1.0 - brier(probs, outcomes) / ref if ref > 0 else 0.0

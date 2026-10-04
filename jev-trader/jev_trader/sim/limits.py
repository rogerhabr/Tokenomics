"""Derive risk-engine guard limits at "literal 6σ": P(false trip) <= 1 - Φ(6)
≈ 9.87e-10 per block, per limit (≈ 1 false trip per ~10 years at 288k blocks/day).

What "6σ accuracy" can and cannot mean here (honest version):
  * A distribution-free guarantee is impossible at this level (Cantelli needs
    k ≈ 31,800σ for 1e-9). Every limit below is exact ONLY under an explicit model.
  * Where the model is ours (error process, latency process, reject process) the
    limit is computed EXACTLY from the model -- no Monte-Carlo noise -- and the
    formula is cross-checked by simulation at a tail we can actually measure.
  * Where we only have samples (holding time), we fit a tail (peaks-over-
    threshold, exponential/GPD ξ=0) and report a bootstrap CI. That is an
    EXTRAPOLATION ~1e4x beyond the data; it is labelled as such.
  * Model inputs (venue error rate, feed delay, Jev latency) are ASSUMPTIONS
    until replaced by logged measurements -- re-run with real logs.

Budget limits (position, daily loss, drawdown, leverage) are NOT derived from
tails of normal operation: a limit that trips once a decade limits nothing.
They come from `RiskBudget` (operator's capital and appetite) and are then
*checked* against simulated normal operation.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from statistics import NormalDist

P6 = 1.0 - NormalDist().cdf(6.0)  # 9.866e-10
_N = NormalDist()


# ---------------------------------------------------------------- API errors ---
def api_error_streak_limit(p_err: float, p_target: float = P6) -> int:
    """Smallest k with P(k consecutive errors) = p_err^k <= p_target (i.i.d. errors)."""
    if not 0 < p_err < 1:
        raise ValueError("p_err must be in (0,1)")
    return max(1, math.ceil(math.log(p_target) / math.log(p_err) - 1e-12))


# ------------------------------------------------------------- latency (p50) ---
@dataclass(frozen=True)
class LatencyMix:
    """Lognormal body + uniform spikes -- same family as the mock (stage 2)."""
    median_ms: float = 150.0
    sigma: float = 0.45
    spike_prob: float = 0.005
    spike_lo_ms: float = 1200.0
    spike_hi_ms: float = 2250.0

    def cdf(self, x: float) -> float:
        body = _N.cdf((math.log(x) - math.log(self.median_ms)) / self.sigma) if x > 0 else 0.0
        spike = min(1.0, max(0.0, (x - self.spike_lo_ms) / (self.spike_hi_ms - self.spike_lo_ms)))
        return (1 - self.spike_prob) * body + self.spike_prob * spike

    def sample(self, rng: random.Random) -> float:
        if rng.random() < self.spike_prob:
            return rng.uniform(self.spike_lo_ms, self.spike_hi_ms)
        return self.median_ms * math.exp(rng.gauss(0.0, self.sigma))


def p_order_stat_exceeds(F: float, n: int, idx: int) -> float:
    """P(X_(idx+1) > x) for n iid draws with CDF value F = F(x); idx is 0-based
    position after sorting (the risk engine uses sorted(window)[n//2])."""
    return sum(math.comb(n, i) * F ** i * (1 - F) ** (n - i) for i in range(idx + 1))


def latency_p50_limit(mix: LatencyMix, window: int, p_target: float = P6) -> float:
    idx = window // 2
    lo, hi = 1e-3, 1e6
    for _ in range(200):  # bisection on a monotone function
        mid = math.sqrt(lo * hi)
        if p_order_stat_exceeds(mix.cdf(mid), window, idx) > p_target:
            lo = mid
        else:
            hi = mid
    return hi


# ------------------------------------------------------------------ data age ---
def lognormal_quantile(median_ms: float, sigma: float, p_target: float = P6) -> float:
    return median_ms * math.exp(sigma * _N.inv_cdf(1 - p_target))


def lognormal_fit_quantile(samples: list[float], p_target: float = P6, n_boot: int = 300,
                           seed: int = 0) -> tuple[float, float, float]:
    """MLE lognormal fit to measured samples -> 6σ quantile with bootstrap 95% CI.
    Use this on logged feed delays / latencies to replace the assumed models."""
    logs = [math.log(x) for x in samples if x > 0]

    def q(xs: list[float]) -> float:
        m = sum(xs) / len(xs)
        s = math.sqrt(sum((v - m) ** 2 for v in xs) / len(xs))
        return math.exp(m + s * _N.inv_cdf(1 - p_target))

    rng = random.Random(seed)
    boots = sorted(q([rng.choice(logs) for _ in logs]) for _ in range(n_boot))
    return q(logs), boots[int(0.025 * n_boot)], boots[int(0.975 * n_boot) - 1]


# ------------------------------------------------------------- reject ratio ---
def binom_sf(k: int, n: int, p: float) -> float:
    """P(Binom(n,p) > k)."""
    return sum(math.comb(n, i) * p ** i * (1 - p) ** (n - i) for i in range(k + 1, n + 1))


def reject_ratio_limit(p_reject: float, window: int, p_target: float = P6) -> float:
    """Smallest ratio r = k/window with P(Binom(window, p_reject) > k) <= p_target.
    (The engine trips on ratio > r.) Assumes independent rejects -- clustered rejects
    (e.g. during fast markets) make the true tail heavier: re-check on logs."""
    for k in range(window + 1):
        if binom_sf(k, window, p_reject) <= p_target:
            return k / window
    return 1.0


def wilson_upper(k: int, n: int, z: float = 1.96) -> float:
    if n == 0:
        return 1.0
    ph = k / n
    den = 1 + z * z / n
    c = ph + z * z / (2 * n)
    r = z * math.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n))
    return (c + r) / den


# --------------------------------------------------------------- hold time ---
def pot_exponential_quantile(samples: list[float], p_target: float = P6, u_quantile: float = 0.99,
                             n_boot: int = 200, seed: int = 0) -> dict[str, float]:
    """Peaks-over-threshold with an exponential excess model (GPD ξ = 0):
       P(X > x) = P(X > u) * exp(-(x - u) / β),  β = mean excess over u.
    Also returns the mean-excess at a higher threshold: if it is much larger than β
    the tail is heavier than exponential (ξ > 0) and this limit is optimistic."""
    xs = sorted(samples)
    n = len(xs)

    def fit(v: list[float]) -> tuple[float, float, float]:
        v = sorted(v)
        u = v[int(u_quantile * len(v))]
        exc = [x - u for x in v if x > u]
        if not exc:
            return u, 0.0, u
        pu = len(exc) / len(v)
        beta = sum(exc) / len(exc)
        x = u + beta * math.log(pu / p_target) if pu > p_target else u
        return u, beta, x

    u, beta, x = fit(xs)
    u2 = xs[int(0.999 * n)]
    exc2 = [v - u2 for v in xs if v > u2]
    beta2 = sum(exc2) / len(exc2) if exc2 else float("nan")
    rng = random.Random(seed)
    boots = sorted(fit([rng.choice(xs) for _ in range(n)])[2] for _ in range(n_boot))
    return {"u": u, "p_u": 1 - u_quantile, "beta": beta, "beta_at_99.9": beta2, "limit": x,
            "ci_lo": boots[int(0.025 * n_boot)], "ci_hi": boots[int(0.975 * n_boot) - 1], "n": n}


# ------------------------------------------------------------- budget limits ---
@dataclass(frozen=True)
class RiskBudget:
    """Operator inputs. No defaults on purpose."""
    capital: float
    max_daily_loss_frac: float
    max_drawdown_frac: float
    max_leverage: float

    def max_position_units(self, price: float) -> float:
        return self.max_leverage * self.capital / price


def daily_loss_trip_probability(block_pnl: list[float], capital: float, loss_frac: float,
                                blocks_per_day: int = 288_000, batch: int = 2_000) -> dict[str, float]:
    """Gaussian estimate of P(one day's PnL <= -loss_frac * capital) from per-block PnL,
    with variance from batch means (robust to autocorrelation). Gaussian tails are
    OPTIMISTIC for trading PnL; treat the result as a lower bound on the trip rate."""
    nb = len(block_pnl) // batch
    means = [sum(block_pnl[i * batch:(i + 1) * batch]) for i in range(nb)]
    mu_b = sum(means) / nb
    var_b = sum((m - mu_b) ** 2 for m in means) / (nb - 1)
    scale = blocks_per_day / batch
    mu_d, sd_d = mu_b * scale, math.sqrt(var_b * scale)
    z = (-loss_frac * capital - mu_d) / sd_d if sd_d > 0 else float("-inf")
    return {"mu_day": mu_d, "sd_day": sd_d, "z": z, "p_trip_per_day": _N.cdf(z)}


def hold_episodes(hold_trace: list[int]) -> list[int]:
    """Completed holding episodes (blocks held before returning to flat) from a
    per-block hold_blocks trace. The final open episode is included (censored,
    which biases the tail slightly short -- noted in the report)."""
    eps, prev = [], 0
    for h in hold_trace:
        if h == 0 and prev > 0:
            eps.append(prev)
        prev = h
    if prev > 0:
        eps.append(prev)
    return eps


def hold_time_limit(episodes: list[int], total_blocks: int, p_target: float = P6, u_quantile: float = 0.8,
                    n_boot: int = 500, seed: int = 0) -> dict[str, float]:
    """Per-block P(hold > x) = (n_ep / N) * E[(D - x)+], with an exponential tail
    for episode length D above u (POT, ξ=0): E[(D-x)+] = P(D>u) * β * exp(-(x-u)/β).
    Bootstraps over episodes (independent units, unlike per-block values)."""
    rate = len(episodes) / total_blocks

    def fit(eps: list[int]) -> float:
        d = sorted(eps)
        u = d[int(u_quantile * len(d))]
        exc = [x - u for x in d if x > u]
        if not exc:
            return float(d[-1])
        pu, beta = len(exc) / len(d), sum(exc) / len(exc)
        # rate * pu * beta * exp(-(x-u)/beta) = p_target
        k = rate * pu * beta / p_target
        return u + beta * math.log(k) if k > 1 else float(u)

    rng = random.Random(seed)
    boots = sorted(fit([rng.choice(episodes) for _ in episodes]) for _ in range(n_boot))
    d = sorted(episodes)
    u = d[int(u_quantile * len(d))]
    exc = [x - u for x in d if x > u]
    hi_u = d[int(0.95 * len(d))]
    exc_hi = [x - hi_u for x in d if x > hi_u]
    return {"limit": fit(episodes), "ci_lo": boots[int(0.025 * n_boot)], "ci_hi": boots[int(0.975 * n_boot) - 1],
            "n_episodes": len(episodes), "u": u, "beta": sum(exc) / len(exc) if exc else float("nan"),
            "beta_above_p95": sum(exc_hi) / len(exc_hi) if exc_hi else float("nan"), "max_observed": d[-1]}

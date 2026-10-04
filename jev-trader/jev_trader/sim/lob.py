"""Synthetic limit-order-book venue with known ground truth.

Why a simulator first: calibration ("when Jev says 80%, is it right 80%?")
needs labels. A real venue never tells you which flow was informed or what the
regime "really" was. Here we know, so every judgment can be scored.

Model (deliberately simple, every knob explicit):
  * Latent fair value `fv` follows a regime-dependent process.
  * The displayed mid lags fv (partial adjustment) -- that lag is what makes
    informed flow toxic to a market maker.
  * Informed traders see fv `informed_horizon` blocks ahead and trade toward it.
  * Noise traders trade random sides.
  * Book depth/spread scale with regime; "crisis" thins the book.
  * A reference venue quotes fv + small noise (it leads our local mid).

Determinism: same seed -> identical stream. Required for reproducible tests.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field

from jev_trader.types import BlockData, HiddenLabels, Level, Trade

REGIMES = ("trending", "mean_reverting", "high_vol", "crisis")


@dataclass(frozen=True)
class RegimeParams:
    sigma_bps: float  # per-block fv vol
    drift_bps: float  # per-block |drift| (sign set on entry)
    revert: float  # OU pull toward anchor per block (0 = none)
    spread_mult: float
    depth_mult: float
    informed_rate: float  # Poisson mean informed trades / block
    noise_rate: float  # Poisson mean noise trades / block


# Calibration target (stage 4 recalibration): ~5-6% daily vol overall, i.e. an
# altcoin. 288k blocks/day, so per-block sigma 0.5 bp ≈ 2.7%/day in calm regimes,
# 1.5 bp ≈ 8%/day in high_vol. Trending drift 0.03 bp/block ≈ 30 bp per 5-min episode.
# (Stages 1-3 used sigma 1.5-9 bp and drift 0.6 bp/block -- 72%/hour trends.)
DEFAULT_REGIMES: dict[str, RegimeParams] = {
    "trending": RegimeParams(0.5, 0.03, 0.0, 1.0, 1.0, 0.6, 2.0),
    "mean_reverting": RegimeParams(0.5, 0.0, 0.05, 1.0, 1.2, 0.2, 2.5),
    "high_vol": RegimeParams(1.5, 0.0, 0.0, 2.0, 0.7, 0.8, 2.5),
    "crisis": RegimeParams(3.0, 0.0, 0.0, 5.0, 0.2, 1.5, 1.0),
}


@dataclass
class SimConfig:
    seed: int = 7
    start_price: float = 3.4127
    block_ms: int = 300
    start_ts_ms: int = 1_790_000_000_000
    tick: float = 0.0001
    levels: int = 5
    base_half_spread_bps: float = 1.75
    base_depth: float = 500.0
    mid_adjust: float = 0.35  # fraction of (fv - mid) closed per block
    informed_horizon: int = 10
    regime_stay_prob: float = 0.999  # ~1000 blocks (~5 min) mean regime life
    crisis_entry_weight: float = 0.1  # crisis is rarer than other regimes
    ref_noise_bps: float = 0.5
    # Sweeps (stage 4): heavy-tailed order sizes that walk the book, so quotes
    # away from the touch can fill -- and the orders that reach them are
    # disproportionately large/informed. sweeps=False reproduces stages 1-3.
    sweeps: bool = True
    noise_size_min: float = 8.0
    noise_pareto_alpha: float = 1.8  # mean = a*xm/(a-1) ≈ 18
    informed_size_min: float = 25.0  # scaled by regime depth_mult
    informed_pareto_alpha: float = 1.6  # heavier tail than noise: big orders skew informed
    size_cap: float = 5000.0
    regimes: dict[str, RegimeParams] = field(default_factory=lambda: dict(DEFAULT_REGIMES))


def _poisson(rng: random.Random, lam: float) -> int:
    # Knuth; lam is small here (< ~10) so this is fine and stdlib-only.
    if lam <= 0:
        return 0
    limit, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= limit:
            return k
        k += 1


def _pareto(rng: random.Random, xm: float, alpha: float, cap: float) -> float:
    return round(min(cap, xm / (1.0 - rng.random()) ** (1.0 / alpha)), 2)


class LOBSimulator:
    """Generates (BlockData, HiddenLabels) pairs.

    fv is pre-generated `informed_horizon` blocks ahead so informed traders can
    "see the future" -- that look-ahead lives ONLY inside the simulator, and is
    exactly the thing the state engine must never have.
    """

    def __init__(self, cfg: SimConfig | None = None) -> None:
        self.cfg = cfg or SimConfig()
        self.rng = random.Random(self.cfg.seed)
        self.block = -1
        self.mid = self.cfg.start_price
        self.anchor = self.cfg.start_price
        self.regime = "mean_reverting"
        self.trend_sign = 1.0
        self.funding_bps = 0.0
        # future fair-value queue: _fv[0] is fv for the next block to emit
        self._fv: list[float] = []
        self._fv_regime: list[str] = []
        self._last_fv = self.cfg.start_price
        while len(self._fv) <= self.cfg.informed_horizon:
            self._advance_fv()

    # ---- latent process -------------------------------------------------
    def _advance_fv(self) -> None:
        cfg, rng = self.cfg, self.rng
        if rng.random() > cfg.regime_stay_prob:
            others = [r for r in REGIMES if r != self.regime]
            weights = [cfg.crisis_entry_weight if r == "crisis" else 1.0 for r in others]
            self.regime = rng.choices(others, weights=weights)[0]
            self.trend_sign = rng.choice((-1.0, 1.0))
            self.anchor = self._last_fv
        p = cfg.regimes[self.regime]
        fv = self._last_fv
        drift = p.drift_bps * self.trend_sign * 1e-4 * fv
        pull = p.revert * (self.anchor - fv)
        shock = rng.gauss(0.0, p.sigma_bps * 1e-4 * fv)
        fv = max(cfg.tick, fv + drift + pull + shock)
        self._last_fv = fv
        self._fv.append(fv)
        self._fv_regime.append(self.regime)

    # ---- one block ------------------------------------------------------
    def step(self) -> tuple[BlockData, HiddenLabels]:
        cfg, rng = self.cfg, self.rng
        self.block += 1
        self._advance_fv()
        fv_now = self._fv.pop(0)
        regime = self._fv_regime.pop(0)
        fv_future = self._fv[cfg.informed_horizon - 1]
        p = cfg.regimes[regime]

        # displayed mid lags fair value
        self.mid += cfg.mid_adjust * (fv_now - self.mid)
        mid = self.mid

        half = max(cfg.tick, mid * cfg.base_half_spread_bps * p.spread_mult * 1e-4)
        best_bid = math.floor((mid - half) / cfg.tick) * cfg.tick
        best_ask = math.ceil((mid + half) / cfg.tick) * cfg.tick
        if best_ask - best_bid < cfg.tick:
            best_ask = best_bid + cfg.tick

        # book tilts toward where fv is (makers partially see it)
        tilt = max(-0.5, min(0.5, (fv_now - mid) / max(half, 1e-12) * 0.15))
        bids, asks = [], []
        for i in range(cfg.levels):
            base = cfg.base_depth * p.depth_mult * (1.0 + 0.3 * i)
            bids.append(Level(round(best_bid - i * cfg.tick, 6), round(base * (1 + tilt) * rng.uniform(0.6, 1.4), 2)))
            asks.append(Level(round(best_ask + i * cfg.tick, 6), round(base * (1 - tilt) * rng.uniform(0.6, 1.4), 2)))

        trades: list[Trade] = []
        ib = is_ = nb = ns = 0.0
        orders: list[tuple[str, float, bool]] = []  # (side, size, informed)
        for _ in range(_poisson(rng, p.informed_rate)):
            if abs(fv_future - mid) <= half:  # informed traders only cross when edge > half-spread
                continue
            side = "buy" if fv_future > mid else "sell"
            if cfg.sweeps:
                size = _pareto(rng, cfg.informed_size_min * p.depth_mult + 5, cfg.informed_pareto_alpha, cfg.size_cap)
            else:
                size = round(rng.uniform(20, 80) * p.depth_mult + 10, 2)
            orders.append((side, size, True))
        for _ in range(_poisson(rng, p.noise_rate)):
            side = rng.choice(("buy", "sell"))
            size = (_pareto(rng, cfg.noise_size_min, cfg.noise_pareto_alpha, cfg.size_cap) if cfg.sweeps
                    else round(rng.uniform(5, 40), 2))
            orders.append((side, size, False))
        rng.shuffle(orders)
        # Walk the book: each aggressive order consumes levels in price order and
        # prints one Trade per level touched. Depth consumed earlier in the block is
        # gone for later orders. Volume beyond the visible book is not filled.
        remaining = {"buy": [lv.size for lv in asks], "sell": [lv.size for lv in bids]}
        for side, size, informed in orders:
            levels = asks if side == "buy" else bids
            rem, left, done = remaining[side], size, 0.0
            for i, lv in enumerate(levels):
                if left <= 0:
                    break
                if not cfg.sweeps and i > 0:
                    break
                take = left if not cfg.sweeps else min(left, rem[i])
                if take <= 0:
                    continue
                trades.append(Trade(lv.price, round(take, 2), side))
                rem[i] -= take
                left -= take
                done += take
            if informed:
                ib, is_ = (ib + done, is_) if side == "buy" else (ib, is_ + done)
            else:
                nb, ns = (nb + done, ns) if side == "buy" else (nb, ns + done)

        self.funding_bps += -0.001 * self.funding_bps + rng.gauss(0.0, 0.01)  # bounded OU
        ref = fv_now * (1 + rng.gauss(0.0, cfg.ref_noise_bps * 1e-4))

        data = BlockData(
            block=self.block,
            ts_ms=cfg.start_ts_ms + self.block * cfg.block_ms,
            bids=tuple(bids),
            asks=tuple(asks),
            trades=tuple(trades),
            cancels=_poisson(rng, 3.0 * (2.0 if regime in ("high_vol", "crisis") else 1.0)),
            ref_price=round(ref, 6),
            funding_bps=round(self.funding_bps, 4),
        )
        labels = HiddenLabels(
            block=self.block,
            regime=regime,
            fair_value=fv_now,
            informed_buy=ib,
            informed_sell=is_,
            noise_buy=nb,
            noise_sell=ns,
            thin_book=p.depth_mult < 0.5,
        )
        return data, labels

    def run(self, n: int) -> tuple[list[BlockData], list[HiddenLabels]]:
        out = [self.step() for _ in range(n)]
        return [d for d, _ in out], [lab for _, lab in out]

"""Quote pricing -- pure math, never sent to Jev.

Avellaneda-Stoikov (2008), infinite-horizon-window form, in price units:
    reservation  r     = mid - q * gamma * sigma^2 * tau
    total spread delta = gamma * sigma^2 * tau + (2/gamma) * ln(1 + gamma/k)
  q      inventory (asset units, + = long)
  sigma  per-block price volatility (price units)
  tau    horizon in blocks over which inventory risk is held
  gamma  risk aversion (1 / (price * units))
  k      order-arrival decay (1 / price): fill intensity ~ exp(-k * distance)

`gamma` is not intuitive, so `gamma_for_skew` derives it from what a human can
reason about: "at max position, shift my reservation price by X bps".

Inventory pressure lives here too (replaces the Jev `inventory_pressure`
question): it is position/limit and holding time -- arithmetic.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class PricingConfig:
    tick: float = 0.0001
    quote_size: float = 50.0
    max_position: float = 1000.0
    tau_blocks: float = 200.0  # ~1 minute of inventory risk at 300 ms blocks
    skew_at_max_bps: float = 6.0  # reservation shift at |q| = max_position, at sigma_ref
    sigma_ref_bps: float = 1.5  # per-block vol the skew is calibrated at
    k_per_bps: float = 0.5  # fill intensity decay per bp of distance from mid
    min_half_spread_bps: float = 1.0
    wide_mult: float = 2.0  # QUOTE_WIDE / WIDEN multiplier on the half-spread
    max_hold_blocks: int = 2000


def gamma_for_skew(cfg: PricingConfig, mid: float) -> float:
    """Solve r - mid = skew_at_max for q = max_position at sigma = sigma_ref."""
    sigma = cfg.sigma_ref_bps * 1e-4 * mid
    return (cfg.skew_at_max_bps * 1e-4 * mid) / (cfg.max_position * sigma * sigma * cfg.tau_blocks)


def reservation_price(mid: float, q: float, gamma: float, sigma: float, tau: float) -> float:
    return mid - q * gamma * sigma * sigma * tau


def optimal_spread(gamma: float, sigma: float, tau: float, k: float) -> float:
    return gamma * sigma * sigma * tau + (2.0 / gamma) * math.log(1.0 + gamma / k)


@dataclass(frozen=True)
class Quotes:
    bid: float | None
    ask: float | None
    size_bid: float
    size_ask: float
    reservation: float
    half_spread: float


def inventory_pressure(inventory: float, hold_blocks: float, cfg: PricingConfig) -> int:
    """0 None, 1 Mild, 2 Skew hard, 3 Reduce now. Same buckets the Jev question used."""
    frac = abs(inventory) / cfg.max_position if cfg.max_position > 0 else 0.0
    lvl = 0 if frac < 0.25 else 1 if frac < 0.5 else 2 if frac < 0.8 else 3
    if hold_blocks > cfg.max_hold_blocks:
        lvl = min(3, lvl + 1)
    return lvl


def make_quotes(mid: float, best_bid: float, best_ask: float, inventory: float, sigma_bps: float,
                cfg: PricingConfig, width_mult: float = 1.0, reduce_only: bool = False) -> Quotes:
    """Post-only quotes: never cross the book, rounded away from mid to the tick.
    reduce_only quotes only the side that shrinks |inventory|."""
    sigma = max(sigma_bps, 1e-6) * 1e-4 * mid
    gamma = gamma_for_skew(cfg, mid)
    k = cfg.k_per_bps / (1e-4 * mid)
    r = reservation_price(mid, inventory, gamma, sigma, cfg.tau_blocks)
    half = max(optimal_spread(gamma, sigma, cfg.tau_blocks, k) / 2, cfg.min_half_spread_bps * 1e-4 * mid) * width_mult
    t = cfg.tick
    bid = math.floor((r - half) / t + 1e-9) * t
    ask = math.ceil((r + half) / t - 1e-9) * t
    bid = min(bid, best_ask - t)  # post-only: a bid at/above best ask would take
    ask = max(ask, best_bid + t)
    room_long = max(0.0, cfg.max_position - inventory)  # how much more we may buy
    room_short = max(0.0, cfg.max_position + inventory)  # how much more we may sell
    sb, sa = min(cfg.quote_size, room_long), min(cfg.quote_size, room_short)
    if reduce_only:
        sb = sb if inventory < 0 else 0.0
        sa = sa if inventory > 0 else 0.0
    return Quotes(round(bid, 8) if sb > 0 else None, round(ask, 8) if sa > 0 else None, sb, sa, r, half)

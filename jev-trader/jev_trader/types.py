"""Core data types.

Observable market data (what a real venue would give us) and hidden simulator
labels (ground truth used only for calibration scoring) are deliberately
separate types. Nothing in the state/decision/policy path may import or accept
`HiddenLabels` -- a test enforces this.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class Level:
    price: float
    size: float


@dataclass(frozen=True, slots=True)
class Trade:
    price: float
    size: float
    aggressor: str  # "buy" | "sell" -- side that crossed the spread


@dataclass(frozen=True, slots=True)
class BlockData:
    """Everything observable at the close of one block. No future information."""

    block: int
    ts_ms: int
    bids: tuple[Level, ...]  # best first
    asks: tuple[Level, ...]  # best first
    trades: tuple[Trade, ...]
    cancels: int
    ref_price: float | None  # reference venue mid, observed at ts_ms
    funding_bps: float | None


@dataclass(frozen=True, slots=True)
class HiddenLabels:
    """Simulator-only ground truth. Never visible to the trading path."""

    block: int
    regime: str
    fair_value: float
    informed_buy: float
    informed_sell: float
    noise_buy: float
    noise_sell: float
    thin_book: bool


@dataclass(slots=True)
class AccountState:
    """Our own book. Produced by the paper engine (stage 6); defaults = flat."""

    inventory: float = 0.0
    avg_entry: float = 0.0
    realized_pnl: float = 0.0
    peak_equity: float = 0.0
    equity: float = 0.0
    hold_blocks: int = 0
    queue_ahead_bid: float = 0.0  # size ahead of our resting bid
    queue_ahead_ask: float = 0.0


@dataclass(slots=True)
class HealthState:
    """System health. Produced by the loop (stage 5); defaults = healthy."""

    orders_sent: int = 0
    orders_filled: int = 0
    orders_rejected: int = 0
    slippage_bps: float = 0.0
    consecutive_api_errors: int = 0
    last_latencies_ms: list[float] = field(default_factory=list)  # most recent last

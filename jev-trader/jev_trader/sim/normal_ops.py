"""Normal operation without the risk engine: the distributions guard limits are
fitted to. Same pipeline the live loop will run (stage 5), minus risk vetoes."""

from __future__ import annotations

from dataclasses import dataclass, field

from jev_trader.decision import DecisionLayer, JevConfig
from jev_trader.paper import PaperAccount, PaperVenue
from jev_trader.policy import PolicyEngine, PolicyThresholds
from jev_trader.pricing import PricingConfig
from jev_trader.sim.lob import LOBSimulator, SimConfig
from jev_trader.sim.mock_jev import MockJev, build_truth
from jev_trader.state import StateEngine
from jev_trader.types import HealthState


@dataclass
class OpsTrace:
    hold_blocks: list[int] = field(default_factory=list)
    inventory: list[float] = field(default_factory=list)
    equity: list[float] = field(default_factory=list)
    sent: int = 0
    rejected: int = 0
    latency_ms: list[float] = field(default_factory=list)
    statuses: dict[str, int] = field(default_factory=dict)
    max_order: float = 0.0

    def pnl_increments(self) -> list[float]:
        return [b - a for a, b in zip(self.equity, self.equity[1:])]


def run_normal_ops(seed: int, n: int, th: PolicyThresholds, pricing: PricingConfig | None = None,
                   capital: float = 10_000.0, sim_kw: dict | None = None, mock_kw: dict | None = None) -> OpsTrace:
    pricing = pricing or PricingConfig()
    blocks, labels = LOBSimulator(SimConfig(seed=seed, **(sim_kw or {}))).run(n)
    truth = build_truth(blocks, labels)
    pin = "jev-mock-ops"
    layer = DecisionLayer(MockJev(truth, model=pin, seed=seed + 7, **(mock_kw or {})), JevConfig(pin))
    policy, venue = PolicyEngine(th, pricing), PaperVenue()
    acct, eng, hl = PaperAccount(capital), StateEngine(), HealthState()
    tr = OpsTrace()
    quotes = None
    for t, b in enumerate(blocks):
        if quotes is not None and quotes.quotes is not None:  # rest decision from t-1 on block t
            q = quotes.quotes
            m = venue.match(q.bid, q.size_bid, q.ask, q.size_ask, b)
            tr.sent += m.sent
            tr.rejected += m.rejected
            hl.orders_sent += m.sent
            hl.orders_rejected += m.rejected
            hl.orders_filled += len(m.fills)
            for f in m.fills:
                acct.apply(f)
        eng.update(b)
        mid = (b.bids[0].price + b.asks[0].price) / 2
        acct.mark(mid)
        snap = eng.snapshot(b.ts_ms, acct.state(), hl)
        d = layer.decide(snap)
        tr.statuses[d.status] = tr.statuses.get(d.status, 0) + 1
        tr.latency_ms.append(d.latency_ms)
        hl.last_latencies_ms = (hl.last_latencies_ms + [d.latency_ms])[-10:]
        quotes = policy.decide(snap, d, b.bids[0].price, b.asks[0].price)
        if quotes.quotes is not None:
            tr.max_order = max(tr.max_order, quotes.quotes.size_bid, quotes.quotes.size_ask)
        tr.hold_blocks.append(acct.hold_blocks)
        tr.inventory.append(acct.inventory)
        tr.equity.append(acct.equity)
    return tr

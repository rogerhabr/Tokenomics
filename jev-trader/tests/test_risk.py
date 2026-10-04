import math
import random
from dataclasses import replace
from pathlib import Path

import pytest

from jev_trader.paper import Fill, PaperAccount, PaperVenue
from jev_trader.risk import AccountView, OrderIntent, RiskEngine, RiskLimits, Severity
from jev_trader.sim.lob import LOBSimulator, SimConfig
from jev_trader.sim.limits import (P6, LatencyMix, api_error_streak_limit, binom_sf, hold_episodes, hold_time_limit,
                                   latency_p50_limit, lognormal_fit_quantile, lognormal_quantile,
                                   p_order_stat_exceeds, reject_ratio_limit, wilson_upper)
from jev_trader.types import BlockData, Level, Trade

ROOT = Path(__file__).resolve().parents[1]

LIM = RiskLimits(max_position=1000, max_daily_loss_frac=0.02, max_drawdown_frac=0.05, max_leverage=3.0,
                 max_hold_blocks=5000, max_order_size=50, max_data_age_ms=800, max_latency_p50_ms=300,
                 latency_window=10, max_api_error_streak=5, max_reject_ratio=0.04, reject_window=50)


def view(**kw):
    d = dict(inventory=0.0, equity=10_000.0, capital=10_000.0, daily_loss_frac=0.0, drawdown_frac=0.0,
             hold_blocks=0, mid=3.4)
    d.update(kw)
    return AccountView(**d)


BOTH = [OrderIntent("buy", 3.399, 50), OrderIntent("sell", 3.401, 50)]


def chk(eng=None, intents=BOTH, age=50.0, ok=True, **kw):
    eng = eng or RiskEngine(LIM)
    return eng.check(intents, view(**kw), age, ok)


# ---------- paper venue / account ---------------------------------------------------------
def blk(bids, asks, trades=()):
    return BlockData(1, 0, tuple(Level(p, s) for p, s in bids), tuple(Level(p, s) for p, s in asks),
                     tuple(Trade(p, s, a) for p, s, a in trades), 0, None, None)


def test_post_only_crossing_quote_is_rejected():
    nxt = blk([(3.399, 100)], [(3.401, 100)])
    r = PaperVenue().match(3.401, 10, 3.399, 10, nxt)
    assert r.sent == 2 and r.rejected == 2 and not r.fills


def test_fill_rules_level_prorata_inside_and_behind():
    nxt = blk([(3.399, 100), (3.398, 100)], [(3.401, 100), (3.402, 100)],
              [(3.399, 40, "sell"), (3.401, 100, "buy"), (3.402, 30, "buy")])
    v = PaperVenue()
    assert v.match(3.399, 50, None, 0, nxt).fills[0].size == pytest.approx(20)  # 50 * 40/100
    assert v.match(None, 0, 3.401, 50, nxt).fills[0].size == pytest.approx(50)  # level fully consumed
    assert v.match(None, 0, 3.402, 50, nxt).fills[0].size == pytest.approx(15)  # swept level, pro-rata
    assert v.match(3.3995, 50, None, 0, nxt).fills[0].size == pytest.approx(40)  # inside: first in line
    assert v.match(3.397, 50, None, 0, nxt).fills == []  # behind the printed levels


def test_account_round_trip_pnl_fees_and_flip():
    a = PaperAccount(10_000, maker_bps=1.0)
    a.apply(Fill("buy", 3.0, 100))
    a.apply(Fill("sell", 3.1, 150))  # close 100 @ +0.1, open short 50 @ 3.1
    fees = (3.0 * 100 + 3.1 * 150) * 1e-4
    assert a.realized == pytest.approx(10.0 - fees)
    assert a.inventory == pytest.approx(-50) and a.avg_entry == pytest.approx(3.1)
    a.mark(3.0)
    assert a.unrealized == pytest.approx(5.0)
    assert a.equity == pytest.approx(10_000 + 10.0 - fees + 5.0)


def test_flatten_pays_taker_and_zeroes_inventory():
    a = PaperAccount(10_000, taker_bps=3.5)
    a.apply(Fill("buy", 3.4, 500))
    a.mark(3.4)
    f = a.flatten(3.399, 3.401)
    assert f.side == "sell" and a.inventory == 0
    assert a.fees == pytest.approx(3.399 * 500 * 3.5e-4)


def test_holding_time_counts_since_flat_within_dust():
    a = PaperAccount(10_000, flat_dust=1.0)
    a.apply(Fill("buy", 3.4, 10))
    for _ in range(5):
        a.mark(3.4)
    assert a.hold_blocks == 5
    a.apply(Fill("sell", 3.4, 9.5))  # 0.5 left: dust -> flat
    a.mark(3.4)
    assert a.hold_blocks == 0


def test_paper_venue_end_to_end_no_lookahead_counterfactual():
    """Same quotes, same next block -> same fills, regardless of anything after it."""
    bl, _ = LOBSimulator(SimConfig(seed=9)).run(50)
    v = PaperVenue()
    q = (bl[20].bids[0].price, 50, bl[20].asks[0].price, 50)
    assert v.match(*q, bl[21]).fills == v.match(*q, bl[21]).fills


# ---------- risk engine: every rung -----------------------------------------------------
def test_normal_state_allows_both_quotes():
    v = chk()
    assert v.severity is Severity.ALLOW and v.allowed == BOTH


@pytest.mark.parametrize("kw,why", [
    (dict(daily_loss_frac=0.02), "daily loss"),
    (dict(drawdown_frac=0.05), "drawdown"),
    (dict(inventory=1000.01), "beyond hard limit"),
    (dict(equity=float("nan")), "non-finite"),
])
def test_kill_conditions(kw, why):
    eng = RiskEngine(LIM)
    v = chk(eng, **kw)
    assert v.kill and not v.allowed and any(why in r for r in v.reasons)
    # latched: a clean state afterwards is still killed until a human resets
    assert chk(eng).kill
    eng.reset()
    assert chk(eng).severity is Severity.ALLOW


@pytest.mark.parametrize("setup,why", [
    (lambda e: None, "data not ok"),
    (lambda e: None, "data age"),
    (lambda e: [e.record_api(False) for _ in range(5)], "API errors"),
    (lambda e: [e.record_latency(400) for _ in range(10)], "latency"),
    (lambda e: e.record_orders(50, 3), "reject ratio"),
])
def test_halt_conditions(setup, why):
    eng = RiskEngine(LIM)
    setup(eng)
    v = eng.check(BOTH, view(), 900.0 if why == "data age" else 10.0, why != "data not ok")
    assert v.severity is Severity.HALT and not v.allowed and any(why in r for r in v.reasons)


def test_guards_do_not_trip_just_below_limit():
    eng = RiskEngine(LIM)
    for _ in range(4):
        eng.record_api(False)
    for _ in range(10):
        eng.record_latency(299)
    eng.record_orders(50, 2)  # 0.04 == limit, trips only on >
    assert eng.check(BOTH, view(), 800.0, True).severity is Severity.ALLOW


def test_api_streak_resets_on_success():
    eng = RiskEngine(LIM)
    for _ in range(4):
        eng.record_api(False)
    eng.record_api(True)
    eng.record_api(False)
    assert eng.api_error_streak == 1


def test_oversized_and_malformed_orders_vetoed_individually():
    v = chk(intents=[OrderIntent("buy", 3.399, 51), OrderIntent("sell", float("nan"), 10), OrderIntent("sell", 3.401, 50)])
    assert v.severity is Severity.VETO and v.allowed == [OrderIntent("sell", 3.401, 50)]


def test_position_worst_case_includes_pending_orders():
    v = chk(intents=[OrderIntent("buy", 3.399, 50), OrderIntent("buy", 3.398, 50)], inventory=920.0)
    assert [o.size for o in v.allowed] == [50]  # 920+50 ok, 920+100 would breach


@pytest.mark.parametrize("kw", [dict(hold_blocks=5001, inventory=500.0), dict(inventory=900.0, equity=1000.0)])
def test_reduce_only_keeps_only_reducing_side(kw):
    v = chk(**kw)
    assert v.severity is Severity.REDUCE_ONLY and [o.side for o in v.allowed] == ["sell"]


def test_a_flip_is_not_a_reduction():
    v = chk(intents=[OrderIntent("sell", 3.401, 50)], inventory=20.0, hold_blocks=5001)
    assert v.allowed == []


def test_risk_engine_is_independent_of_the_model():
    import ast
    tree = ast.parse((ROOT / "jev_trader" / "risk.py").read_text())
    mods = {n.module for n in ast.walk(tree) if isinstance(n, ast.ImportFrom)} | \
           {a.name for n in ast.walk(tree) if isinstance(n, ast.Import) for a in n.names}
    assert not any(m and ("decision" in m or "typesafe" in m or "policy" in m or "sim" in m) for m in mods), mods


def test_limits_reject_bad_values_and_unknown_keys(tmp_path):
    with pytest.raises(ValueError):
        replace(LIM, max_position=-1)
    with pytest.raises(ValueError):
        replace(LIM, max_daily_loss_frac=1.2)
    p = tmp_path / "l.json"
    p.write_text('{"max_position": 1}')
    with pytest.raises(TypeError):
        RiskLimits.load(p)  # missing keys: no silent defaults


# ---------- limit math: exact under the model, checked by simulation -----------------------
def test_p6_value():
    assert P6 == pytest.approx(9.8659e-10, rel=1e-3)


def test_api_streak_limit_is_minimal():
    for p in (0.001, 0.01, 0.05, 0.2):
        k = api_error_streak_limit(p)
        assert p ** k <= P6 < p ** (k - 1) or k == 1


def test_order_statistic_formula_matches_simulation():
    rng = random.Random(1)
    mix = LatencyMix()
    x = 200.0
    exact = p_order_stat_exceeds(mix.cdf(x), 10, 5)
    sim = sum(sorted(mix.sample(rng) for _ in range(10))[5] > x for _ in range(40_000)) / 40_000
    assert sim == pytest.approx(exact, abs=4 * math.sqrt(exact * (1 - exact) / 40_000) + 1e-4)


def test_latency_limit_hits_target_exactly():
    mix = LatencyMix()
    x = latency_p50_limit(mix, 10)
    assert p_order_stat_exceeds(mix.cdf(x), 10, 5) <= P6 < p_order_stat_exceeds(mix.cdf(x * 0.999), 10, 5)


def test_lognormal_fit_ci_covers_truth():
    rng = random.Random(3)
    truth = lognormal_quantile(40, 0.5)
    q, lo, hi = lognormal_fit_quantile([40 * math.exp(rng.gauss(0, 0.5)) for _ in range(5000)], n_boot=200)
    assert lo <= truth <= hi


def test_reject_limit_is_minimal_binomial_tail():
    r = reject_ratio_limit(1e-3, 50)
    k = round(r * 50)
    assert binom_sf(k, 50, 1e-3) <= P6 < binom_sf(k - 1, 50, 1e-3)


def test_wilson_upper_zero_events():
    assert 0 < wilson_upper(0, 100_000) < 5e-5


def test_hold_episodes_extraction():
    assert hold_episodes([0, 1, 2, 3, 0, 0, 1, 0, 1, 2]) == [3, 1, 2]


def test_hold_time_limit_recovers_exponential_truth():
    """Episodes ~ Exp(mean 500): per-block P(hold > x) = rate * 500 * exp(-x/500)."""
    rng = random.Random(4)
    eps = [int(rng.expovariate(1 / 500)) + 1 for _ in range(4000)]
    total = 3 * sum(eps)  # flat 2/3 of the time
    rate = len(eps) / total
    truth = 500 * math.log(rate * 500 / P6)
    h = hold_time_limit(eps, total, u_quantile=0.5, n_boot=200)
    assert h["ci_lo"] <= truth <= h["ci_hi"] and abs(h["limit"] - truth) / truth < 0.1


def test_short_round_trip_profits_when_price_falls():
    a = PaperAccount(10_000)
    a.apply(Fill("sell", 3.1, 100))
    a.mark(3.05)
    assert a.unrealized == pytest.approx(5.0)
    a.apply(Fill("buy", 3.0, 100))
    assert a.realized == pytest.approx(10.0) and a.inventory == 0

import json
import math
import random
from dataclasses import replace
from pathlib import Path

import pytest

from jev_trader.decision import BATTERY, OK, Decision, DecisionLayer, JevConfig, Judgment
from jev_trader.policy import QUOTING, Action, PolicyEngine, PolicyThresholds, fallback_action, jev_action
from jev_trader.pricing import (PricingConfig, gamma_for_skew, inventory_pressure, make_quotes, optimal_spread,
                                reservation_price)
from jev_trader.sim.derive import block_pnl, GRID, WARMUP, FeeModel, World, derive, economics, evaluate, fast_action, grids, make_world
from jev_trader.sim.mock_jev import Truth
from jev_trader.state import FIELDS, Snapshot
from jev_trader.types import Level

ROOT = Path(__file__).resolve().parents[1]
PC = PricingConfig()


def snap(**kw):
    f = {k: 0.0 for k, _ in FIELDS}
    f.update(mid=3.4, rv_30s_bps=5.0, depth_vs_norm=1.0, data_ok=1.0)
    f.update(kw)
    return Snapshot(block=1, ts_ms=0, fields=f)


def decision(p_tox=0.1, p_stress=0.1, regime=None, q_probs=None, direction="up", status=OK):
    regime = regime or {"trending": 0.7, "mean_reverting": 0.2, "high_vol": 0.08, "crisis": 0.02}
    q_probs = q_probs or {"0": 0.05, "1": 0.1, "2": 0.6, "3": 0.25}
    dprobs = {"up": 0.1, "down": 0.1, "neutral": 0.1}
    dprobs[direction] = 0.8
    rc = max(regime, key=regime.get)
    a = {
        "regime": Judgment("choice", rc, regime[rc], regime),
        "direction": Judgment("choice", direction, 0.8, dprobs),
        "toxic_flow": Judgment("noul", p_tox, max(p_tox, 1 - p_tox), {"true": p_tox, "false": 1 - p_tox}),
        "liquidity_stressed": Judgment("noul", p_stress, max(p_stress, 1 - p_stress), {"true": p_stress, "false": 1 - p_stress}),
        "quote_environment": Judgment("score", sum(int(k) * v for k, v in q_probs.items()), max(q_probs.values()), q_probs),
    }
    return Decision(1, status, "m", 10.0, a)


TH = PolicyThresholds()
ENG = PolicyEngine(TH, PC)


# ---------- policy logic -----------------------------------------------------------------
def test_battery_no_longer_asks_jev_for_arithmetic():
    assert "inventory_pressure" not in BATTERY and len(BATTERY) == 5


def test_toxic_pull_dominates_everything():
    assert jev_action(decision(p_tox=0.99, q_probs={"0": 0, "1": 0, "2": 0, "3": 1.0}), TH)[0] is Action.PULL_QUOTES


def test_gates_use_probabilities_not_expected_score():
    # E[score] = 1.5 in both, but one is a coin flip between extremes
    split = decision(q_probs={"0": 0.5, "1": 0.0, "2": 0.0, "3": 0.5})
    solid = decision(q_probs={"0": 0.0, "1": 0.5, "2": 0.5, "3": 0.0})
    assert split.answers["quote_environment"].value == solid.answers["quote_environment"].value == 1.5
    th = replace(TH, quote_both=0.45, quote_wide=0.9)
    assert jev_action(split, th)[0] is Action.QUOTE_BOTH  # P(>=2) = 0.5
    assert jev_action(solid, th)[0] is Action.QUOTE_BOTH  # P(>=2) = 0.5
    th2 = replace(TH, quote_both=0.9, quote_wide=0.9)
    assert jev_action(split, th2)[0] is Action.STAND_DOWN  # P(>=1)=0.5
    assert jev_action(solid, th2)[0] is Action.QUOTE_WIDE  # P(>=1)=1.0


def test_direction_can_never_change_the_action():
    rng = random.Random(0)
    for _ in range(500):
        kw = dict(p_tox=rng.random(), p_stress=rng.random(),
                  q_probs=dict(zip("0123", _simplex(rng, 4))),
                  regime=dict(zip(("trending", "mean_reverting", "high_vol", "crisis"), _simplex(rng, 4))))
        acts = {jev_action(decision(direction=d, **kw), TH)[0] for d in ("up", "down", "neutral")}
        assert len(acts) == 1


def test_toxicity_is_monotone():
    """Raising P(toxic) can only move toward pulling, never toward quoting."""
    rank = {Action.PULL_QUOTES: 0}
    for p in [i / 50 for i in range(51)]:
        a = jev_action(decision(p_tox=p), TH)[0]
        if p > TH.toxic_pull:
            assert a is Action.PULL_QUOTES
    assert rank  # (structure: pull is checked first; this guards a reorder)


@pytest.mark.parametrize("status", ["late", "error", "invalid", "model_mismatch"])
def test_unusable_decision_falls_back_to_code_rules(status):
    r = ENG.decide(snap(), decision(p_tox=0.0, status=status), 3.3999, 3.4001)
    assert r.source == "fallback"


def test_no_decision_at_all_falls_back():
    assert ENG.decide(snap(), None, 3.3999, 3.4001).source == "fallback"


@pytest.mark.parametrize("fields,expect", [
    (dict(data_ok=0.0), Action.PULL_QUOTES),
    (dict(rv_30s_bps=50.0), Action.PULL_QUOTES),
    (dict(ret_1m_bps=-200.0), Action.PULL_QUOTES),
    (dict(depth_vs_norm=0.2), Action.WIDEN),
    (dict(), Action.QUOTE_WIDE),
])
def test_fallback_rules(fields, expect):
    assert fallback_action(snap(**fields), TH)[0] is expect


def test_inventory_pressure_forces_reduce_only_one_side():
    r = ENG.decide(snap(inventory=900.0), decision(), 3.3999, 3.4001)
    assert r.action is Action.REDUCE_ONLY and r.quotes.bid is None and r.quotes.ask is not None
    r = ENG.decide(snap(inventory=-900.0), decision(), 3.3999, 3.4001)
    assert r.quotes.ask is None and r.quotes.bid is not None


def test_non_quoting_actions_have_no_quotes():
    r = ENG.decide(snap(), decision(p_tox=0.99), 3.3999, 3.4001)
    assert r.action not in QUOTING and r.quotes is None


# ---------- thresholds file -------------------------------------------------------------
def test_thresholds_roundtrip_and_validation(tmp_path):
    p = tmp_path / "t.json"
    th = replace(TH, toxic_pull=0.33)
    th.dump(p, meta={"why": "test"})
    assert PolicyThresholds.load(p) == th
    p.write_text(json.dumps({"toxic_pull": 1.5}))
    with pytest.raises(ValueError):
        PolicyThresholds.load(p)
    p.write_text(json.dumps({"toxic_pul": 0.3}))  # typo must not be silently ignored
    with pytest.raises(ValueError):
        PolicyThresholds.load(p)


def test_shipped_thresholds_file_is_valid_and_documented():
    raw = json.loads((ROOT / "config" / "thresholds.json").read_text())
    assert "warning" in raw["_meta"] and "MOCK" in raw["_meta"]["warning"]
    PolicyThresholds.load(ROOT / "config" / "thresholds.json")


# ---------- pricing math ----------------------------------------------------------------
def test_avellaneda_stoikov_by_hand():
    mid, q, g, s, tau, k = 100.0, 10.0, 0.1, 0.5, 4.0, 2.0
    assert reservation_price(mid, q, g, s, tau) == pytest.approx(100 - 10 * 0.1 * 0.25 * 4)
    assert optimal_spread(g, s, tau, k) == pytest.approx(0.1 * 0.25 * 4 + 20 * math.log(1.05))


def test_gamma_hits_requested_skew():
    mid = 3.4
    g = gamma_for_skew(PC, mid)
    shift = mid - reservation_price(mid, PC.max_position, g, PC.sigma_ref_bps * 1e-4 * mid, PC.tau_blocks)
    assert shift / mid * 1e4 == pytest.approx(PC.skew_at_max_bps)


def test_quotes_symmetric_flat_and_skewed_with_inventory():
    flat = make_quotes(3.4, 3.39, 3.41, 0.0, 1.5, PC)
    assert flat.reservation == pytest.approx(3.4)
    assert (3.4 - flat.bid) == pytest.approx(flat.ask - 3.4, abs=PC.tick)
    long_ = make_quotes(3.4, 3.39, 3.41, 500.0, 1.5, PC)
    assert long_.reservation < 3.4 and long_.ask <= flat.ask and long_.bid <= flat.bid


@pytest.mark.parametrize("inv", [-1000.0, -300.0, 0.0, 300.0, 1000.0])
@pytest.mark.parametrize("sigma", [0.1, 1.5, 20.0])
def test_quotes_never_cross_and_are_on_tick(inv, sigma):
    bb, ba = 3.3999, 3.4001
    q = make_quotes(3.4, bb, ba, inv, sigma, PC)
    if q.bid is not None:
        assert q.bid < ba and abs(q.bid / PC.tick - round(q.bid / PC.tick)) < 1e-6
    if q.ask is not None:
        assert q.ask > bb and abs(q.ask / PC.tick - round(q.ask / PC.tick)) < 1e-6
    # never quote beyond the position limit
    assert inv + q.size_bid <= PC.max_position + 1e-9 and inv - q.size_ask >= -PC.max_position - 1e-9


def test_higher_vol_quotes_wider():
    lo = make_quotes(3.4, 3.3, 3.5, 0.0, 1.0, PC)
    hi = make_quotes(3.4, 3.3, 3.5, 0.0, 20.0, PC)
    assert hi.half_spread > lo.half_spread


def test_inventory_pressure_buckets():
    assert [inventory_pressure(x, 0, PC) for x in (0, 300, 600, 900)] == [0, 1, 2, 3]
    assert inventory_pressure(0, PC.max_hold_blocks + 1, PC) == 1


# ---------- derivation: theory == empirics; no fabricated edge ------------------------------
def synthetic_world(seed, n, G, L, skill=True):
    """Calibrated p; toxic ~ Bernoulli(p); pnl = G (benign) or L (toxic). quote_env always favorable."""
    rng = random.Random(seed)
    tox, pnl, feats = [], [], []
    for _ in range(n):
        p = rng.random()
        y = rng.random() < p
        p_rep = p if skill else 0.5
        tox.append(int(y))
        pnl.append(L if y else G)
        feats.append({"p_tox": p_rep, "p_stress": 0.0, "p_crisis": 0.0, "p_q2": 1.0, "p_q1": 1.0, "conf_q": 1.0})
    truth = Truth({"toxic_flow": tox, "quote_environment": [3] * n}, {})
    return World(seed, [_FakeBlock] * n, truth, pnl, feats)


class _FakeBlock:  # evaluate() only touches blocks for the WIDE replace cost
    bids = (Level(3.3999, 100.0),)
    asks = (Level(3.4001, 100.0),)


@pytest.mark.parametrize("G,L", [(1.0, -1.0), (1.0, -3.0), (3.0, -1.0)])
def test_derived_toxic_threshold_matches_theory(G, L):
    ws = [synthetic_world(s, 20_000, G, L) for s in range(3)]
    th, _ = derive(ws, FeeModel(), acc_tol=float("inf"))
    assert economics(ws)["theta_star"] == pytest.approx(G / (G - L), abs=0.03)
    assert th.toxic_pull == pytest.approx(G / (G - L), abs=0.051)  # within one grid step


def test_accuracy_condition_pulls_threshold_to_half():
    ws = [synthetic_world(s, 20_000, 1.0, -3.0) for s in range(3)]  # theta* = 0.25
    th, _ = derive(ws, FeeModel(), acc_tol=0.0)
    assert th.toxic_pull == pytest.approx(0.5, abs=0.051)
    pnl_acc = sum(evaluate(w, th, FeeModel())["pnl"] for w in ws)
    th2, _ = derive(ws, FeeModel(), acc_tol=float("inf"))
    pnl_money = sum(evaluate(w, th2, FeeModel())["pnl"] for w in ws)
    assert pnl_money > pnl_acc  # the price of "max accuracy" is real and measured


def test_no_skill_cannot_beat_best_constant():
    ws = [synthetic_world(s, 5000, 1.0, -3.0, skill=False) for s in range(3)]
    th, info = derive(ws, FeeModel(), acc_tol=float("inf"))
    best_const = max(0.0, sum(sum(w.pnl[WARMUP:]) for w in ws))
    assert info["train"]["pnl"] <= best_const + 1e-9


def test_fast_action_equals_policy_on_every_block():
    w = make_world(3, 1500)
    rng = random.Random(1)
    for _ in range(5):
        th = PolicyThresholds(toxic_pull=rng.random(), stress_widen=rng.random(), crisis_stand_down=rng.random(),
                              quote_both=rng.random(), quote_wide=rng.random(), min_confidence=rng.random() * 0.5)
        for f in w.feats:
            assert fast_action(f, th) is jev_action(f["_d"], th)[0]


def _simplex(rng, k):
    x = [rng.random() for _ in range(k)]
    s = sum(x)
    return [v / s for v in x]


def test_fast_grid_equals_bruteforce_evaluate():
    ws = [make_world(s, 1500) for s in (3, 4)]
    rng = random.Random(2)
    base = PolicyThresholds(stress_widen=0.6, crisis_stand_down=0.4, quote_wide=0.5, min_confidence=0.3)
    pnl, acc_t, acc_q = grids(ws, base, FeeModel())
    for _ in range(25):
        k, j = rng.randrange(len(GRID)), rng.randrange(len(GRID))
        th = replace(base, toxic_pull=GRID[k], quote_both=GRID[j])
        rs = [evaluate(w, th, FeeModel()) for w in ws]
        assert pnl[k][j] == pytest.approx(sum(r["pnl"] for r in rs), abs=1e-9)
        n = [len(w.blocks) - WARMUP for w in ws]
        assert acc_t[k] == pytest.approx(sum(r["acc_tox"] * m for r, m in zip(rs, n)) / sum(n), abs=1e-9)


def test_grid_handles_exact_ties_like_the_policy():
    """p exactly on a grid value: policy uses strict '>' -- the grid must agree."""
    rng = random.Random(5)
    w = synthetic_world(0, 3000, 1.0, -2.0)
    for f in w.feats:
        f["p_tox"] = rng.choice(GRID)
        f["p_q2"] = rng.choice(GRID)
    pnl, _, _ = grids([w], PolicyThresholds(), FeeModel())
    for k in range(0, len(GRID), 3):
        for j in range(0, len(GRID), 3):
            th = replace(PolicyThresholds(), toxic_pull=GRID[k], quote_both=GRID[j])
            assert pnl[k][j] == pytest.approx(evaluate(w, th, FeeModel())["pnl"], abs=1e-9)


def test_decision_at_t_is_credited_with_fills_from_t_plus_1_only():
    """No look-ahead: changing block t's trades cannot change pnl[t];
    changing block t+1's trades must."""
    from jev_trader.sim.lob import LOBSimulator, SimConfig
    from jev_trader.types import Trade
    blocks, _ = LOBSimulator(SimConfig(seed=3)).run(300)
    base = block_pnl(blocks, 50.0, 10, FeeModel())
    from jev_trader.sim.derive import replace_cost
    mid = lambda i: (blocks[i].bids[0].price + blocks[i].asks[0].price) / 2  # noqa: E731
    t = next(i for i in range(100, 250) if abs(base[i] + replace_cost(50.0, mid(i), FeeModel())) > 1e-12)  # had fills
    b = blocks[t]
    big = (Trade(b.asks[0].price, 1e4, "buy"), Trade(b.bids[0].price, 1e4, "sell"))
    alt_t = blocks[:t] + [replace(b, trades=big)] + blocks[t + 1:]
    assert block_pnl(alt_t, 50.0, 10, FeeModel())[t] == base[t]
    n = blocks[t + 1]
    alt_t1 = blocks[:t + 1] + [replace(n, trades=())] + blocks[t + 2:]
    assert block_pnl(alt_t1, 50.0, 10, FeeModel())[t] != base[t]

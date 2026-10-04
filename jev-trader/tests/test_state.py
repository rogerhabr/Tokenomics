import json
import math
import time
from dataclasses import replace
from pathlib import Path
from statistics import mean

import pytest

from jev_trader.sim.lob import LOBSimulator, SimConfig
from jev_trader.state import FIELDS, MAX_CHARS_PER_TOKEN_FLOOR, LookAheadError, StateConfig, StateEngine
from jev_trader.types import AccountState, BlockData, HealthState, Level

PKG = Path(__file__).resolve().parents[1] / "jev_trader"


def stream(n, seed=7):
    return LOBSimulator(SimConfig(seed=seed)).run(n)


def feed(blocks, cfg=None):
    eng = StateEngine(cfg)
    snaps = []
    for b in blocks:
        eng.update(b)
        snaps.append(eng.snapshot(b.ts_ms))
    return eng, snaps


# ---------- simulator ----------------------------------------------------------
def test_sim_is_deterministic():
    a, la = stream(500)
    b, lb = stream(500)
    assert a == b and la == lb
    c, _ = stream(500, seed=8)
    assert a != c


def test_sim_regimes_are_readable_from_observables():
    """If the snapshot can't separate regimes, no model can -- check the signal exists."""
    blocks, labels = stream(20_000, seed=3)
    _, snaps = feed(blocks)
    by = {}
    for s, lab in zip(snaps[1500:], labels[1500:]):
        by.setdefault(lab.regime, []).append(s.fields)
    assert {"trending", "mean_reverting", "high_vol"} <= by.keys()
    spread = {r: mean(f["spread_bps"] for f in v) for r, v in by.items()}
    assert spread["high_vol"] > 1.5 * spread["mean_reverting"]
    # vol must separate on its own -- spread/depth are partly the sim's own construction
    rv = {r: mean(f["rv_30s_bps"] for f in v) for r, v in by.items()}
    assert rv["high_vol"] > 2.0 * rv["mean_reverting"], rv
    if "crisis" in by:
        assert mean(f["depth_vs_norm"] for f in by["crisis"]) < mean(f["depth_vs_norm"] for f in by["mean_reverting"])


# ---------- shape / budget ------------------------------------------------------
def test_snapshot_fixed_schema_and_finite():
    _, snaps = feed(stream(300)[0])
    for s in snaps:
        assert list(s.fields) == [k for k, _ in FIELDS]
        assert all(isinstance(v, float) and math.isfinite(v) for v in s.fields.values())


def test_token_budget_holds_even_with_extreme_account_values():
    blocks, _ = stream(7000)
    eng = StateEngine()
    acct = AccountState(inventory=-123456789.12, avg_entry=99999.0, peak_equity=1e12, equity=1.0,
                        hold_blocks=10**9, queue_ahead_bid=1e9, queue_ahead_ask=1e9)
    hl = HealthState(orders_sent=10**9, orders_filled=1, orders_rejected=10**9, slippage_bps=-12345.67,
                     last_latencies_ms=[99999.0] * 10)
    worst_chars = 0
    for b in blocks:
        eng.update(b)
        worst_chars = max(worst_chars, len(eng.snapshot(b.ts_ms, acct, hl).to_json()))
    # tokenizer-independent: even at a pessimistic 2 chars/token we fit the budget
    assert worst_chars <= MAX_CHARS_PER_TOKEN_FLOOR * StateConfig().token_budget, worst_chars


# ---------- look-ahead guarantees ----------------------------------------------
def test_future_mutation_does_not_change_past_snapshots():
    base, _ = stream(1200)
    alt_tail, _ = stream(1200, seed=99)
    t = 800
    # same prefix, completely different future (re-numbered to stay monotonic)
    alt = base[: t + 1] + [replace(b, block=b.block, ts_ms=b.ts_ms) for b in alt_tail[t + 1:]]
    _, s1 = feed(base)
    _, s2 = feed(alt)
    assert [s.fields for s in s1[: t + 1]] == [s.fields for s in s2[: t + 1]]
    assert s1[-1].fields != s2[-1].fields  # sanity: the future really differed


def test_out_of_order_and_replayed_blocks_rejected():
    blocks, _ = stream(5)
    eng = StateEngine()
    eng.update(blocks[0])
    eng.update(blocks[1])
    with pytest.raises(LookAheadError):
        eng.update(blocks[1])  # replay
    with pytest.raises(LookAheadError):
        eng.update(blocks[0])  # out of order
    with pytest.raises(LookAheadError):
        eng.update(replace(blocks[2], ts_ms=blocks[0].ts_ms))  # clock went backwards


def test_snapshot_clock_before_data_is_rejected():
    blocks, _ = stream(3)
    eng = StateEngine()
    with pytest.raises(LookAheadError):
        eng.snapshot(0)
    eng.update(blocks[0])
    with pytest.raises(LookAheadError):
        eng.snapshot(blocks[0].ts_ms - 1)
    assert eng.snapshot(blocks[0].ts_ms + 450).fields["data_age_ms"] == 450


def test_trading_path_cannot_see_hidden_labels():
    for path in PKG.rglob("*.py"):
        if "sim" in path.parts or path.name == "types.py":
            continue
        src = path.read_text()
        assert "HiddenLabels" not in src and "jev_trader.sim" not in src, path


# ---------- correctness ---------------------------------------------------------
def test_returns_match_manual_computation():
    blocks, _ = stream(700)
    eng, snaps = feed(blocks)
    n = StateConfig().blocks(1)
    assert n == 200
    mids = [(b.bids[0].price + b.asks[0].price) / 2 for b in blocks]
    expect = math.log(mids[-1] / mids[-1 - n]) * 1e4
    assert snaps[-1].fields["ret_1m_bps"] == pytest.approx(expect, abs=0.01)


def test_flow_window_rolls_off():
    blocks, _ = stream(1000)
    eng, snaps = feed(blocks)
    n = StateConfig().blocks(1)
    expect = sum(t.size for b in blocks[-n:] for t in b.trades if t.aggressor == "buy")
    assert snaps[-1].fields["aggr_buy_vol_1m"] == pytest.approx(round(expect), abs=1)


# ---------- fail-tests: bad data must degrade, never crash ------------------------
@pytest.mark.parametrize("mutate", [
    lambda b: replace(b, asks=()),                                                  # empty side
    lambda b: replace(b, bids=(Level(b.asks[0].price + 0.01, 10.0),) + b.bids[1:]),  # crossed
    lambda b: replace(b, bids=(Level(float("nan"), 10.0),) + b.bids[1:]),           # NaN price
    lambda b: replace(b, asks=(Level(b.asks[0].price, 0.0),) + b.asks[1:]),         # zero size
    lambda b: replace(b, bids=(Level(-1.0, 5.0),) + b.bids[1:]),                    # negative
])
def test_bad_book_sets_data_ok_zero_and_keeps_last_good_mid(mutate):
    blocks, _ = stream(50)
    eng, snaps = feed(blocks[:49])
    good_mid = snaps[-1].fields["mid"]
    eng.update(mutate(blocks[49]))
    s = eng.snapshot(blocks[49].ts_ms)
    assert s.fields["data_ok"] == 0.0
    assert s.fields["mid"] == good_mid
    assert all(math.isfinite(v) for v in s.fields.values())
    # recovers on the next good block
    nxt = LOBSimulator(SimConfig()).run(51)[0][50]
    eng.update(nxt)
    assert eng.snapshot(nxt.ts_ms).fields["data_ok"] == 1.0


def test_nan_reference_price_flags_not_crashes():
    blocks, _ = stream(10)
    eng, _ = feed(blocks[:9])
    eng.update(replace(blocks[9], ref_price=float("nan")))
    s = eng.snapshot(blocks[9].ts_ms)
    assert s.fields["data_ok"] == 0.0 and s.fields["ref_gap_bps"] == 0.0


def test_first_block_bad_has_no_good_book():
    b = stream(1)[0][0]
    eng = StateEngine()
    eng.update(replace(b, bids=()))
    s = eng.snapshot(b.ts_ms)
    assert s.fields["data_ok"] == 0.0 and s.fields["mid"] == 0.0


# ---------- latency budget ------------------------------------------------------
def test_update_plus_snapshot_is_far_below_block_time():
    blocks, _ = stream(5000)
    eng = StateEngine()
    t0 = time.perf_counter()
    for b in blocks:
        eng.update(b)
        eng.snapshot(b.ts_ms).to_json()
    per_block_ms = (time.perf_counter() - t0) * 1000 / len(blocks)
    assert per_block_ms < 2.0, per_block_ms  # < 1% of a 300 ms block


def test_snapshot_json_roundtrip():
    _, snaps = feed(stream(10)[0])
    assert json.loads(snaps[-1].to_json()) == snaps[-1].fields


def test_sim_daily_vol_is_calibrated():
    """Guard against a mis-scaled price process (stages 1-3 had ~70%/hour trends)."""
    blocks, _ = LOBSimulator(SimConfig(seed=1)).run(60_000)
    mids = [(b.bids[0].price + b.asks[0].price) / 2 for b in blocks]
    br = [math.log(mids[i + 1000] / mids[i]) for i in range(0, len(mids) - 1000, 1000)]
    daily = math.sqrt(sum(x * x for x in br) / len(br) * 288) * 100
    assert 3.0 < daily < 10.0, daily

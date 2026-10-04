import json
import math

import pytest

from jev_trader.calibration import brier_skill, ece
from jev_trader.decision import (ADVISORY, BATTERY, ERROR, INVALID, LATE, MODEL_MISMATCH, OK, ConfigError,
                                 DecisionLayer, DecisionLog, JevConfig, RawResult, validate_answers)
from jev_trader.sim.lob import LOBSimulator, SimConfig
from jev_trader.sim.mock_jev import FailurePlan, LatencyModel, MockJev, build_truth
from jev_trader.state import StateEngine

PIN = "jev-mock-2026-09-15"
FAST = LatencyModel(median_ms=100, sigma=0.0, spike_prob=0.0)


@pytest.fixture(scope="module")
def world():
    blocks, labels = LOBSimulator(SimConfig(seed=5)).run(12_000)
    eng, snaps = StateEngine(), []
    for b in blocks:
        eng.update(b)
        snaps.append(eng.snapshot(b.ts_ms))
    return blocks, labels, snaps, build_truth(blocks, labels)


def layer(truth, **kw):
    log = kw.pop("log", None)
    return DecisionLayer(MockJev(truth, model=PIN, **kw), JevConfig(PIN), log)


# ---------- config: pinning is mandatory --------------------------------------------
@pytest.mark.parametrize("name", ["", "   ", "jev-latest", "latest"])
def test_unpinned_model_refused(name):
    with pytest.raises(ConfigError):
        JevConfig(name)


def test_from_env_requires_pin(monkeypatch):
    monkeypatch.delenv("JEV_PINNED_MODEL", raising=False)
    with pytest.raises(ConfigError):
        JevConfig.from_env()
    monkeypatch.setenv("JEV_PINNED_MODEL", PIN)
    assert JevConfig.from_env().pinned_model == PIN


# ---------- battery shape --------------------------------------------------------------
def test_battery_matches_roadmap_and_direction_is_advisory():
    assert {k: s.kind for k, s in BATTERY.items()} == {
        "regime": "choice", "direction": "choice", "toxic_flow": "noul",
        "liquidity_stressed": "noul", "quote_environment": "score", "inventory_pressure": "score"}
    assert ADVISORY == {"direction"}


def test_policy_answers_strip_advisory(world):
    _, _, snaps, truth = world
    d = layer(truth, latency=FAST).decide(snaps[500])
    assert d.status == OK and "direction" in d.answers and "direction" not in d.policy_answers()


# ---------- statuses: every failure is a status, never an exception -----------------------
def test_ok_path(world):
    _, _, snaps, truth = world
    d = layer(truth, latency=FAST).decide(snaps[100])
    assert d.usable and d.model == PIN and set(d.answers) == set(BATTERY)
    assert d.answers["quote_environment"].kind == "score" and 0 <= d.answers["quote_environment"].value <= 3


def test_late_answer_is_unusable(world):
    _, _, snaps, truth = world
    d = layer(truth, latency=LatencyModel(median_ms=251, sigma=0.0, spike_prob=0.0)).decide(snaps[100])
    assert d.status == LATE and not d.usable and d.policy_answers() == {}
    assert d.answers  # kept for calibration logging


def test_outage_is_error_status(world):
    _, _, snaps, truth = world
    d = layer(truth, latency=FAST, failures=FailurePlan(outages=[(0, 10**9)])).decide(snaps[100])
    assert d.status == ERROR and not d.usable and "unavailable" in d.error


def test_silent_model_upgrade_is_caught(world):
    _, _, snaps, truth = world
    d = layer(truth, latency=FAST, failures=FailurePlan(wrong_model_blocks={100})).decide(snaps[100])
    assert d.status == MODEL_MISMATCH and not d.usable


class Raising:
    def ask(self, *a):
        raise KeyboardInterrupt  # BaseException must NOT be swallowed


def test_base_exceptions_propagate(world):
    _, _, snaps, _ = world
    with pytest.raises(KeyboardInterrupt):
        DecisionLayer(Raising(), JevConfig(PIN)).decide(snaps[1])


class Fixed:
    def __init__(self, answers, model=PIN):
        self.answers, self.model = answers, model

    def ask(self, *a):
        return RawResult(self.model, self.answers, latency_ms=50)


def good_answers(world_truth, snaps):
    return MockJev(world_truth, model=PIN, latency=FAST).ask(10, snaps[10].fields, BATTERY).answers


@pytest.mark.parametrize("breaker", [
    lambda a: a.pop("toxic_flow"),
    lambda a: a.__setitem__("toxic_flow", {"type": "noul", "noul": 1.2}),
    lambda a: a.__setitem__("toxic_flow", {"type": "noul", "noul": float("nan")}),
    lambda a: a.__setitem__("toxic_flow", {"type": "noul", "noul": True}),
    lambda a: a.__setitem__("toxic_flow", {"type": "choice"}),
    lambda a: a["regime"].__setitem__("choice", "sideways"),
    lambda a: a["regime"]["probabilities"].__setitem__("trending", 0.9),
    lambda a: a["regime"].__setitem__("probabilities", {k: v * 0.7 for k, v in a["regime"]["probabilities"].items()}),
    lambda a: a["regime"].__setitem__("choice", min(a["regime"]["probabilities"], key=a["regime"]["probabilities"].get)),
    lambda a: a["quote_environment"].__setitem__("score", 3.0 if a["quote_environment"]["score"] < 1.5 else 0.0),
    lambda a: a["quote_environment"]["probabilities"].pop("3"),
    lambda a: a["inventory_pressure"].__setitem__("confidence", -0.1),
])
def test_malformed_answers_are_invalid_not_crash(world, breaker):
    _, _, snaps, truth = world
    a = good_answers(truth, snaps)
    breaker(a)
    d = DecisionLayer(Fixed(a), JevConfig(PIN)).decide(snaps[10])
    assert d.status == INVALID and not d.usable and d.error


def test_validator_accepts_mock_output(world):
    _, _, snaps, truth = world
    validate_answers(good_answers(truth, snaps), BATTERY)


# ---------- logging ----------------------------------------------------------------------
def test_every_decision_logged_with_pinned_model(world, tmp_path):
    _, _, snaps, truth = world
    log = DecisionLog(tmp_path / "d.jsonl")
    lyr = layer(truth, log=log, failures=FailurePlan(outages=[(50, 60)], malformed_rate=0.05, wrong_model_blocks={70}))
    statuses = [lyr.decide(s).status for s in snaps[:200]]
    lines = [json.loads(x) for x in (tmp_path / "d.jsonl").read_text().splitlines()]
    assert len(lines) == 200 == log.records
    assert all(r["pinned_model"] == PIN for r in lines)
    assert [r["status"] for r in lines] == statuses
    assert {ERROR, INVALID, MODEL_MISMATCH, OK} <= set(statuses)


def test_log_write_failure_does_not_crash(world, tmp_path):
    _, _, snaps, truth = world
    log = DecisionLog(tmp_path / "no_such_dir" / "d.jsonl")
    d = layer(truth, latency=FAST, log=log).decide(snaps[5])
    assert d.usable and log.write_errors == 1


# ---------- the harness can tell calibrated / overconfident / no-edge apart ----------------
def collect(world, **kw):
    _, _, snaps, truth = world
    lyr = layer(truth, latency=FAST, **kw)
    p_tox, y_tox, c_reg, y_reg = [], [], [], []
    for t in range(200, len(snaps) - 20):
        d = lyr.decide(snaps[t])
        p_tox.append(d.answers["toxic_flow"].value)
        y_tox.append(bool(truth.labels["toxic_flow"][t]))
        r = d.answers["regime"]
        c_reg.append(r.confidence)
        y_reg.append(BATTERY["regime"].labels().index(r.value) == truth.labels["regime"][t])
    return p_tox, y_tox, c_reg, y_reg


def test_calibrated_mock_is_calibrated_and_skilled(world):
    p, y, c, ok = collect(world)
    assert ece(p, y) < 0.03 and ece(c, ok) < 0.03
    assert brier_skill(p, y) > 0.2


def test_overconfident_mock_is_detected(world):
    p, y, c, ok = collect(world, temperature=0.4)
    assert ece(p, y) > 0.08 or ece(c, ok) > 0.08


def test_no_edge_mock_has_no_skill(world):
    p, y, _, _ = collect(world, skill=(0.0, 0.0))
    assert abs(brier_skill(p, y)) < 0.01


# ---------- latency reality check: how many blocks would be skipped? ------------------------
def test_default_latency_model_skip_rate_is_measured(world):
    _, _, snaps, truth = world
    lyr = layer(truth)  # default lognormal median 150 ms + 0.5% spikes
    statuses = [lyr.decide(s).status for s in snaps[:5000]]
    late = statuses.count(LATE) / len(statuses)
    # 250 ms deadline vs median 150 / σ 0.45  ->  P(late) ≈ 1-Φ(ln(250/150)/0.45) ≈ 13%
    assert 0.08 < late < 0.20, late


# ---------- real SDK adapter over a fake HTTP transport (no key, no network) -----------------
httpx2 = pytest.importorskip("httpx2")
pytest.importorskip("typesafe_sdk")
from jev_trader.decision import TypeSafeBackend  # noqa: E402


def wire_reply(truth, snaps, model=PIN):
    ans = good_answers(truth, snaps)
    return {"model": model, "answers": ans, "usage": {"input_tokens": 231, "output_tokens": 6}}


def sdk_layer(handler):
    calls = []

    def h(req):
        calls.append(req)
        return handler(req)
    cfg = JevConfig(PIN)
    return DecisionLayer(TypeSafeBackend(cfg, api_key="test-key", transport=httpx2.MockTransport(h)), cfg), calls


def test_sdk_request_shape_and_parse(world):
    _, _, snaps, truth = world
    lyr, calls = sdk_layer(lambda r: httpx2.Response(200, json=wire_reply(truth, snaps)))
    d = lyr.decide(snaps[10])
    assert d.status in (OK, LATE) and d.input_tokens == 231 and set(d.answers) == set(BATTERY)
    body = json.loads(calls[0].content)
    assert body["model"] == PIN and body["state"] == snaps[10].fields
    assert {k: v["type"] for k, v in body["questions"].items()} == {k: s.kind for k, s in BATTERY.items()}
    assert calls[0].url.path.endswith("/v1/systemone")


def test_sdk_does_not_retry_on_500(world):
    _, _, snaps, _ = world
    lyr, calls = sdk_layer(lambda r: httpx2.Response(503, json={"error": "busy"}))
    d = lyr.decide(snaps[10])
    assert d.status == ERROR and len(calls) == 1  # SDK default would make 3 calls


def test_sdk_server_side_model_swap_caught(world):
    _, _, snaps, truth = world
    lyr, _ = sdk_layer(lambda r: httpx2.Response(200, json=wire_reply(truth, snaps, model="jev-2026-11-01")))
    assert lyr.decide(snaps[10]).status == MODEL_MISMATCH


def test_sdk_garbage_body_is_error(world):
    _, _, snaps, _ = world
    lyr, _ = sdk_layer(lambda r: httpx2.Response(200, content=b"<html>gateway</html>"))
    assert lyr.decide(snaps[10]).status == ERROR


def test_sdk_connection_failure_is_error(world):
    _, _, snaps, _ = world

    def boom(r):
        raise httpx2.ConnectError("no route")
    lyr, calls = sdk_layer(boom)
    assert lyr.decide(snaps[10]).status == ERROR and len(calls) == 1

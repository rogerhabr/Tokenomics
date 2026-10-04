"""Derive policy thresholds from simulated economics (offline; uses ground truth).

Objective: maximize markout PnL.  Condition: each threshold's classification
accuracy must be within `acc_tol` of the best achievable accuracy for that
judgment ("max accuracy as a condition"). acc_tol=inf removes the condition.

Theory for a calibrated P(toxic)=p: quoting is +EV iff (1-p)G + pL > 0, i.e.
pull iff p > theta* = G / (G - L), where
  G = E[markout per quoting block | benign],  L = E[... | toxic].
The accuracy-optimal cut for a calibrated p is 0.5. They agree only if G = -L.

Fill/fee model (assumptions, all explicit):
  * QUOTE_BOTH rests `quote_size` at the touch on both sides.
  * Pro-rata fill: each aggressive trade fills us trade_size * q / (L1_size + q).
  * Markout at `horizon` blocks against the displayed mid.
  * Fees: maker_bps on fills; replace_cost_bps per order replaced per quoting
    block (on-chain cancel/replace). "Typical on-chain CLOB" defaults, not a venue.
  * The sim's aggressive trades never sweep past L1, so wide quotes never fill:
    QUOTE_WIDE/WIDEN earn 0 and pay replace cost. (Stage 6 needs a sweep model.)

Statistics: PnL is dominated by seed (regime path) variance, so every comparison
is PAIRED by seed (same market path, different policy) across several seeds.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, replace

from jev_trader.decision import DecisionLayer, JevConfig
from jev_trader.policy import Action, PolicyThresholds, p_at_least
from jev_trader.sim.lob import DEFAULT_REGIMES, LOBSimulator, SimConfig
from jev_trader.sim.mock_jev import LatencyModel, MockJev, Truth, build_truth
from jev_trader.state import StateEngine
from jev_trader.types import BlockData

WARMUP = 200
GRID = [round(0.05 * i, 2) for i in range(0, 21)]  # 0.0 .. 1.0 (0 = always pull, 1 = never)


@dataclass(frozen=True)
class FeeModel:
    """Typical on-chain CLOB (assumed, not a specific venue)."""
    maker_bps: float = 0.0
    taker_bps: float = 3.5  # used by the risk engine's flatten path (stage 4)
    replace_cost_bps: float = 0.05  # per order replaced, on notional


def scaled_regimes(informed_mult: float) -> dict:
    """Toxicity scenario knob: scale every regime's informed-trade rate."""
    return {k: replace(v, informed_rate=v.informed_rate * informed_mult) for k, v in DEFAULT_REGIMES.items()}


def block_pnl(blocks: list[BlockData], quote_size: float, horizon: int, fees: FeeModel) -> list[float]:
    """PnL (quote ccy) per block of resting quote_size at the touch on both sides."""
    mids = [(b.bids[0].price + b.asks[0].price) / 2 for b in blocks]
    out = [0.0] * len(blocks)
    for t, b in enumerate(blocks):
        if t + horizon >= len(blocks):
            break
        m_fut, pnl = mids[t + horizon], 0.0
        for tr in b.trades:
            l1 = b.asks[0].size if tr.aggressor == "buy" else b.bids[0].size
            fill = tr.size * quote_size / (l1 + quote_size)
            edge = (tr.price - m_fut) if tr.aggressor == "buy" else (m_fut - tr.price)
            pnl += fill * edge - fill * tr.price * fees.maker_bps * 1e-4
        pnl -= replace_cost(quote_size, mids[t], fees)
        out[t] = pnl
    return out


def replace_cost(quote_size: float, mid: float, fees: FeeModel) -> float:
    return 2 * quote_size * mid * fees.replace_cost_bps * 1e-4


@dataclass
class World:
    seed: int
    blocks: list[BlockData]
    truth: Truth
    pnl: list[float]
    feats: list[dict]  # per-block Jev-derived probabilities (+ "_d": the Decision)


def make_world(seed: int, n: int, *, quote_size: float = 50.0, horizon: int = 10, fees: FeeModel = FeeModel(),
               mock_kw: dict | None = None, informed_mult: float = 1.0) -> World:
    blocks, labels = LOBSimulator(SimConfig(seed=seed, regimes=scaled_regimes(informed_mult))).run(n)
    pnl = block_pnl(blocks, quote_size, horizon, fees)
    truth = build_truth(blocks, labels, horizon=horizon, markout=pnl)
    pin = "jev-mock-derive"
    lyr = DecisionLayer(MockJev(truth, model=pin, seed=seed + 1000,
                                latency=LatencyModel(median_ms=50, sigma=0.0, spike_prob=0.0), **(mock_kw or {})),
                        JevConfig(pin))
    eng, feats = StateEngine(), []
    for b in blocks:
        eng.update(b)
        d = lyr.decide(eng.snapshot(b.ts_ms))
        a = d.answers
        feats.append({
            "p_tox": float(a["toxic_flow"].value),
            "p_stress": float(a["liquidity_stressed"].value),
            "p_crisis": a["regime"].probabilities.get("crisis", 0.0),
            "p_q2": p_at_least(a["quote_environment"].probabilities, 2),
            "p_q1": p_at_least(a["quote_environment"].probabilities, 1),
            "conf_q": a["quote_environment"].confidence,
            "_d": d,
        })
    return World(seed, blocks, truth, pnl, feats)


def economics(worlds: list[World]) -> dict[str, float]:
    g, l_ = [], []
    for w in worlds:
        tox = w.truth.labels["toxic_flow"]
        for t in range(WARMUP, len(w.blocks)):
            (l_ if tox[t] == 1 else g).append(w.pnl[t])
    G = sum(g) / len(g) if g else 0.0
    L = sum(l_) / len(l_) if l_ else 0.0
    if G <= 0:
        theta = 0.0  # benign flow already loses: pull always
    elif L >= 0:
        theta = 1.0  # toxic flow doesn't hurt: never pull on toxicity
    else:
        theta = G / (G - L)
    return {"G": G, "L": L, "theta_star": theta, "n_benign": len(g), "n_toxic": len(l_)}


def fast_action(f: dict, th: PolicyThresholds) -> Action:
    """Mirror of policy.jev_action on precomputed features (for grid-search speed).
    Equivalence with jev_action is enforced by a test over every block."""
    if f["p_tox"] > th.toxic_pull:
        return Action.PULL_QUOTES
    if f["p_crisis"] > th.crisis_stand_down:
        return Action.STAND_DOWN
    if f["p_stress"] > th.stress_widen:
        return Action.WIDEN
    if f["conf_q"] >= th.min_confidence:
        if f["p_q2"] > th.quote_both:
            return Action.QUOTE_BOTH
        if f["p_q1"] > th.quote_wide:
            return Action.QUOTE_WIDE
    return Action.STAND_DOWN


def evaluate(w: World, th: PolicyThresholds, fees: FeeModel, quote_size: float = 50.0) -> dict[str, float]:
    pnl, quoting, acc_tox, acc_q, n, nq = 0.0, 0, 0, 0, 0, 0
    tox, env = w.truth.labels["toxic_flow"], w.truth.labels["quote_environment"]
    for t in range(WARMUP, len(w.blocks)):
        f = w.feats[t]
        action = fast_action(f, th)
        if action is Action.QUOTE_BOTH:
            pnl += w.pnl[t]
            quoting += 1
        elif action in (Action.QUOTE_WIDE, Action.WIDEN):
            b = w.blocks[t]
            pnl -= replace_cost(quote_size, (b.bids[0].price + b.asks[0].price) / 2, fees)
        n += 1
        acc_tox += (f["p_tox"] > th.toxic_pull) == bool(tox[t])
        if env[t] is not None:
            nq += 1
            acc_q += (f["p_q2"] > th.quote_both) == (env[t] >= 2)
    return {"pnl": pnl, "quote_frac": quoting / n, "acc_tox": acc_tox / n, "acc_q": acc_q / max(1, nq)}


def baselines(w: World) -> dict[str, float]:
    """Constant rules, a toxicity oracle (quote iff truly benign) and a
    perfect-foresight bound (quote iff this block's markout > 0)."""
    tox = w.truth.labels["toxic_flow"]
    r = range(WARMUP, len(w.blocks))
    return {"never_quote": 0.0,
            "always_quote": sum(w.pnl[t] for t in r),
            "toxicity_oracle": sum(w.pnl[t] for t in r if tox[t] == 0),
            "foresight_bound": sum(w.pnl[t] for t in r if w.pnl[t] > 0)}


def _total(worlds: list[World], th: PolicyThresholds, fees: FeeModel) -> dict[str, float]:
    rs = [evaluate(w, th, fees) for w in worlds]
    return {k: sum(r[k] for r in rs) / (1 if k == "pnl" else len(rs)) for k in rs[0]}


def _first_ge(x: float) -> int:
    """Smallest grid index k with GRID[k] >= x (len(GRID) if none)."""
    for k, g in enumerate(GRID):
        if g >= x - 1e-12:
            return k
    return len(GRID)


def grids(worlds: list[World], base: PolicyThresholds, fees: FeeModel, quote_size: float = 50.0):
    """PnL[k][j] for toxic_pull=GRID[k], quote_both=GRID[j] (others from `base`),
    plus 1-D accuracy curves -- in O(N + |GRID|^2) via difference arrays.
    Exactly equal to calling evaluate() per cell (enforced by a test)."""
    n = len(GRID)
    diff = [[0.0] * (n + 1) for _ in range(n + 1)]
    tox_pos = [0] * (n + 1)  # accuracy bookkeeping for toxic_pull
    tox_neg = [0] * (n + 1)
    q_pos = [0] * (n + 1)
    q_neg = [0] * (n + 1)
    n_tox = n_q = tot_tox_pos = tot_q_pos = 0
    for w in worlds:
        tox, env = w.truth.labels["toxic_flow"], w.truth.labels["quote_environment"]
        for t in range(WARMUP, len(w.blocks)):
            f = w.feats[t]
            b = w.blocks[t]
            rc = replace_cost(quote_size, (b.bids[0].price + b.asks[0].price) / 2, fees)
            it = _first_ge(f["p_tox"])  # passes the toxic gate for k >= it
            jq = _first_ge(f["p_q2"])  # QUOTE_BOTH for j < jq
            if f["p_crisis"] > base.crisis_stand_down:
                lo, hi = 0.0, 0.0
            elif f["p_stress"] > base.stress_widen:
                lo, hi = -rc, -rc
            elif f["conf_q"] >= base.min_confidence:
                hi = w.pnl[t]
                lo = -rc if f["p_q1"] > base.quote_wide else 0.0
            else:
                lo, hi = 0.0, 0.0
            if it < n:
                diff[it][0] += hi
                diff[it][min(jq, n)] += lo - hi
            # accuracy: predicted toxic at k iff k < it
            y = bool(tox[t])
            n_tox += 1
            (tox_pos if y else tox_neg)[it] += 1
            tot_tox_pos += y
            if env[t] is not None:
                yq = env[t] >= 2
                n_q += 1
                (q_pos if yq else q_neg)[jq] += 1
                tot_q_pos += yq
    pnl = [[0.0] * n for _ in range(n)]
    row = [0.0] * n
    for k in range(n):
        acc_j, line = 0.0, []
        for j in range(n):
            acc_j += diff[k][j]
            line.append(acc_j)
        row = [row[j] + line[j] for j in range(n)]
        pnl[k] = list(row)

    def acc_curve(pos, neg, total_pos, total):
        # correct at index k: positives with it > k (predicted yes) + negatives with it <= k
        out, pos_le, neg_le = [], 0, 0
        for k in range(n):
            pos_le += pos[k]
            neg_le += neg[k]
            out.append(((total_pos - pos_le) + neg_le) / max(1, total))
        return out

    return pnl, acc_curve(tox_pos, tox_neg, tot_tox_pos, n_tox), acc_curve(q_pos, q_neg, tot_q_pos, n_q)


def derive(worlds: list[World], fees: FeeModel, acc_tol: float = 0.02,
           base: PolicyThresholds | None = None) -> tuple[PolicyThresholds, dict]:
    """Maximize pooled PnL over (toxic_pull, quote_both) subject to the accuracy
    condition. Other thresholds are held at `base`."""
    base = base or PolicyThresholds()
    pnl, acc_t, acc_q = grids(worlds, base, fees)
    ok_t = [k for k in range(len(GRID)) if acc_t[k] >= max(acc_t) - acc_tol]
    ok_q = [j for j in range(len(GRID)) if acc_q[j] >= max(acc_q) - acc_tol]
    k, j = max(((k, j) for k in ok_t for j in ok_q), key=lambda kj: pnl[kj[0]][kj[1]])
    th = replace(base, toxic_pull=GRID[k], quote_both=GRID[j])
    return th, {"acc_tol": acc_tol, "feasible_toxic": [GRID[i] for i in ok_t],
                "feasible_quote": [GRID[i] for i in ok_q], "train": _total(worlds, th, fees)}


def paired_diff(a: list[float], b: list[float]) -> tuple[float, float]:
    """Mean and ~95% CI half-width of a-b, paired by seed (t ~ 2 for small n is
    optimistic; we use 2.57 ~ t_{0.975, df=5} to stay conservative for 6 seeds)."""
    d = [x - y for x, y in zip(a, b)]
    n = len(d)
    m = sum(d) / n
    sd = math.sqrt(sum((x - m) ** 2 for x in d) / (n - 1)) if n > 1 else float("inf")
    return m, 2.57 * sd / math.sqrt(n)

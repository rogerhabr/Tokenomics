"""Stage 4: derive guard limits at literal 6σ (P(false trip) <= 9.87e-10 per block).
Writes config/risk_guard_limits.json and reports/stage4.md.
Every number is exact under a STATED model, cross-checked by simulation at a
measurable tail; sample-based limits carry bootstrap CIs.
"""
import json
import math
from collections import Counter
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from jev_trader.policy import PolicyThresholds  # noqa: E402
from jev_trader.pricing import PricingConfig  # noqa: E402
from jev_trader.sim.limits import (P6, LatencyMix, api_error_streak_limit, hold_episodes, hold_time_limit,  # noqa: E402
                                   latency_p50_limit, lognormal_fit_quantile, lognormal_quantile,
                                   reject_ratio_limit, wilson_upper)
from jev_trader.sim.normal_ops import run_normal_ops  # noqa: E402

t0 = time.time()
rng = random.Random(42)
L = ["# Stage 4 - guard limits at literal 6σ", "",
     f"Target: P(false trip) ≤ 1−Φ(6) = {P6:.3e} per block per limit (≈1 per {1/(P6*288000*365):.1f} years at 288k blocks/day).",
     "Exact under the stated model; models marked **ASSUMED** must be replaced by logged measurements.", ""]
out = {}

# 1. API error streak -----------------------------------------------------------
P_ERR = 0.01
k = api_error_streak_limit(P_ERR)
# MC check at a measurable rate: p=0.3, k for 1e-3 target
pk, kk = 0.3, api_error_streak_limit(0.3, 1e-3)
streak = hits = 0
N = 2_000_000
for _ in range(N):
    streak = streak + 1 if rng.random() < pk else 0
    hits += streak >= kk
L += ["## API error streak", f"Model (**ASSUMED**): i.i.d. venue errors, p = {P_ERR}. Limit k = ⌈ln P6 / ln p⌉ = **{k}** "
      f"(p^k = {P_ERR**k:.1e}).",
      f"MC check (p=0.3, target 1e-3 → k={kk}): analytic p^k = {pk**kk:.2e}, simulated {hits/N:.2e} over {N:,} blocks.", ""]
out["max_api_error_streak"] = k

# 2. Decision latency p50 over a 10-window ------------------------------------
mix, W = LatencyMix(), 10
lat = latency_p50_limit(mix, W)
lat3 = latency_p50_limit(mix, W, 1e-3)
M = 200_000
exceed = sum(sorted(mix.sample(rng) for _ in range(W))[W // 2] > lat3 for _ in range(M))
L += ["## Decision latency (median of last 10)",
      f"Model (**ASSUMED**, = mock): lognormal median {mix.median_ms} ms σ {mix.sigma} + {mix.spike_prob:.1%} spikes "
      f"U({mix.spike_lo_ms:.0f},{mix.spike_hi_ms:.0f}) ms. Exact order-statistic tail.",
      f"Limit: p50 > **{lat:.0f} ms** (deadline is 250 ms; single late answers are handled by the deadline, this guard catches *persistent* degradation).",
      f"MC check at 1e-3: limit {lat3:.0f} ms, simulated exceedance {exceed/M:.2e} over {M:,} windows.", ""]
out["max_latency_p50_ms"], out["latency_window"] = round(lat, 1), W

# 3. Data age ---------------------------------------------------------------------
FEED_MED, FEED_SIG = 40.0, 0.5
age = lognormal_quantile(FEED_MED, FEED_SIG)
samples = [FEED_MED * math.exp(rng.gauss(0, FEED_SIG)) for _ in range(20_000)]
fit, lo, hi = lognormal_fit_quantile(samples)
L += ["## Data age", f"Model (**ASSUMED**): feed delay lognormal median {FEED_MED} ms σ {FEED_SIG}. Exact quantile at z=6: **{age:.0f} ms**.",
      f"Estimator check (what you will run on real logs): fit to 20k samples → {fit:.0f} ms, 95% CI [{lo:.0f}, {hi:.0f}] (covers truth: {lo <= age <= hi}).",
      f"Consequence: at 6σ the guard ({age:.0f} ms) is > one block (300 ms). It detects a *dead* feed, not one stale block — "
      "single stale blocks are the deadline rule's job (stage 5).", ""]
out["max_data_age_ms"] = round(age, 1)

# 4+5. Normal operation: rejects, order size, hold time ------------------------------
th = PolicyThresholds.load(Path("config/thresholds.json"))
pc = PricingConfig()
SEEDS, NB = list(range(300, 312)), 60_000
traces = [run_normal_ops(s, NB, th, pc) for s in SEEDS]
sent = sum(t.sent for t in traces)
rej = sum(t.rejected for t in traces)
p_rej_hi = wilson_upper(rej, sent)
RW = 50
rr = reject_ratio_limit(p_rej_hi, RW)
L += ["## Reject ratio (post-only rejects, last 50 orders)",
      f"Measured in normal operation ({len(SEEDS)} seeds × {NB:,} blocks): {rej} rejects / {sent:,} orders; "
      f"Wilson 95% upper bound p = {p_rej_hi:.2e}. Exact binomial tail → trip if ratio > **{rr:.2f}** "
      f"(> {round(rr*RW)} of {RW}). Assumes independent rejects; clustering would need a wider limit.", ""]
out["max_reject_ratio"], out["reject_window"] = rr, RW

max_order = max(t.max_order for t in traces)
L += ["## Order size", f"Deterministic: the pricing code caps every order at quote_size = {pc.quote_size}. "
      f"Observed max {max_order}. Limit = **{pc.quote_size}**; anything larger is a bug, not a tail event.", ""]
out["max_order_size"] = pc.quote_size

eps = [e for t in traces for e in hold_episodes(t.hold_blocks)]
h = hold_time_limit(eps, len(SEEDS) * NB)
L += ["## Holding time (blocks since |inventory| ≤ dust)",
      f"{h['n_episodes']} episodes; max observed {h['max_observed']} blocks. POT exponential tail above u={h['u']} "
      f"(β={h['beta']:.0f}; β above p95 = {h['beta_above_p95']:.0f} — {'similar: exponential tail plausible' if h['beta_above_p95'] < 1.5*h['beta'] else 'LARGER: tail heavier than exponential, limit is optimistic'}).",
      f"Limit **{h['limit']:.0f} blocks** (~{h['limit']*0.3/60:.0f} min), bootstrap 95% CI [{h['ci_lo']:.0f}, {h['ci_hi']:.0f}]. "
      f"EXTRAPOLATION: {1/P6/(len(SEEDS)*NB):.0e}× beyond the sample. Using the CI upper bound.", ""]
out["max_hold_blocks"] = int(math.ceil(h["ci_hi"]))

pnl = [x for t in traces for x in t.pnl_increments()]
L += ["## Normal-operation facts the budget limits will be checked against",
      f"Max |inventory| {max(abs(x) for t in traces for x in t.inventory):.0f} units (pricing cap {pc.max_position}). "
      f"Decision statuses (all seeds): {dict(sum((Counter(t.statuses) for t in traces), Counter()))}.",
      f"Equity change per seed (~5 h each): {[round(t.equity[-1]-t.equity[0],1) for t in traces]}.", ""]

out["_meta"] = {"p_target_per_block": P6, "derived_by": "scripts/stage4_limits.py",
                "assumed_models": {"p_err": P_ERR, "latency": vars(mix), "feed_delay": [FEED_MED, FEED_SIG]},
                "warning": "guard limits only; budget limits (position, daily loss, drawdown, leverage) come from the operator"}
Path("config/risk_guard_limits.json").write_text(json.dumps(out, indent=2) + "\n")
Path("reports/stage4.md").write_text("\n".join(L) + "\n")
print("\n".join(L))
print(f"done {time.time()-t0:.0f}s")

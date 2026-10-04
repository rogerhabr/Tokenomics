# jev-trader — block-speed market maker (paper only)

Math in code, judgment in Jev, final say in the risk engine. Built against a
simulated limit order book (known ground truth), with Jev mocked until a
`TYPESAFE_API_KEY` is available. **No real funds are connected anywhere.**

```bash
cd jev-trader && pip install -e '.[dev]' && python -m pytest -q
```

## Stages
| # | Stage | Status |
|---|---|---|
| 1 | Simulated LOB + state engine (snapshot < 400 tokens, no look-ahead) | ✅ 19 tests, 5/5 mutations caught |
| 2 | Jev decision battery (mock + real SDK adapter, pinned model, `max_retries=0`) | ✅ 36 tests, 10/10 mutations caught |
| 3 | Policy engine + A-S pricing + derived thresholds | ✅ 47 tests, 12/12 mutations caught |
| — | *next: stage 4 (risk engine), awaiting approval* | |
| 3 | Policy engine (thresholds in config, cost-asymmetric) | |
| 4 | Risk engine (hard limits, independent of the model, veto on every order) | |
| 5 | Block loop + fallback ladder (late → hold, Jev down → code rules, breach → flatten) | |
| 6 | Paper fills, logging, calibration + fee-break-even reports | |

## Facts checked against `typesafe-sdk==0.7.2` (not the blog post)
- Default model is `jev-latest`, an unpinned alias. We must pin and assert `response.model`.
- SDK retries 2× with backoff by default, which is fatal inside a 300 ms block. Use `max_retries=0`.
- `ScoreAnswer.score` is an *expected value* (float), not a level; gate on `probabilities`.
- `NoulAnswer` has no `confidence` field; its only signal is distance from 0.5.

## Known limits of stage 1
- The token estimate is a heuristic; the hard cap is chars ≤ 2 × 400. Replace with
  `usage.input_tokens` once a real key exists. Worst case today is 750 chars, so the margin is tight.
- Spread/depth regime signals are partly circular (the sim widens spreads by construction).
  `rv_30s` and `|ret_1m|` are the non-circular evidence.
- `rv_ratio_24h` uses a 24 h EWMA baseline, so it is meaningless for the first hours of a run.

## Stage 2: decision layer
- `decision.py`: battery, pinned config, validator shared by mock and real backend, and statuses
  `ok | late | error | invalid | model_mismatch`. Only `ok` is usable. `direction` is **advisory**:
  it is logged but stripped from `policy_answers()` until calibration shows skill above its base rate.
- `TypeSafeBackend` is tested through the real SDK over `httpx2.MockTransport`: request shape,
  exactly one HTTP call on 503 (the SDK default would make 3), server-side model swap, garbage body,
  and connection failure.
- `sim/mock_jev.py` is a mock with known skill. It reports the exact Bayes posterior of a noisy hint,
  so it is calibrated by construction. `temperature<1` makes it overconfident; `skill=(0,0)` gives it no edge.
- `calibration.py` provides reliability bins, ECE, Brier and Brier skill vs base rate.

Measured on seed 5 (12k blocks):

| mock | toxic ECE | toxic BSS | regime top-1 acc | regime ECE | late |
|---|---|---|---|---|---|
| calibrated | 0.006 | +0.395 | 0.785 | 0.005 | 13.0% |
| overconfident (T=0.4) | 0.073 | +0.350 | 0.785 | 0.119 | 13.0% |
| no edge | 0.004 | 0.000 | **0.676** | 0.005 | 13.4% |

The no-edge mock scores 67.6% regime accuracy by always naming the majority regime.
Raw accuracy is not evidence of skill; only skill over the base rate counts.

The 13% late rate matches the analytic value, 1−Φ(ln(250/150)/0.45). The lognormal latency
model is an assumption until real latencies are logged.

## Stage 3: policy engine
- `pricing.py` holds the Avellaneda-Stoikov reservation price and spread, with gamma derived from
  "skew X bps at max position". Quotes are post-only and capped by position limits. `inventory_pressure`
  is code now: it was arithmetic, so it was removed from the Jev battery (5 questions).
- `policy.py` holds the gates. They work on probabilities, never on `Score.score`. Advisory `direction`
  is provably inert (property test). Unusable decisions go to code-only fallback rules.
  Kill/drawdown checks are **not** here; they belong to the risk engine.
- `sim/derive.py` maximizes markout PnL subject to "accuracy within `acc_tol` of max".
  The grid search uses O(N+G²) difference arrays, proven equal to brute force including exact ties.
  The analytic θ* = G/(G−L) is recovered to within one grid step on synthetic data.
- Fees ("typical on-chain", assumed): maker 0 bp, taker 3.5 bp, replace 0.05 bp/order.
- `scripts/stage3_report.py` → `reports/stage3.md` gives out-of-sample results, paired by seed, with CIs.
  **Headline: in the default sim, quoting at the touch loses money even with a perfect toxicity oracle;
  all modeled profit depends on Jev predicting short-horizon markout.** See the report.

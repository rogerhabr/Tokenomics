# jev-trader — block-speed market maker (paper only)

Math in code, judgment in Jev, final say in the risk engine. Built against a
simulated limit order book (known ground truth), with Jev mocked until a
`TYPESAFE_API_KEY` is available. **No real funds are connected anywhere.**

```bash
cd jev-trader && pip install pytest && python -m pytest -q
```

## Stages
| # | Stage | Status |
|---|---|---|
| 1 | Simulated LOB + state engine (snapshot < 400 tokens, no look-ahead) | ✅ 19 tests, mutation-checked |
| 2 | Jev decision battery (mock + real client, pinned model, `max_retries=0`) | next, awaiting approval |
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

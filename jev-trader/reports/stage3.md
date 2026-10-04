# Stage 3 - derived thresholds, out-of-sample

6 train seeds x 6 test seeds x 6000 blocks (~30 min each). Fees: maker 0.0 bp, replace 0.05 bp/order. PnL in quote ccy, summed over test seeds.
`vs best const` = derived minus the better of always/never-quote *chosen on train*, paired by test seed, ±~95% CI.

| informed x | quote_env skill | G | L | θ* | always | tox-oracle | derived tol=0.02 | vs best const | derived tol=∞ | vs best const | θ (tox, q) tol=∞ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1.0 | none (0) | -0.0023 | -0.0047 | 0.00 | -150.4 | -79.1 | -36.8 | -36.8 ± 19.8 | +0.0 | +0.0 ± 0.0 | (0.0, 0.0) |
| 1.0 | weak (0.1-0.5) | -0.0023 | -0.0047 | 0.00 | -150.4 | -79.1 | -15.2 | -15.2 ± 11.5 | +0.0 | +0.0 ± 0.0 | (0.0, 0.0) |
| 1.0 | strong (0.4-0.95) | -0.0023 | -0.0047 | 0.00 | -150.4 | -79.1 | +33.8 | +33.8 ± 16.3 | +33.8 | +33.8 ± 16.3 | (0.8, 0.35) |
| 0.5 | none (0) | -0.0006 | +0.0004 | 0.00 | -24.2 | -26.7 | -37.6 | -37.6 ± 40.1 | +0.0 | +0.0 ± 0.0 | (0.0, 0.0) |
| 0.5 | weak (0.1-0.5) | -0.0006 | +0.0004 | 0.00 | -24.2 | -26.7 | +6.1 | +6.1 ± 22.2 | +6.1 | +6.1 ± 22.2 | (0.2, 0.5) |
| 0.5 | strong (0.4-0.95) | -0.0006 | +0.0004 | 0.00 | -24.2 | -26.7 | +62.6 | +62.6 ± 11.0 | +62.6 | +62.6 ± 11.0 | (0.15, 0.4) |
| 0.3 | none (0) | +0.0011 | -0.0014 | 0.44 | +41.6 | +41.2 | +13.8 | -27.8 ± 34.9 | +13.8 | -27.8 ± 34.9 | (0.05, 0.0) |
| 0.3 | weak (0.1-0.5) | +0.0011 | -0.0014 | 0.44 | +41.6 | +41.2 | +28.9 | -12.7 ± 44.6 | +28.9 | -12.7 ± 44.6 | (0.1, 0.45) |
| 0.3 | strong (0.4-0.95) | +0.0011 | -0.0014 | 0.44 | +41.6 | +41.2 | +86.9 | +45.3 ± 59.1 | +86.9 | +45.3 ± 59.1 | (0.1, 0.4) |

## Correction (stage 4 start): one-block look-ahead removed
The first version credited a decision made after observing block t with fills from block t's own trades.
Decisions now rest during block t+1 (`test_decision_at_t_is_credited_with_fills_from_t_plus_1_only`).
Effect: L shrank (−0.0074 → −0.0047 at 1.0×; at 0.5× it is now **+0.0004**). A state-based toxicity label
barely predicts next-block loss, and the perfect toxicity oracle fell from −61 to −79. Part of `toxic_flow`'s
apparent value was the look-ahead. The tables above are the corrected run.

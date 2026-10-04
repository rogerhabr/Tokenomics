# Stage 3 - derived thresholds, out-of-sample

6 train seeds x 6 test seeds x 6000 blocks (~30 min each). Fees: maker 0.0 bp, replace 0.05 bp/order. PnL in quote ccy, summed over test seeds.
`vs best const` = derived minus the better of always/never-quote *chosen on train*, paired by test seed, ±~95% CI.

| informed x | quote_env skill | G | L | θ* | always | tox-oracle | derived tol=0.02 | vs best const | derived tol=∞ | vs best const | θ (tox, q) tol=∞ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1.0 | none (0) | +0.0044 | -0.0040 | 0.52 | +127.6 | +145.7 | +23.3 | -104.3 ± 79.9 | +119.3 | -8.3 ± 20.0 | (0.45, 0.0) |
| 1.0 | weak (0.1-0.5) | +0.0044 | -0.0040 | 0.52 | +127.6 | +145.7 | +115.0 | -12.6 ± 27.1 | +122.0 | -5.6 ± 16.3 | (0.65, 0.0) |
| 1.0 | strong (0.4-0.95) | +0.0044 | -0.0040 | 0.52 | +127.6 | +145.7 | +214.5 | +86.9 ± 69.4 | +214.5 | +86.9 ± 69.4 | (0.85, 0.4) |
| 0.5 | none (0) | +0.0051 | +0.0013 | 1.00 | +167.5 | +164.6 | +72.2 | -95.3 ± 130.4 | +111.8 | -55.7 ± 88.4 | (0.55, 0.0) |
| 0.5 | weak (0.1-0.5) | +0.0051 | +0.0013 | 1.00 | +167.5 | +164.6 | +92.3 | -75.1 ± 85.3 | +115.6 | -51.9 ± 87.9 | (0.5, 0.0) |
| 0.5 | strong (0.4-0.95) | +0.0051 | +0.0013 | 1.00 | +167.5 | +164.6 | +157.6 | -9.9 ± 99.2 | +157.6 | -9.9 ± 99.2 | (0.6, 0.4) |
| 0.3 | none (0) | +0.0047 | +0.0024 | 1.00 | +161.1 | +160.0 | +158.9 | -2.2 ± 5.9 | +158.9 | -2.2 ± 5.9 | (0.35, 0.0) |
| 0.3 | weak (0.1-0.5) | +0.0047 | +0.0024 | 1.00 | +161.1 | +160.0 | +109.2 | -51.9 ± 13.4 | +159.5 | -1.6 ± 3.7 | (0.45, 0.0) |
| 0.3 | strong (0.4-0.95) | +0.0047 | +0.0024 | 1.00 | +161.1 | +160.0 | +184.5 | +23.4 ± 21.2 | +184.5 | +23.4 ± 21.2 | (0.45, 0.35) |
## Reading the table (recalibrated simulator, stage 4)
Two corrections happened at stage 4 start, and both are in these numbers:
(a) a one-block look-ahead in the derivation was removed, and (b) the simulator was recalibrated. The old version
had ~8%/day calm vol and trending drift of ~72%/hour, plus informed traders who crossed the spread with no edge.
The previous headline, "quoting at the touch loses even with a perfect toxicity oracle", was an
**artifact of that mis-scaled market** and is withdrawn.

1. **Quoting at the touch is profitable here** (always-quote +128…+168), so the bar for Jev is "beat always-quote".
2. **Toxicity knowledge is worth little.** Only at 1.0× is L < 0 (θ* = 0.52); a *perfect* toxicity oracle adds
   +18 over always-quote (+14%). At ≤0.5× informed flow, "toxic" blocks are still profitable (L > 0, θ* = 1: never pull).
3. **The grid search overfits.** At 0.5× theory says never pull on toxicity, yet the fitted thresholds pull at 0.5–0.6
   and lose out of sample (−55.7 ± 88, n.s.). With no or weak skill the derived policy never significantly beats
   always-quote. Prefer the analytic θ* over fitted values until there is far more data.
4. **"Max accuracy as a condition" has a measurable cost:** −104 ± 80 (1.0×/none) and −51.9 ± 13.4 (0.3×/weak),
   both significant. It forces trading on accurate-but-unprofitable classifications.
5. **Strong `quote_environment` skill pays** (+86.9 ± 69 at 1.0×, +23.4 ± 21 at 0.3×). This still assumes Jev
   predicts next-block markout, which is the edge itself. It is a requirement for Jev to meet, not evidence that it does.

Shipped `config/thresholds.json` = 1.0× / strong / tol 0.02 → (toxic_pull 0.85, quote_both 0.4). It is valid only
if real Jev shows that skill. Otherwise use always-quote with toxic_pull = θ* (0.52 at 1.0×).

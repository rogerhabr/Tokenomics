# Stage 3 - derived thresholds, out-of-sample

6 train seeds x 6 test seeds x 6000 blocks (~30 min each). Fees: maker 0.0 bp, replace 0.05 bp/order. PnL in quote ccy, summed over test seeds.
`vs best const` = derived minus the better of always/never-quote *chosen on train*, paired by test seed, ±~95% CI.

| informed x | quote_env skill | G | L | θ* | always | tox-oracle | derived tol=0.02 | vs best const | derived tol=∞ | vs best const | θ (tox, q) tol=∞ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1.0 | none (0) | -0.0021 | -0.0074 | 0.00 | -150.3 | -61.0 | -36.7 | -36.7 ± 19.9 | +0.0 | +0.0 ± 0.0 | (0.0, 0.0) |
| 1.0 | weak (0.1-0.5) | -0.0021 | -0.0074 | 0.00 | -150.3 | -61.0 | -11.6 | -11.6 ± 9.5 | +0.0 | +0.0 ± 0.0 | (0.0, 0.0) |
| 1.0 | strong (0.4-0.95) | -0.0021 | -0.0074 | 0.00 | -150.3 | -61.0 | +34.5 | +34.5 ± 17.1 | +34.5 | +34.5 ± 17.1 | (0.6, 0.35) |
| 0.5 | none (0) | -0.0006 | -0.0053 | 0.00 | -24.2 | -18.4 | -35.5 | -35.5 ± 39.9 | +0.0 | +0.0 ± 0.0 | (0.0, 0.0) |
| 0.5 | weak (0.1-0.5) | -0.0006 | -0.0053 | 0.00 | -24.2 | -18.4 | +4.2 | +4.2 ± 18.3 | +4.2 | +4.2 ± 18.3 | (0.1, 0.5) |
| 0.5 | strong (0.4-0.95) | -0.0006 | -0.0053 | 0.00 | -24.2 | -18.4 | +65.6 | +65.6 ± 10.0 | +65.6 | +65.6 ± 10.0 | (0.2, 0.4) |
| 0.3 | none (0) | +0.0011 | -0.0077 | 0.13 | +41.6 | +41.8 | +14.5 | -27.1 ± 33.0 | +14.5 | -27.1 ± 33.0 | (0.15, 0.0) |
| 0.3 | weak (0.1-0.5) | +0.0011 | -0.0077 | 0.13 | +41.6 | +41.8 | +33.0 | -8.6 ± 42.4 | +33.0 | -8.6 ± 42.4 | (0.15, 0.45) |
| 0.3 | strong (0.4-0.95) | +0.0011 | -0.0077 | 0.13 | +41.6 | +41.8 | +86.7 | +45.1 ± 54.3 | +86.7 | +45.1 ± 54.3 | (0.15, 0.4) |

## Reading the table
1. **Default market (1.0×): market-making at the touch loses money in both flow classes.** G < 0 and L < 0, so
   θ* = 0 ("never quote"). Even a *perfect* toxicity oracle loses (−61). Toxicity detection cannot rescue a
   strategy whose benign-flow edge is negative. The causes are adverse selection (42% of aggressive volume is
   informed with a 10-block look-ahead) plus replace costs, which take ~40% of the benign edge.
2. **All of the profit comes from the `quote_environment` skill assumption.** Its truth label is the block's
   realized markout, so "strong skill" means "Jev predicts the next ~3 s of quote P&L". That is the edge itself,
   assumed rather than demonstrated. Treat these rows as a **requirement on Jev**, not a forecast:
   weak skill does not separate from the best constant rule at any toxicity level (CIs straddle 0).
3. **The accuracy condition costs money only when Jev has no skill:** −36.7 ± 19.9 at 1.0×/none, where it
   forces quoting. When labels are economic and skill is strong, tol=0.02 and tol=∞ pick identical thresholds.
4. **Theory matches the empirical optimum:** at 0.3×, θ* = 0.13 vs the derived 0.15 (one grid step). It still
   loses to always-quote there, because toxicity knowledge is worth ~0 when G ≈ 0 (oracle +41.8 vs always +41.6).
5. **With no skill and tol=∞, the derivation returns the best constant rule (Δ = 0.0 ± 0.0).** The harness
   does not fabricate edge.

Shipped `config/thresholds.json`: 1.0× / strong / tol=0.02, i.e. (toxic_pull 0.6, quote_both 0.35). It is only
valid if real Jev shows strong skill on an economic quote_environment label; re-derive from logged decisions.

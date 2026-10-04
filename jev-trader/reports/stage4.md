# Stage 4 - guard limits at literal 6σ

Target: P(false trip) ≤ 1−Φ(6) = 9.866e-10 per block per limit (≈1 per 9.6 years at 288k blocks/day).
Exact under the stated model; models marked **ASSUMED** must be replaced by logged measurements.

## API error streak
Model (**ASSUMED**): i.i.d. venue errors, p = 0.01. Limit k = ⌈ln P6 / ln p⌉ = **5** (p^k = 1.0e-10).
MC check (p=0.3, target 1e-3 → k=6): analytic p^k = 7.29e-04, simulated 7.30e-04 over 2,000,000 blocks.

## Decision latency (median of last 10)
Model (**ASSUMED**, = mock): lognormal median 150.0 ms σ 0.45 + 0.5% spikes U(1200,2250) ms. Exact order-statistic tail.
Limit: p50 > **717 ms** (deadline is 250 ms; single late answers are handled by the deadline, this guard catches *persistent* degradation).
MC check at 1e-3: limit 278 ms, simulated exceedance 9.25e-04 over 200,000 windows.

## Data age
Model (**ASSUMED**): feed delay lognormal median 40.0 ms σ 0.5. Exact quantile at z=6: **803 ms**.
Estimator check (what you will run on real logs): fit to 20k samples → 794 ms, 95% CI [772, 821] (covers truth: True).
Consequence: at 6σ the guard (803 ms) is > one block (300 ms). It detects a *dead* feed, not one stale block — single stale blocks are the deadline rule's job (stage 5).

## Reject ratio (post-only rejects, last 50 orders)
Measured in normal operation (12 seeds × 60,000 blocks): 5 rejects / 1,261,089 orders; Wilson 95% upper bound p = 9.28e-06. Exact binomial tail → trip if ratio > **0.04** (> 2 of 50). Assumes independent rejects; clustering would need a wider limit.

## Order size
Deterministic: the pricing code caps every order at quote_size = 50.0. Observed max 50.0. Limit = **50.0**; anything larger is a bug, not a tail event.

## Holding time (blocks since |inventory| ≤ dust)
886 episodes; max observed 12188 blocks. POT exponential tail above u=1178 (β=1670; β above p95 = 1982 — similar: exponential tail plausible).
Limit **34320 blocks** (~172 min), bootstrap 95% CI [27854, 40676]. EXTRAPOLATION: 1e+03× beyond the sample. Using the CI upper bound.

## Normal-operation facts the budget limits will be checked against
Max |inventory| 848 units (pricing cap 1000.0). Decision statuses (all seeds): {'ok': 624484, 'late': 95516}.
Equity change per seed (~5 h each): [35.4, 68.9, 126.2, 38.0, 99.9, 68.4, 44.9, -52.8, 81.5, 111.2, 46.1, 8.7].


## What literal 6σ buys, and what it costs
- The guards are now nearly silent in normal operation (≈1 false trip per decade each), which is the point.
- **The price is detection speed.** A dead feed is caught after 803 ms, persistent Jev slowness only when the
  median of 10 exceeds 717 ms (almost 3× the 250 ms deadline), and a stuck position only after ~3 h.
  Single bad blocks are not the guards' job; the deadline rule and the stage-5 fallback ladder handle them.
- **Every guard is only as good as its ASSUMED model** (venue error rate 1%, feed delay lognormal 40 ms, Jev
  latency = mock). Re-run `scripts/stage4_limits.py` against logged measurements before trusting a number.
- Budget limits (position, daily loss, drawdown, leverage) are **not derived from tails**. They need the
  operator's numbers, and are then checked against normal operation (equity paths above: −53 to +126 per ~5 h on $10k).

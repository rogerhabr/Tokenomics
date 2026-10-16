# 02 — Formula Catalogue

Every number this platform displays is produced by one of the formulae below. Each is a row
in `consulting.formula`, each version is a row in `consulting.formula_version`, and every
computed value stores the `formula_version_id` that produced it (invariant I-7).

**Nothing in this document is a hardwired constant.** Every symbol marked **⚙** is a
configurable parameter stored in the formula's `input_bindings`, scoped and time-effective
via `formula_binding`. The values shown are *seeded defaults*, changeable by `PMO_LEAD`
(or `FINANCE_CONTROLLER` for the EVM and REVENUE domains) through `formula_change_request`.

Implementation target: `src/lib/consulting/engine/**` — pure, deterministic TypeScript, no
model client import anywhere in the tree (invariant I-11).

---

## Domain: SCORING — Phase 1 intake

### F-SC-01 · Criterion normalisation

For criterion *i* with raw value `x_i`, scale `[min_i, max_i]`, direction `d_i`:

```
                ⎧ (x_i − min_i) / (max_i − min_i)        if d_i = HIGHER_BETTER
      n_i  =    ⎨
                ⎩ 1 − (x_i − min_i) / (max_i − min_i)    if d_i = LOWER_BETTER
```

clamped to `[0, 1]`. Degenerate case `max_i = min_i` → `n_i = 0.5` with a warning flag
(a criterion with no spread carries no information; silently returning 0 or 1 would bias
the composite).

### F-SC-02 · Composite opportunity score

```
      S = Σ_i (w_i · n_i) / Σ_i w_i                              S ∈ [0, 1]
```

Weights `w_i` are **not** required to sum to 1 in the data; the denominator normalises.
This matters because adding a criterion must not silently rescale every historical score.

### F-SC-03 · Risk-adjusted score

Two selectable forms (⚙ `risk_mode`):

```
  MULTIPLICATIVE:  S_adj = S · (1 − r)                r ∈ [0,1], r = normalised risk criterion
  EXPECTED_VALUE:  S_adj = S · p_success              p_success from the risk criterion directly
```

Default ⚙ `risk_mode = MULTIPLICATIVE`.

### F-SC-04 · Strategic alignment (the Jira Align import — derived, never typed)

Alignment is the weighted path-sum from an opportunity up through the objective tree:

```
      A = Σ_j ( c_j · W_j )                 over linked objectives j
      
      W_j = Π over ancestors a of j (including j)  of  ŵ_a
      
      ŵ_a = weight_a / Σ(weights of a's siblings)     (normalised within parent)
```

where `c_j ∈ [0,1]` is `opportunity_objective_link.contribution_pct`. `A` is then
normalised to `[0,1]` by F-SC-01 and consumed as a `DERIVED` criterion.

Why this matters: in a typed-score model, "strategic alignment = 5" is an assertion. Here
it is a *traceable path* to a firm-level objective with auditable weights. Two opportunities
cannot both claim maximum alignment to the same objective unless the objective's weight
genuinely supports it.

### F-SC-05 · NPV (⚙ discount rate)

```
      NPV = Σ_{t=0}^{T}  CF_t / (1 + r)^t
```
⚙ `r` = `discount_rate_annual`, default **0.12**, scoped per firm. `t` in years, period
length ⚙ `npv_period` ∈ {MONTH, QUARTER, YEAR} with `r` converted accordingly:
`r_period = (1+r)^(1/periods_per_year) − 1`.

### F-SC-06 · ROI

```
      ROI = (PV_benefits − PV_costs) / PV_costs
```
Both discounted with F-SC-05's rate. Guard: `PV_costs ≤ 0` → undefined, criterion flagged
`INSUFFICIENT_DATA` rather than returning ∞.

### F-SC-07 · Complexity index

```
      X = Σ_k (v_k · u_k) / Σ_k v_k
```
over complexity drivers `k` (⚙ driver set, default: `technical_novelty`,
`integration_count`, `stakeholder_count`, `regulatory_load`, `geographic_spread`,
`client_maturity`), each on a ⚙ 1–5 scale with ⚙ weights.

### F-SC-08 · Priority rank (bang-for-buck)

```
      P = S_adj / I            where I = resource intensity, ⚙ intensity_basis
      
      intensity_basis = PERT_HOURS   →  I = Σ_r h_pert,r / ⚙ hours_normaliser
      intensity_basis = COST         →  I = Σ_r (h_pert,r · cost_rate_r) / ⚙ cost_normaliser
      intensity_basis = SCARCE_ROLE  →  I = max_r ( h_pert,r / available_hours_r )
```

Default ⚙ `intensity_basis = SCARCE_ROLE`. Rationale: in a consulting firm the binding
constraint is almost never money, it is one or two scarce senior roles — which is exactly
the bottleneck Planisware's capacity model is built to expose. Ranking by cost hides that.

### F-SC-09 · Intake blocking test

```
      BLOCKED  ⟺  ∃ i : criterion_i.is_blocking ∧ n_i < block_threshold_i
```
Blocking criteria bypass the composite entirely. A proposal with a fatal flaw must not be
rescued by a high average.

---

## Domain: CAPACITY — resource estimation & feasibility

### F-CP-01 · PERT three-point estimate

```
      E = (O + 4M + P) / 6
      σ = (P − O) / 6
      Var = σ²
```
⚙ `pert_weights = (1, 4, 1)/6`. Triangular alternative (⚙ `estimate_dist = TRIANGULAR`):
`E = (O + M + P)/3`, `σ² = (O² + M² + P² − OM − OP − MP)/18`.

### F-CP-02 · Aggregated estimate uncertainty

```
      E_total = Σ_r E_r
      σ_total = sqrt( Σ_r σ_r²  +  2 Σ_{r<s} ρ_{rs} σ_r σ_s )
```
⚙ `rho_default = 0.3`. **Setting ρ = 0 is the single most common estimation error** — it
assumes role estimates are independent when in reality a scope misunderstanding inflates
every role at once, and it understates total variance by roughly `sqrt(1/n)`. The default
is deliberately non-zero. (Failure mode F-07.)

### F-CP-03 · Role-loaded cost

```
      C = Σ_r ( h_r · cost_rate_r(effective_date) )
```
`cost_rate_r` resolved from the `rate_card` version effective on ⚙ `rate_basis_date`
(default: project `planned_start`, so a plan doesn't drift when rates change mid-flight).

### F-CP-04 · Available hours

```
      H_avail(p, t) = workdays(calendar_p, t) · hours_per_day_p · fte_pct_p(t)
                      − leave_hours(p, t)
```

### F-CP-05 · Committed hours & utilisation

```
      H_comm(p, t) = Σ over assignments a of p overlapping t
                        ( allocation_pct_a · H_avail(p, t) · overlap_fraction(a, t) )

      U(p, t) = H_comm(p, t) / H_avail(p, t)
```

### F-CP-06 · Over-allocation clash

```
      CLASH_RESOURCE(p, t)  ⟺  U(p, t) > ⚙ util_ceiling
      magnitude = ( U(p,t) − util_ceiling ) · H_avail(p,t)        [hours over]
```
⚙ `util_ceiling = 1.00`. ⚙ `util_warn = 0.85` raises a warning-severity clash.

### F-CP-07 · Skill-based bottleneck (the Planisware capacity model)

For role/skill `r` in period `t`, across **all** engagements:

```
      Supply(r, t)  = Σ over people p with skill r at proficiency ≥ ⚙ min_prof
                         H_avail(p, t) · ⚙ skill_productivity(prof_p)
      Demand(r, t)  = Σ over assignments requiring r overlapping t  of planned_hours

      Slack(r, t)   = Supply(r, t) − Demand(r, t)
      Bottleneck    = argmin over (r,t) of  Slack(r,t) / Supply(r,t)
```
⚙ `min_prof = 3`, ⚙ `skill_productivity = {3: 0.8, 4: 1.0, 5: 1.15}`.

### F-CP-08 · Intake feasibility

```
      FEASIBLE  ⟺  min over (r,t) in the proposed window of Slack(r,t) ≥ ⚙ slack_floor
```
⚙ `slack_floor = 0` hours. Reported alongside the binding `(r, t)` pair so the answer is
"infeasible **because** Solution Architects are short 60h in 2026-W14", not just "no".

---

## Domain: SCHEDULE — CPM over FS/SS/FF/SF

All arithmetic is in **working time** resolved through `calendar` + `calendar_exception`.
Calendar-naive date math is a correctness bug, not a simplification.

### F-SD-01 · Forward pass

Topologically order activities. For activity *j* with predecessors *i*:

```
      ES_j = max over predecessors i of:
      
             FS:  EF_i + lag_ij
             SS:  ES_i + lag_ij
             FF:  EF_i + lag_ij − D_j        (constrains finish; back out the start)
             SF:  ES_i + lag_ij − D_j

      ES_j = max( ES_j , constraint_floor_j )       -- SNET / MSO / project start
      EF_j = add_working_days( ES_j , D_j )
```

Activities with no predecessors: `ES_j = max(project_start, constraint_floor_j)`.

### F-SD-02 · Backward pass

```
      LF_i = min over successors j of:
      
             FS:  LS_j − lag_ij
             FF:  LF_j − lag_ij
             SS:  LS_j − lag_ij + D_i
             SF:  LF_j − lag_ij + D_i

      LF_i = min( LF_i , constraint_ceiling_i )     -- FNLT / MFO
      LS_i = sub_working_days( LF_i , D_i )
```
Terminal activities: `LF_i = min(project_required_finish, constraint_ceiling_i)`.

### F-SD-03 · Float

```
      TotalFloat_i = LS_i − ES_i      ( = LF_i − EF_i )
      FreeFloat_i  = min over successors j of ( ES_j ) − EF_i        (FS successors)
      IsCritical_i ⟺ TotalFloat_i ≤ ⚙ critical_float_threshold
```
⚙ `critical_float_threshold = 0` working days. **Negative total float** means the network
cannot meet its constraint — it is a schedule clash, not a valid plan (blocking on G1).

### F-SD-04 · Cycle detection

Kahn topological sort. If `|sorted| < |activities|`, the residual set contains ≥1 cycle;
emit `CLASH_SCHEDULE_CYCLE` with the strongly-connected component enumerated via Tarjan so
the user is told *which* loop, not just that one exists.

### F-SD-05 · Schedule health (blocking criteria on G1)

```
      dangling_count        = |{ a : a has no predecessor ∧ a is not a start milestone }|
                            + |{ a : a has no successor   ∧ a is not an end milestone }|
      cycle_count           = number of SCCs with |SCC| > 1
      negative_float_count  = |{ a : TotalFloat_a < 0 }|
      hard_constraint_count = |{ a : constraint_type ∈ {MSO, MFO, SNLT, FNET} }|
      logic_density         = |dependencies| / |activities|
      missing_resource_count= |{ leaf a : no assignment }|
```
⚙ `logic_density_min = 1.2`, ⚙ `logic_density_max = 3.0`, ⚙ `hard_constraint_max = 3`.

Rationale for logic density: a network with density < 1.2 is under-linked, which produces
fictitious float and a meaningless critical path — the most common way a Gantt chart lies.

---

## Domain: EVM — Phase 3, calibrated for FIXED_PRICE + MILESTONE (DR-03)

### F-EV-01 · Budget at completion

```
      BAC = Σ over baseline_cost rows of planned_amount        (from the ORIGINAL or CURRENT
                                                                baseline — ⚙ bac_basis)
```
⚙ `bac_basis = CURRENT_BASELINE` for performance measurement, but **scope creep is always
measured against `is_original`** (F-EV-13).

### F-EV-02 · Planned value

```
      PV(t) = Σ over baseline_cost rows with period ≤ t of planned_amount
```

### F-EV-03 · Earned value

```
      EV(t) = Σ over activities a of  pct_complete_a(t) · BAC_a
```
where `pct_complete_a` is resolved by the activity's **method** (`F-EV-04`), not by
self-report alone.

### F-EV-04 · Percent-complete methods (⚙ restricted per node type)

| Method | Rule | Permitted on |
|---|---|---|
| `ZERO_HUNDRED` | 0% until complete, then 100% | duration ≤ ⚙ `short_pkg_days` (default 10) |
| `FIFTY_FIFTY` | 50% at start, 100% at finish | duration ≤ 2 × ⚙ `short_pkg_days` |
| `MILESTONE_WEIGHTED` | Σ weights of achieved internal milestones | duration > ⚙ `short_pkg_days` |
| `UNITS` | `units_done / units_total` | countable deliverables |
| `PHYSICAL` | assessed % with mandatory evidence | ⚙ `allow_physical`, requires evidence_note |
| `LOE` | `= PV share elapsed` (always on plan by construction) | only `node_type` in ⚙ `loe_whitelist` |

**This table is the defence against "90% syndrome."** An unrestricted subjective % makes EV
fiction: a PM reports 90% for three months and `SPI` reads healthy while nothing ships.
`LOE` is particularly dangerous because it earns value automatically — it is whitelisted to
named support activities only. Stall detector:

```
      STALLED(a) ⟺ pct_complete_a unchanged over ≥ ⚙ stall_periods (default 3)
                   ∧ pct_complete_a ∈ (0, 100)
```

### F-EV-05 · Actual cost

```
      AC(t) = Σ approved timesheet hours ≤ t · cost_rate(user, entry_date)
            + Σ approved expenses ≤ t
```
Only `state = APPROVED` rows count. Rate resolved at `entry_date`, from the versioned
`rate_card` — so AC does not retroactively change when rates are revised.

### F-EV-06 · Cost variance & CPI

```
      CV   = EV − AC
      CPI  = EV / AC                  undefined for AC = 0 → reported as null, not 1.0
```
Under DR-03 (no T&M) this is a genuine efficiency signal: cost and revenue are decoupled,
so `CPI < 1` directly erodes margin.

### F-EV-07 · Schedule variance & SPI — **with an explicit degeneracy flag**

```
      SV   = EV − PV
      SPI  = EV / PV
      
      spi_degenerate ⟺ EV / BAC ≥ ⚙ spi_degeneracy_point        (default 0.90)
```

**Why the flag exists.** As a project completes, `EV → BAC` and `PV → BAC`, so `SPI → 1.0`
*regardless of how late the project is*. A project delivering three months late finishes
with SPI = 1.00. Any dashboard that reports SPI near completion without this flag reports
"on schedule" for a late project. Past `spi_degeneracy_point` the UI must suppress SPI in
favour of SPI(t).

### F-EV-08 · Earned Schedule — the correct schedule metric

Find the period `k` where the planned curve first reaches current earned value:

```
      k  such that  PV(t_k) ≤ EV(t) < PV(t_{k+1})

      ES = t_k + ( EV(t) − PV(t_k) ) / ( PV(t_{k+1}) − PV(t_k) )        [time units]

      AT     = actual time elapsed from project start to t
      SV(t)  = ES − AT
      SPI(t) = ES / AT
```

`SPI(t)` does **not** degenerate: a project finishing late ends with `SPI(t) = PD / AT < 1`.
This is the metric G2 gates on. Guard: `EV = 0` → `ES = 0`, `SPI(t) = 0`. `EV ≥ BAC` → ES
clamps at planned duration `PD`.

### F-EV-09 · Independent estimated duration

```
      IEAC(t) = PD / SPI(t)                  [working days]
      forecast_finish = add_working_days( project_start , IEAC(t) )
```

### F-EV-10 · Estimate at completion — three selectable methods

```
      EAC_1 = BAC / CPI                              ⚙ CPI_PERSISTS   (past rate continues)
      EAC_2 = AC + (BAC − EV)                        ⚙ AT_PLAN        (remaining work at plan)
      EAC_3 = AC + (BAC − EV) / ( CPI · SPI(t) )     ⚙ COMPOSITE      (cost & schedule drag)
      EAC_4 = AC + ETC_bottom_up                     ⚙ BOTTOM_UP      (re-estimated remainder)
```
⚙ `eac_method = COMPOSITE` by default. Rationale: on fixed-price work schedule slip carries
cost (teams stay mobilised longer), so ignoring SPI(t) in the cost forecast understates EAC
systematically. `BOTTOM_UP` is mandatory (⚙ `force_bottom_up_cpi`, default 0.85) once
`CPI < 0.85` — below that the statistical extrapolations are no longer defensible.

### F-EV-11 · ETC, VAC, TCPI

```
      ETC  = EAC − AC
      VAC  = BAC − EAC
      
      TCPI_BAC = (BAC − EV) / (BAC − AC)
      TCPI_EAC = (BAC − EV) / (EAC − AC)
```
`TCPI_BAC > ⚙ tcpi_credibility (default 1.10)` is reported as *"recovery to budget is not
credible"* — the remaining work would have to be performed 10%+ more efficiently than any
work to date.

### F-EV-12 · Margin — the primary consulting KPI

```
      Margin_planned  = ( ContractValue − BAC ) / ContractValue
      Margin_current  = ( ContractValue − EAC ) / ContractValue
      MarginErosion   = Margin_planned_original − Margin_current
      
      Margin_at_risk  = ContractValue · MarginErosion              [currency]
```
⚙ `margin_floor` (G1 blocking), ⚙ `margin_warn` (G2 warning), ⚙ `margin_critical`
(triggers a `FinancialGuardAgent` escalation proposal). Textbook EVM omits margin entirely;
on fixed-price work it is the only number a director acts on.

### F-EV-13 · Scope creep — always against the ORIGINAL baseline

```
      ScopeCreep_cost = ( BAC_current − BAC_original ) / BAC_original
      ScopeCreep_time = ( PD_current  − PD_original  ) / PD_original
      ScopeCreep_count= |approved change_requests|
      
      CreepVelocity   = ScopeCreep_cost / elapsed_months
```

**Why `is_original` is a one-way flag.** If each approved change request re-baselines and
performance is then measured against the latest baseline, a project that has doubled in cost
reports as permanently on-plan. `baseline.is_original` is set exactly once and the creep
metrics never read anything else. (Failure mode F-16.)

### F-EV-14 · Burn rate & runway

```
      BurnRate(t)  = AC(t) / elapsed_periods(t)                  [currency / period]
      Runway       = ( BAC − AC(t) ) / BurnRate(t)               [periods]
      RunwayAtEAC  = ( EAC − AC(t) ) / BurnRate(t)
      
      BURN_CLASH ⟺ Runway < remaining_planned_periods · ⚙ burn_safety (default 1.0)
```
⚙ `burn_window` ∈ {CUMULATIVE, TRAILING_N} — default `TRAILING_3`, because a cumulative
average lags a ramp-up badly and the warning arrives too late to act on.

---

## Domain: REVENUE — fixed-price & milestone recognition (DR-03)

Inputs are read **only** from a `forecast_version` in state `APPROVED` (failure mode F-14).

### F-RV-01 · Percent-of-completion, cost-to-cost

```
      POC = AC(t) / EAC(t)                                 clamped to [0, 1]
```

### F-RV-02 · Percent-of-completion, effort-based

```
      POC = hours_actual(t) / hours_EAC(t)
```
⚙ `poc_basis ∈ {COST_TO_COST, EFFORT, UNITS, MILESTONE}` per engagement.

### F-RV-03 · Cumulative & period revenue

```
      Revenue_cum(t)    = ContractValue · POC(t)
      Revenue_period(t) = Revenue_cum(t) − Revenue_cum(t−1)
```
`Revenue_period < 0` (POC reversal, usually from an EAC increase) is permitted but flagged
`REVENUE_REVERSAL` — a reversal is a real accounting event and must be visible, not smoothed.

### F-RV-04 · Milestone method — revenue gated by governance

```
      Revenue_cum(t) = Σ over milestone_invoice m with
                            m.gate_instance.state ∈ {PASSED, WAIVED_PASS}
                            ∧ m.gate_instance.decided_at ≤ t
                       of m.amount
```

This is the structural coupling from DR-03: **a milestone is not revenue until its gate has
passed.** A waived pass still recognises, but the waiver is on the ledger with its
justification and its waiver-authority, so the auditor can see exactly which revenue rests
on a waiver rather than a clean pass.

### F-RV-05 · WIP and deferred revenue

```
      WIP(t)      = max( 0 , Revenue_cum(t) − Invoiced_cum(t) )      [contract asset]
      Deferred(t) = max( 0 , Invoiced_cum(t) − Revenue_cum(t) )      [contract liability]
```
Exactly one is non-zero at any time.

### F-RV-06 · Onerous contract test (IFRS 15 / ASC 606)

```
      Onerous ⟺ EAC(t) > ContractValue
      
      ExpectedLoss   = EAC(t) − ContractValue
      LossProvision  = ExpectedLoss − LossAlreadyRecognised(t)
```

The **entire** expected loss is provisioned in the period the test first turns true — not
amortised over the remaining life. This is a mandatory accounting treatment for a loss-making
fixed-price contract and the only reason it belongs in a delivery tracker is that the
delivery tracker is where EAC lives. `revenue_recognition.onerous = true` is a blocking
criterion on G2 unless the provision is booked.

### F-RV-07 · Engagement-level realised margin

```
      Margin_realised(t) = ( Revenue_cum(t) − AC(t) ) / Revenue_cum(t)
```
Distinguished from F-EV-12's forecast margin. Divergence between the two is itself a
monitored signal: a large gap means POC and cost performance are telling different stories.

---

## Domain: QUALITY — Phase 4

### F-QA-01 · Defect density (⚙ size basis, not hardwired)

```
      Density = DefectCount / SizeMeasure
      
      ⚙ size_basis = WORK_PACKAGES  →  SizeMeasure = |leaf wbs_nodes in scope|
      ⚙ size_basis = TEST_CASES     →  SizeMeasure = |test_cases in scope|
      ⚙ size_basis = KLOC           →  SizeMeasure = lines_of_code / 1000
      ⚙ size_basis = FUNCTION_POINTS→  SizeMeasure = fp_count
```
Default ⚙ `size_basis = WORK_PACKAGES` — it is the only one always available in a
consulting context and it keeps density traceable to the WBS.

### F-QA-02 · Severity-weighted density

```
      WeightedDensity = Σ_s ( count_s · ⚙ sev_weight_s ) / SizeMeasure
```
⚙ `sev_weight = {S1: 10, S2: 5, S3: 2, S4: 1}`. Unweighted density lets 40 cosmetic defects
mask 2 critical ones.

### F-QA-03 · UAT pass rate

```
      PassRate = |PASS| / ( |PASS| + |FAIL| )
```
`BLOCKED` runs are excluded from the denominator but counted separately — a high pass rate
with many blocked cases is a false signal, so `BlockedRate = |BLOCKED| / |total|` is
reported alongside and ⚙ `blocked_rate_max` is a G3 criterion.

### F-QA-04 · Defect removal efficiency

```
      DRE = D_pre / ( D_pre + D_post )
```
`D_post` = defects with `is_leakage = true`. Computable only after release, so it is a
post-mortem and calibration metric, not a gate criterion.

### F-QA-05 · Defect arrival forecast — the forward-looking QA signal

Fit an exponential (NHPP / Goel-Okumoto) arrival curve to cumulative defects found:

```
      N(t) = N_∞ · ( 1 − e^(−λt) )
      
      fit (N_∞, λ) by least squares on observed cumulative counts
      
      PredictedRemaining = N_∞ − N(t_now)
      
      t_to_target: solve  N_∞ (1 − e^(−λ t)) = N_∞ − ⚙ residual_max   for t
```
⚙ `arrival_model ∈ {GOEL_OKUMOTO, RAYLEIGH, WEIBULL}`, default `GOEL_OKUMOTO`.
Minimum ⚙ `min_fit_points = 5` cycles before the fit is reported; below that it returns
`INSUFFICIENT_DATA` rather than a confident-looking extrapolation from 2 points.

`PredictedRemaining` is a G3 criterion — it answers "are we finding fewer defects because
the software is clean, or because we stopped testing?"

### F-QA-06 · Reopen rate & MTTR

```
      ReopenRate = |defects with reopen_count > 0| / |closed defects|
      MTTR_s     = mean( closed_at − opened_at )  over severity s
      Aging_s    = mean( now − opened_at )        over open defects of severity s
```
⚙ `reopen_rate_max` on G3. A high reopen rate invalidates the pass rate: cases are being
signed off on fixes that do not hold.

### F-QA-07 · Traceability coverage

```
      Coverage = |baselined deliverables with ≥1 executed UAT case| / |baselined deliverables|
```
Computed against `baseline_scope`, not the live WBS — so scope quietly dropped during
execution shows up as an uncovered deliverable rather than vanishing from the denominator.

---

## Domain: RISK — foresight & forward clash detection

### F-RK-01 · Monte Carlo schedule & cost simulation

```
      for n in 1..N:                                      ⚙ iterations, default 10 000
          sample a global drag factor  g_n ~ LogNormal(μ_g, σ_g)        ⚙ correlation driver
          for each activity a:
              z_a   ~ Normal(0,1)
              D_a,n = max( ⚙ min_duration ,
                           E_a + σ_a · ( sqrt(ρ)·g_n + sqrt(1−ρ)·z_a ) )
          run F-SD-01 forward pass with D_·,n   →  finish_n
          C_n = Σ_a D_a,n · burn_a
      
      P50 = quantile(finish, 0.50)      P80 = quantile(finish, 0.80)
      P(breach) = |{ n : finish_n > contract_milestone_date }| / N
```

⚙ `rho = 0.3`, ⚙ `seed` stored on `foresight_run` so **any run is exactly reproducible**
— this is the determinism proof for the agent layer.

**The single-factor correlation structure is deliberate.** Independent sampling (ρ = 0)
produces a P80 that is far too optimistic, because real schedule overruns are correlated:
one scope misunderstanding, one key person leaving, or one late client decision moves many
activities together. Documented limitation: even with ρ = 0.3 the P80 should be treated as
a floor, not a ceiling. (Failure mode F-07.)

### F-RK-02 · Forward resource clash (cross-engagement)

Run F-CP-05 over the **projected** schedule from each project's current EAC-driven forecast
rather than its baseline:

```
      FORECAST_CLASH(p, t) ⟺ U_projected(p, t) > ⚙ util_ceiling
                             ∧ t > now
      
      lead_time = t − now                        [days of warning]
      probability = P( U(p,t) > util_ceiling )   from the F-RK-01 iteration set
```
Horizon ⚙ `foresight_days = 180`. Clash severity scales with `magnitude × probability ÷
lead_time` — a 90%-likely clash in two weeks outranks a 30%-likely clash in five months.

### F-RK-03 · Gate-date breach probability

```
      P(gate breach) = |{ n : forecast_gate_date_n > required_gate_date }| / N
```
Per gate, so a director sees "G3 is 62% likely to miss the contractual UAT date" rather
than a single project-level number.

### F-RK-04 · Clash priority score

```
      Priority = ( ⚙ w_sev · sev_norm + ⚙ w_mag · mag_norm + ⚙ w_prob · probability )
                 / ( 1 + ⚙ w_lead · lead_norm )
```
Used to rank what reaches a human. Deliberately a formula in the registry rather than code,
because the right ranking is firm-specific and will need tuning against acceptance rates
(see `03-AGENT-ARCHITECTURE.md` §5).

---

## Domain: GOVERNANCE — gate & audit metrics

### F-GV-01 · Gate readiness

```
      Readiness = |passed blocking criteria| / |blocking criteria|
      Ready ⟺ Readiness = 1.0  ∧  all required signoffs present & valid
```

### F-GV-02 · Signoff latency (rubber-stamp detector)

```
      latency = signed_at − gate_instance.opened_at
      
      RUBBER_STAMP_SUSPECT ⟺ latency < ⚙ min_review_seconds (default 60)
                             ∨ ApprovalsPerDay(signer) > ⚙ max_approvals_per_day
```
Not a block — a monitored, reported signal. Gate theatre is the most common way a hard-gate
system decays into a formality. (Failure mode F-02.)

### F-GV-03 · Gate cycle time & return rate

```
      CycleTime  = decided_at − opened_at
      ReturnRate = |gate_instances with cycle > 1| / |gate_instances|
```

### F-GV-04 · Audit chain verification

```
      valid ⟺ ∀ seq s > first:  row_hash_s = sha256( row_hash_{s−1} ‖ payload_s )
```
Walked nightly; `ledger_checkpoint.root_hash` anchors the verified prefix.

### F-GV-05 · Waiver exposure

```
      WaiverExposure = Σ over active waivers of ( criterion_weight · ⚙ waiver_risk_factor )
      RevenueOnWaiver= Σ milestone_invoice.amount where gate_instance.state = 'WAIVED_PASS'
```
`RevenueOnWaiver` is the number an external auditor will ask for first. It is a first-class
dashboard metric, not a query someone has to invent.

---

## Seeded parameter defaults (all editable via `formula_binding`)

| ⚙ Parameter | Default | Domain | Gate use |
|---|---|---|---|
| `discount_rate_annual` | 0.12 | SCORING | — |
| `intake_score_floor` | 0.60 | SCORING | G0 blocking |
| `director_threshold` | *firm-set* | SCORING | G0 signer selection |
| `risk_mode` | MULTIPLICATIVE | SCORING | — |
| `intensity_basis` | SCARCE_ROLE | SCORING | — |
| `pert_weights` | (1,4,1)/6 | CAPACITY | — |
| `rho_default` | 0.30 | CAPACITY/RISK | — |
| `util_ceiling` / `util_warn` | 1.00 / 0.85 | CAPACITY | clash thresholds |
| `min_prof` | 3 | CAPACITY | — |
| `slack_floor` | 0 h | CAPACITY | G0 blocking |
| `critical_float_threshold` | 0 d | SCHEDULE | — |
| `logic_density_min` / `max` | 1.2 / 3.0 | SCHEDULE | G1 blocking |
| `hard_constraint_max` | 3 | SCHEDULE | G1 blocking |
| `short_pkg_days` | 10 | EVM | method restriction |
| `stall_periods` | 3 | EVM | stall detector |
| `spi_degeneracy_point` | 0.90 | EVM | SPI suppression |
| `eac_method` | COMPOSITE | EVM | — |
| `force_bottom_up_cpi` | 0.85 | EVM | forecast method switch |
| `tcpi_credibility` | 1.10 | EVM | reported warning |
| `margin_floor` | *firm-set* | EVM | G1 blocking |
| `margin_warn` / `margin_critical` | *firm-set* | EVM | G2 warning / escalation |
| `burn_window` | TRAILING_3 | EVM | — |
| `burn_safety` | 1.00 | EVM | burn clash |
| `poc_basis` | COST_TO_COST | REVENUE | per engagement |
| `size_basis` | WORK_PACKAGES | QUALITY | — |
| `sev_weight` | S1:10 S2:5 S3:2 S4:1 | QUALITY | — |
| `uat_pass_floor` | 0.95 | QUALITY | G3 blocking |
| `open_s2_max` | 0 | QUALITY | G3 blocking |
| `density_ceiling` | *firm-set* | QUALITY | G3 blocking |
| `residual_max` | *firm-set* | QUALITY | G3 blocking |
| `blocked_rate_max` | 0.05 | QUALITY | G3 blocking |
| `reopen_rate_max` | 0.10 | QUALITY | G3 blocking |
| `arrival_model` | GOEL_OKUMOTO | QUALITY | — |
| `min_fit_points` | 5 | QUALITY | — |
| `iterations` | 10 000 | RISK | — |
| `foresight_days` | 180 | RISK | — |
| `min_review_seconds` | 60 | GOVERNANCE | monitored |
| `max_approvals_per_day` | 10 | GOVERNANCE | monitored |

---

## Formula → consumer map

| Formula | Written to | Read by |
|---|---|---|
| F-SC-01..09 | `opportunity_score`, `opportunity.score_total`, `priority_rank` | G0, IntakeTriageAgent |
| F-CP-01..03 | `resource_estimate` | G0, EstimationAgent, F-EV-01 |
| F-CP-04..08 | `capacity_snapshot`, `intake_feasibility` | G0, ResourceClashAgent |
| F-SD-01..05 | `activity.es/ef/ls/lf/float`, `schedule_health` | G1, ScheduleAgent, F-RK-01 |
| F-EV-01..14 | `evm_snapshot`, `forecast_version` | G2, FinancialGuardAgent, F-RV-01 |
| F-RV-01..07 | `revenue_recognition`, `milestone_invoice` | G2, G4, FinancialGuardAgent |
| F-QA-01..07 | `defect_metric`, `test_coverage` | G2, G3, QAAgent |
| F-RK-01..04 | `foresight_run`, `clash` | ForesightAgent, ResourceClashAgent |
| F-GV-01..05 | `gate_criterion_result`, dashboards | GateKeeperAgent, AuditSentinelAgent |

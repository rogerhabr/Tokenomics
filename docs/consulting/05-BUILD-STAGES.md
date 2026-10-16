# 05 — Build Stages, Inter-Stage Contracts & Validation Protocol

Six stages. Each has a **hard acceptance gate** — fittingly, the platform is built the way
it governs. Nothing proceeds on "it compiles"; each stage must produce a stated proof.

```
 STAGE 0 ─► STAGE 1 ─► STAGE 2 ─► STAGE 3 ─► STAGE 4 ─► STAGE 5
 Architecture  Schema     Engine    Governance   Agents     UI
 (docs)        + RLS      (pure TS) + API        + loops    + giant chart
    ▲            ▲           ▲          ▲           ▲          ▲
    │            │           │          │           │          │
  your        negative    determinism attempt-   determinism  perf +
  sign-off    RLS suite   + backtest  to-cheat   + flood      E2E
                          proofs      suite      control      example
```

---

## Inter-stage contracts

Each stage consumes only the previous stages' published interfaces. This is what makes the
stages independently testable and what "link all stages" means concretely.

| Producer | Contract artefact | Consumer |
|---|---|---|
| Stage 1 | `supabase/migrations/00xx_consulting_*.sql` + generated TS types in `src/lib/consulting/types.ts` | 2, 3, 4, 5 |
| Stage 1 | `consulting.advance_phase()` and the trigger set | 3 |
| Stage 2 | `src/lib/consulting/engine/index.ts` — pure functions, explicit input/output types, zero I/O | 3, 4, 5 |
| Stage 2 | `fixtures/` — the seeded 3-client / 24-month dataset | 3, 4, 5, backtest |
| Stage 3 | `src/app/api/consulting/**` route handlers; `GateService`, `BaselineService`, `ForecastService` | 4, 5 |
| Stage 4 | `agent_proposal` / `agent_finding` / `clash` row contracts; dispatch endpoint | 5 |
| Stage 5 | route group `src/app/(consulting)/**` | — |

**Rule:** no stage reaches into a lower stage's internals. Stage 5 never computes EVM; it
reads `evm_snapshot`. Stage 4 never computes CPI; it calls `engine/evm.ts`. Violations are
caught by the import-graph CI check (invariant I-11 generalised).

---

## Stage 1 — Schema, RLS, Audit Ledger

**Build**

- `supabase/migrations/0002_consulting_core.sql` → Layers A, B (tenancy, org tree, roles, client, engagement, barrier)
- `0003_consulting_delivery.sql` → Layers C–G (intake, scoping, execution, QA, deployment)
- `0004_consulting_governance.sql` → Layer H (phases, gates, signoffs, formula registry, audit ledger)
- `0005_consulting_agents.sql` → Layer I
- `0006_consulting_rls.sql` → every policy, every barrier view
- `0007_fix_profiles_role_escalation.sql` → **F-17**, the live defect
- `0008_seed_governance.sql` → seeded phases, gates, criteria, roles, formulae (all data, nothing compiled)

**Acceptance gate — all must pass**

| Proof | Method |
|---|---|
| Every table has RLS enabled | query `pg_tables` ⋈ `pg_policies`; zero tables without a policy |
| **Negative RLS suite** | for each delivery table: a non-member user gets **0 rows** — via direct select, via every barrier view, via every RPC |
| Aggregate barrier holds (**F-11**) | a walled user's utilisation/margin query result is **unchanged** when the walled client's data changes |
| k-anonymity floor | cross-client aggregate below ⚙ `k_min` returns suppressed, not partial |
| Ledger is append-only (**F-10**) | `UPDATE` and `DELETE` attempts raise, as `postgres` **and** as `service_role` |
| Hash chain computed in-DB | insert rows via raw SQL bypassing the app; chain still verifies |
| Phase is trigger-protected (**I-1, F-15**) | direct `UPDATE project SET current_phase` raises |
| `profiles.role` escalation closed (**F-17**) | `update profiles set role='admin'` as an authenticated user is rejected |
| Service-key confinement (**F-01**) | CI grep: `service_role` appears only under `src/lib/consulting/privileged/` |
| Money integrity (**I-14**) | summing mixed currencies without `fx_rate_version_id` raises |

---

## Stage 2 — The Calculation Engine (no UI, no DB)

**Build** — `src/lib/consulting/engine/`

| Module | Implements | Key risk addressed |
|---|---|---|
| `formulaEval.ts` | AST evaluator for `formula_version.expression_ast`; whitelisted operators only | registry is real, not decorative |
| `scoring.ts` | F-SC-01..09 | — |
| `objectives.ts` | F-SC-04 alignment rollup | Jira Align import |
| `capacity.ts` | F-CP-01..08 | F-07 (ρ), bottleneck detection |
| `calendar.ts` | working-day arithmetic, exceptions, timezones | F-19 |
| `cpm.ts` | F-SD-01..05, all four dependency types, Tarjan SCC | F-06 |
| `evm.ts` | F-EV-01..07, F-EV-10..14 | F-05, F-16 |
| `earnedSchedule.ts` | F-EV-08, F-EV-09 | SPI degeneracy |
| `revenue.ts` | F-RV-01..07 incl. onerous test | F-14 |
| `quality.ts` | F-QA-01..07 incl. arrival-curve fit | — |
| `montecarlo.ts` | F-RK-01..03, seeded, ρ-correlated | F-07 |
| `clash.ts` | F-RK-04 + clash taxonomy | — |
| `governance.ts` | F-GV-01..05 | F-02 |

Hard constraints: no model client, no `fetch`, no `Date.now()`, no unseeded `Math.random()`.
Time and randomness are **injected parameters**.

**Acceptance gate**

| Proof | Method |
|---|---|
| Determinism | every engine function run twice on a fixture → byte-identical output |
| Seeded reproducibility | same `seed` + inputs → identical Monte Carlo quantiles |
| Purity (**I-11, F-09**) | import-graph CI check fails on any AI SDK / network / ambient-clock reach |
| CPM correctness | hand-computed reference networks for FS, SS, FF, SF, lags, all 8 constraint types, calendars with holidays |
| CPM cycle detection | known-cyclic network → correct SCC enumerated |
| EVM correctness | PMI reference examples reproduce to 1e-9 |
| **Earned Schedule proves the SPI fix** | a project 30% late at 95% complete: assert `SPI ≈ 1.00` **and** `SPI(t) < 0.8` **and** `spi_degenerate = true`. This is the headline Stage 2 proof. |
| Onerous test | `EAC > ContractValue` → full loss provisioned in that period, not amortised |
| Scope-creep anchoring (**F-16**) | three successive re-baselines → creep still measured vs `is_original` |
| ρ sensitivity (**F-07**) | same network at ρ=0 vs ρ=0.3 → assert P80 spread widens materially; document the delta |
| Formula versioning (**F-01b**) | a recomputed value stamped with v2 does not alter the v1 row |
| Degenerate-input handling | `AC=0`, `PV=0`, `max=min`, 2-point defect fit, empty WBS → null/`INSUFFICIENT_DATA`, never a plausible-looking number |

---

## Stage 3 — State Machine, Gates & API

**Build**

- `consulting.advance_phase()` with the full six-step validation (01 §10.3)
- SoD, four-eyes, waiver-authority, role-validity-at-signing triggers (I-3..I-6)
- `GateService` — open, evaluate, sign, return, waive
- `BaselineService` — take, re-baseline via `change_request`, lineage
- `ForecastService` — versioned forecasts; rev-rec reads `APPROVED` only
- `FormulaRegistryService` — change request → test run → activation
- Route handlers under `src/app/api/consulting/**`, all cookie-bound (CLAUDE.md pattern)

**Acceptance gate — the attempt-to-cheat suite.** Every one of these must be *refused*:

| Attack | Defence |
|---|---|
| Advance a phase with no gate instance | I-2 |
| Advance with a gate in `IN_REVIEW` | I-2 |
| Advance after a previously-passed criterion turns red | state machine step 3 — gates don't go stale |
| Sign while holding the role outside its validity window | I-3 |
| Sign a gate on an artefact you authored | I-4 |
| Satisfy four-eyes with one person signing twice | I-5 |
| Satisfy four-eyes via your own delegate | I-5 + F-18 |
| Delegate a delegation (depth 2) | F-18 |
| Waive with equal `authority_rank` | I-6 |
| Waive a QA criterion as `FINANCE_CONTROLLER` | domain-scoped waiver |
| Edit a baseline row after G1 | I-10 |
| Re-baseline without an approved change request | I-10 |
| Activate a formula version with a failing test case | I-8 |
| Activate a formula version with no approved change request | F-01b |
| Recognise revenue from a `DRAFT` forecast | F-14 |
| Invoice a milestone whose gate has not passed | DR-03 / F-RV-04 |
| Enter a timesheet into a locked period | F-04 |
| Approve your own timesheet | F-04 |
| Mutate `audit_ledger` | I-9 / F-10 |
| Advance a phase without a ledger row in the same txn | I-15 |

Each refusal must be the *correct* refusal, with a specific error — not a generic 500.

---

## Stage 4 — Agent Layer & Feedback Loops

**Build** — `src/lib/consulting/agents/`

- `runtime.ts` — run lifecycle, hashing, cost accounting, budget enforcement
- `dispatch.ts` — event + cron entry point
- `proposal.ts` — the L2 contract: diff → **engine-computed** `expected_effect_json` → insert
- `calibration.ts` — acceptance rates, auto-demotion
- `a01`..`a10` — the ten agents (03 §3)
- `src/app/api/consulting/agents/dispatch/route.ts`

**Acceptance gate**

| Proof | Method |
|---|---|
| L2 containment (**DR-04**) | no agent code path writes a delivery table; only metric tables + findings/proposals |
| L4 impossibility | attempting an agent signoff fails on the FK to `app_user` |
| Human attribution | on Accept, `audit_ledger.actor_user_id` = the human, `actor_agent_id` = originator |
| No agent arithmetic (**F-09**) | every numeric field in a proposal traces to an engine call; schema test asserts no LLM-sourced numerics |
| Reproducible runs | identical `input_hash` + `engine_version` + `formula_versions` + `seed` → identical engine-phase output |
| Flood control (**F-08**) | simulate 20 engagements × 30 nightly sweeps: assert per-agent daily cap honoured, dedupe collapses repeats into `occurrence_count`, and total proposals/role/day ≤ ⚙ budget |
| Auto-demotion | drive acceptance below ⚙ `demote_floor` → agent demotes to L1 and is flagged |
| Silence | a fully healthy portfolio produces **zero** findings for a full sweep |
| Calibration cannot self-apply | PostMortemAgent's parameter change requires `formula_change_request` approval |
| Conflict-of-interest handling | a reallocation across a live conflict group is never *proposed*; it surfaces as a `PMO_LEAD` finding |
| No person-level blame (**03 §4.4**) | findings reference activities/roles/WBS; no `root_cause_person` field exists |
| Forward clash lead time | seeded scenario with a known future collision → detected ≥ ⚙ `min_lead_days` ahead with correct magnitude |

---

## Stage 5 — Interactive Platform

**Build** — `src/app/(consulting)/`

| Surface | Content |
|---|---|
| **Portfolio Command Canvas** (the giant chart) | §4 below |
| Phase 1 — Intake | scoring matrix with live weight sliders, objective-tree alignment viewer, PERT estimator, feasibility verdict with the binding `(role, period)` named |
| Phase 2 — Scoping | WBS tree editor, dependency network editor, CPM result with critical path, schedule-health panel, baseline snapshot & lineage |
| Phase 3 — Execution | EVM dashboard (CPI, SPI, **SPI(t)** with SPI suppressed past the degeneracy point), burn-rate & runway, margin gauge, timesheet entry & approval, revenue/WIP/onerous panel |
| Phase 4 — QA | UAT log, defect board, density & severity-weighted density, arrival-curve forecast with predicted UAT-ready date |
| Phase 5 — Deployment | checklist with verification evidence, handover pack generator, client signoff, post-mortem form |
| **Gate Console** | per-gate criterion grid (value · threshold · pass · formula version), signoff panel, waiver flow, readiness report, signoff-latency telemetry |
| **Proposal Inbox** | per-role L2 queue: diff viewer, rationale, engine-computed effect, Accept / Reject-with-reason |
| **Clash Radar** | current vs forecast clashes on a time axis, ranked by F-RK-04, with lead time and probability |
| **Formula Registry** | browse/edit formulae, run test cases, raise a change request, version history |
| **Audit Explorer** | ledger with live chain-verification status, waiver register, `RevenueOnWaiver` |
| **Flow Schema** | §5 |
| **Brain Maps** | §6 |

Styling follows the repo's `sa-*` Tailwind tokens and `font-mono` for numerics (CLAUDE.md).

**Acceptance gate**

| Proof | Method |
|---|---|
| Performance (**F-13**) | 20 engagements × 300 activities: first paint < 1.5 s, sustained 30 fps pan/zoom — tested on the backtest dataset, not a toy fixture |
| No client-side computation | the client receives positioned geometry and snapshot rows; zero EVM/CPM math in React |
| Barrier in the UI (**F-11**) | a walled user sees "committed elsewhere" grey blocks, never the other client's identity |
| SPI suppression | past `spi_degeneracy_point` the UI shows SPI(t) and hides raw SPI |
| Formula provenance | every displayed metric exposes its `formula_version_id` on hover |
| E2E worked example | §7, end to end, all five phases, all four gates |
| `npm run build` + `npm run lint` clean | CLAUDE.md requirement |

---

## 4. The Giant Chart — Portfolio Command Canvas

One pan/zoom canvas. Swimlane per engagement, time on the x-axis, **layers toggleable**:

| Layer | Renders | Source |
|---|---|---|
| **Baseline ghost** | translucent bars at original-baseline dates | `baseline_activity` (`is_original`) |
| **Current plan** | solid bars at CPM dates | `activity.es/ef` |
| **Forecast** | dashed bars at EAC-driven forecast dates | `forecast_version` |
| **P50 / P80 band** | shaded envelope behind each bar | `foresight_run` |
| **Critical path** | highlighted chain | `activity.is_critical` |
| **Dependency arcs** | FS/SS/FF/SF arcs, rendered below ⚙ `arc_render_threshold` | `dependency` |
| **Gate diamonds** | ◆ per gate, coloured by state, hollow for not-yet-opened | `gate_instance` |
| **Resource heat strip** | per-person / per-role utilisation band under each lane; red above `util_ceiling` | `capacity_snapshot` |
| **EVM sparkline** | CPI & SPI(t) micro-trend per engagement | `evm_snapshot` |
| **Margin gauge** | per-engagement margin vs floor, in the lane header | `evm_snapshot.margin_pct` |
| **Clash markers** | ● current, ○ forecast (opacity = probability) | `clash` |
| **Milestone revenue** | ▲ at each billable milestone, filled once its gate passes | `milestone_invoice` |
| **Scope-creep staircase** | step line showing BAC growth vs original | `baseline` lineage |

**Level of detail by zoom:** engagement roll-up bars (wide) → work packages (medium) →
activities + arcs (narrow). Layout is computed server-side and cached per
`(project, baseline_id, forecast_version_id)`. Renderer is canvas with virtualisation —
Recharts is used only for the small per-project panels.

Why one canvas: the clashes this platform exists to catch are *cross-engagement*. Per-project
Gantts structurally cannot show them — a resource collision between PRJ-098 and PRJ-112 is
invisible on either project's own chart.

---

## 5. Flow Schema

An inline SVG rendering of the live state machine, generated **from** `phase_def` /
`gate_def` / `gate_criterion` rather than hand-drawn — so it cannot drift from the enforced
machine. Shows:

- the five phases and the `CLOSED` terminal state
- G0–G4 with their criterion counts and blocking counts
- required signer roles per gate, with four-eyes marked
- back-transitions (`REWORK`) and their authorising roles
- `ON_HOLD` / `CANCELLED` edges
- live overlay: for a selected project, where it is, which criteria are red, and which
  signoffs are outstanding

A static picture of a state machine that is enforced in the database will eventually lie.
Generating it from the same rows the machine reads means it cannot.

---

## 6. Brain Maps

Six radial maps — one per phase plus a master — each showing, for its phase:

```
            ┌─ Entities ──────────── the tables written in this phase
            ├─ Formulae ─────────── F-xx ids, with ⚙ parameters
   PHASE ───┼─ Gate ──────────────── criteria, thresholds, signer roles
            ├─ Agents ────────────── which agents fire, at which level, to which role
            ├─ Clash types ───────── what can collide here, current & forecast
            └─ Failure modes ─────── F-xx FMEA ids that bite in this phase
```

The master map adds the cross-cutting layers (formula registry, audit ledger, RLS barrier,
agent runtime) and the inter-stage contracts. Rendered as interactive SVG — clicking a node
navigates to that entity, formula, agent or FMEA entry. Each map is **generated from the
schema and the formula registry**, so it stays current.

---

## 7. The Worked Example — "Meridian Health · Claims Platform Modernisation"

One engagement driven end-to-end, used as the Stage 5 E2E test and the demo.

| | |
|---|---|
| Client | Meridian Health Group (conflict group: `PAYER_SECTOR`, which also contains a competitor client — so the barrier is exercised) |
| Contract | `FIXED_PRICE`, value set in seed data (**not** in code), `poc_basis = COST_TO_COST` |
| Shape | 5 deliverables, ~60 activities, 4 roles, 9 people, 2 milestones, 11 months |
| Designed to exercise | a G1 return, an approved change request, a CPI dip, a forecast resource clash with a second engagement, an S1 defect blocking G3, and one criterion waiver at G4 |

**Narrative path**

1. **Intake.** Opportunity submitted. IntakeTriageAgent proposes criterion values; `PMO_LEAD`
   accepts two, rejects one with a reason. Alignment computed from the objective tree (F-SC-04).
   `conflict_check` flags the competitor client → `PMO_LEAD` records a staffing exclusion
   rather than a waiver. **G0 passes** (PMO + Director, value above threshold).
2. **Scoping.** WBS decomposed. ScheduleAgent flags 3 dangling activities and 1 FS/SS cycle →
   proposals accepted. First G1 attempt is **RETURNED**: `logic_density = 0.9` below the floor
   and planned margin below `margin_floor`. Scope trimmed, re-planned, original baseline taken.
   **G1 passes** (Eng. Manager + Finance Controller + Client Sponsor, four-eyes satisfied).
3. **Execution.** Timesheets and progress flow. Month 4: CPI drops to 0.88.
   FinancialGuardAgent proposes a `COMPOSITE`→`BOTTOM_UP` forecast switch (CPI below
   `force_bottom_up_cpi`); Finance Controller accepts. Month 5: a change request adds a
   deliverable → new baseline v2; **scope creep still measured against v1** (F-16 demonstrated
   live). Month 6: ForesightAgent detects a **forecast** Solution Architect collision with a
   second engagement in month 8 — 47 days of lead time, P = 0.71. `ENGAGEMENT_MANAGER` accepts
   a reallocation that reduces P(G3 breach) from 0.58 to 0.19.
   **G2 passes** with an attached SPI(t) variance explanation.
4. **QA.** 180 UAT cases. Two cycles. Arrival curve (F-QA-05) predicts 6 residual defects
   against a ceiling of 4 → QAAgent proposes a third cycle. One S1 defect holds **G3 closed**
   until fixed and retested. Client UAT approver signs against a `scope_hash` matching baseline v2.
   **G3 passes.**
5. **Deployment.** Checklist: 22 items, 4 automated. One non-blocking documentation item is
   **waived** by the `DIRECTOR` with justification → appears in the waiver register and in
   `RevenueOnWaiver`. Handover pack generated and hashed. Both milestones' gates passed →
   full contract value recognised, WIP clears to zero. **G4 passes.**
6. **Post-mortem.** PostMortemAgent decomposes variance: estimation optimism concentrated in
   one role, measured activity-overrun correlation of 0.41 vs the seeded ⚙ `rho_default` of
   0.30. It raises a `formula_change_request` to move ρ to 0.41 — **validated walk-forward
   first**, and it does not auto-apply. `PMO_LEAD` approves. Loop 4 closes.

Every number in this example comes from seed data and the formula registry. **Nothing is
hardwired** — changing `margin_floor` in the seed changes whether G1 returns, without a code
change. That is the demonstration that the registry is real.

---

## 8. Back Test & Forward Pass Protocol

The two phrases in the brief mean different things, and both are delivered. They are named
distinctly in code so they cannot be confused.

### 8.1 Forward pass — two senses, both built

| Sense | Function | What it is |
|---|---|---|
| **CPM forward pass** | `cpmForwardPass()` in `engine/cpm.ts` | the deterministic ES/EF computation of F-SD-01 |
| **Forward-looking projection** | `foresightProjection()` in `engine/montecarlo.ts` | the probabilistic forecast of F-RK-01..03 |

### 8.2 Back test — walk-forward, out-of-sample only

Seed dataset: **3 clients, 8 engagements, 24 months**, including two deliberate failures (one
cost overrun, one schedule overrun) and one near-miss recovered by a change request. Ground
truth is known because the data is generated from a declared process model.

Protocol:

```
for as_of in monthly dates across the 24-month window:
    visible = all rows with created_at ≤ as_of          # no lookahead, ever
    params  = ⚙ set fitted ONLY on projects closed before as_of
    predict:  EAC, forecast_finish, P(gate breach), clash occurrence
    later:    compare against what actually happened
```

### 8.3 Scored metrics

| Metric | Measures | Pass bar |
|---|---|---|
| MAPE on EAC | cost forecast accuracy, by months-to-completion bucket | beats all three naive benchmarks |
| MAPE on forecast finish | schedule forecast accuracy | beats all three naive benchmarks |
| **Brier score** on P(gate breach) | probability *calibration*, not just accuracy | better than the base-rate forecaster |
| **Monte Carlo calibration** (**F-07**) | of projects whose P80 was computed at *t*, what fraction actually finished by it | ≈ 0.80; a material miss means ρ is wrong and the report says so |
| Clash lead time | days between forecast detection and actual occurrence | ≥ ⚙ `min_lead_days` |
| Clash precision / recall | forecast clashes that materialised / actual clashes that were predicted | reported, with the precision-recall tradeoff shown |
| Gate criterion predictive value | which criteria actually separated successful from failed projects | criteria with no discriminating power are flagged as candidates for removal |

### 8.4 Naive benchmarks (**F-20** mitigation 5)

Every forecast is scored against all three. A model that does not beat all three is reported
as having **no demonstrated skill** — stated plainly in the backtest report, not buried.

1. "Finishes on the baseline date / at BAC"
2. "Current slip persists linearly"
3. "Historical average slip for this firm"

### 8.5 What the backtest report must say about itself

- number of free ⚙ parameters fitted, and parameters-per-closed-project ratio
- in-sample statistics **excluded by policy**
- every parameter's fitted value, its seeded default, and the Δ
- explicit `UNDERDETERMINED` verdict where the data cannot support the fit

---

## 9. Team Members — the full cast and what each one touches

"Include all team members" resolved as a RACI across the lifecycle. Roles are rows in
`role_def`; this table is the seeded default.

| Role | P1 Intake | P2 Scoping | P3 Execution | P4 QA | P5 Deploy | Gates signed | Agent proposals accepted |
|---|---|---|---|---|---|---|---|
| `DIRECTOR` | A (value-gated) | I | I | I | A | G0*, G4 | escalations, waivers |
| `PMO_LEAD` | **A** | C | C | C | C | G0 | intake, calibration, conflict |
| `FINANCE_CONTROLLER` | C | **A** (budget) | **A** (forecast) | I | C | G1 | forecast, provision |
| `ENGAGEMENT_MANAGER` | R | **A** | **R** | C | R | G1 | cross-project clash, foresight |
| `DELIVERY_LEAD` | C | **R** | **A** | C | R | G2 | schedule, estimation, reallocation |
| `SOLUTION_ARCHITECT` | C | **R** | C | C | C | — | advisory only |
| `QA_LEAD` | I | C | C | **A** | C | G2, G3 | QA |
| `CONSULTANT` | — | C | **R** | R | R | — | own timesheet/progress |
| `ANALYST` | C | C | **R** | R | C | — | own timesheet/progress |
| `CLIENT_SPONSOR` | C | **A** (scope) | I | I | **A** (final) | G1, G4 | none (human-relayed only) |
| `CLIENT_UAT_APPROVER` | — | I | — | **A** (UAT) | I | G3 | none |
| `CLIENT_OBSERVER` | — | I | I | I | I | — | none |

R = responsible · A = accountable/approver · C = consulted · I = informed
\* G0 Director signature required only above ⚙ `director_threshold`.

**Client-side roles never receive agent output directly** (03 §4.4). Everything client-facing
passes a firm-side human first.

---

## 10. Stage summary & gate conditions

| Stage | Deliverable | Gate condition |
|---|---|---|
| **0** | `docs/consulting/00`–`05` | **your sign-off** |
| **1** | 7 migrations + RLS + ledger | negative RLS suite green; ledger tamper-proof under `service_role`; F-17 closed |
| **2** | pure engine + fixtures | determinism proven; EVM reproduces PMI references; **SPI≈1.00 while SPI(t)<0.8** on a late project; backtest beats all three naive benchmarks |
| **3** | state machine + gates + API | **all 20 attempt-to-cheat attacks refused with correct errors** |
| **4** | 10 agents + 4 loops | L2 containment proven; L4 impossible; flood control holds at 20×30 sweeps; calibration cannot self-apply |
| **5** | UI + giant chart + schema + brain maps | perf budget met on the backtest dataset; worked example passes end-to-end; `build` + `lint` clean |

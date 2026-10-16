# 04 — Failure Mode & Effects Analysis

*"Analyse how your architecture will fail. Address failure points."*

Twenty failure modes. Each is scored on **S** (severity of effect, 1–5), **O** (likelihood
of occurrence if unmitigated, 1–5) and **D** (difficulty of detection, 1–5 where 5 = silent).
**RPN = S × O × D**. Ranked by RPN descending. Every mitigation maps to a concrete
artefact — a constraint, a trigger, a test, a metric, or a gate criterion.

The ordering matters more than the absolute numbers: these are the things most likely to
make the platform produce confident, wrong answers.

---

| ID | Failure mode | S | O | D | **RPN** |
|---|---|---|---|---|---|
| F-01 | RLS bypass via the Supabase service-role key | 5 | 4 | 4 | **80** |
| F-02 | Gate theatre: signoffs become rubber stamps | 5 | 4 | 4 | **80** |
| F-16 | Serial re-baselining hides scope creep | 5 | 4 | 4 | **80** |
| F-07 | Monte Carlo correlation blindness understates tail risk | 4 | 5 | 4 | **80** |
| F-20 | Backtest overfitting → false confidence in forecasts | 4 | 4 | 5 | **80** |
| F-05 | Subjective percent-complete makes EV fiction ("90% syndrome") | 5 | 5 | 3 | **75** |
| F-11 | Chinese-wall leak through aggregate views | 5 | 3 | 5 | **75** |
| F-01b | Formula registry becomes the new hardwire, or silently rewrites history | 4 | 4 | 4 | **64** |
| F-04 | Retro-dated / gamed timesheets corrupt AC and every EVM metric | 5 | 3 | 4 | **60** |
| F-10 | Hash chain is theatre (app-written, service-role rewritable) | 5 | 2 | 5 | **50** |
| F-06 | CPM on an under-linked network produces a fictitious critical path | 4 | 4 | 3 | **48** |
| F-12 | Multi-currency drift silently corrupts margin | 4 | 3 | 4 | **48** |
| F-18 | Unbounded delegation of signing authority | 4 | 3 | 4 | **48** |
| F-19 | Timezone / fiscal-period ambiguity breaks period comparisons | 3 | 4 | 4 | **48** |
| F-14 | Revenue recognised off a stale EAC → restatement | 5 | 3 | 3 | **45** |
| F-17 | `profiles.role` privilege escalation (live defect) | 5 | 3 | 3 | **45** |
| F-09 | Agents compute, drift, and disagree with the engine | 5 | 2 | 4 | **40** |
| F-08 | Agent proposal flood → humans stop reading → whole loop dies | 4 | 5 | 2 | **40** |
| F-15 | Phase skip via direct DB access | 5 | 2 | 3 | **30** |
| F-13 | Giant chart collapses at real portfolio scale | 3 | 5 | 1 | **15** |

---

## F-01 · RLS bypass via the service-role key — RPN 80

**Mechanism.** Supabase's `service_role` key bypasses RLS entirely. Any route handler that
instantiates a client with it — for convenience, for a background job, for an agent — reads
every engagement for every client. This is the most likely real data leak in the system, and
it will be introduced by someone trying to be helpful.

**Effect.** Catastrophic cross-engagement and cross-client disclosure. Unrecoverable
reputationally.

**Why detection is hard.** It produces no error. The code works. It returns *more* data, and
the extra rows are invisible unless someone checks what a restricted user can see.

**Mitigation.**
1. All request-path DB access goes through `src/lib/supabase/server.ts`, which is
   cookie-bound and therefore RLS-scoped (the existing repo pattern, per CLAUDE.md).
2. Exactly **one** module may hold the service key: `src/lib/consulting/privileged/db.ts`.
   It is import-restricted and every function in it writes to `audit_ledger`.
3. **CI check** greps for `SERVICE_ROLE` / `service_role` outside that allowlisted path and
   fails the build.
4. **Negative RLS test suite** (Stage 1 acceptance): for each delivery table, a test asserts
   that a user who is *not* an `engagement_member` gets **zero rows** — including through
   views, aggregates, and RPC functions. A table added without this test fails CI.
5. Agents run as a dedicated Postgres role with RLS **enabled** and a membership grant
   scoped to the engagements they are assigned, not as `service_role`.

---

## F-02 · Gate theatre — RPN 80

**Mechanism.** The organisation adapts to the gate rather than the gate constraining the
organisation. Symptoms: everyone gets granted a signing role; approvals happen in 15 seconds;
a single person signs 40 gates a week; criteria are routinely waived; the same person builds
and approves.

**Effect.** The hard gate becomes a formality. The audit trail then *proves* that governance
was followed while governance was not happening — worse than no gate, because it manufactures
false assurance.

**Mitigation.**
1. **Segregation of duties** (I-4): the signer may not be an author of the artefact under
   approval. Enforced by trigger comparing `audit_ledger` authorship, not by convention.
2. **Four-eyes** (I-5): ≥2 distinct human identities. Delegation explicitly does not satisfy
   it — otherwise one person signs twice through a delegate.
3. **Waiver requires strictly higher `authority_rank`** (I-6), domain-scoped so a Finance
   Controller cannot waive a QA criterion.
4. **Criteria are re-evaluated at advance time** (state machine step 3). A gate that passed
   last week but whose margin criterion has since gone red does not let the project advance.
   Gates do not go stale.
5. **Rubber-stamp telemetry** (F-GV-02): `signoff.latency_seconds`, approvals-per-approver-
   per-day, and a `RUBBER_STAMP_SUSPECT` flag. Reported, not blocked — blocking would just
   teach people to wait 61 seconds.
6. **`RevenueOnWaiver`** (F-GV-05) on the director dashboard: the currency value of revenue
   resting on waived gates rather than clean passes. This is the number that makes waiver
   inflation visible to the person who can stop it.
7. **Role-grant audit**: AuditSentinelAgent flags any widening of signing-role grants.

---

## F-16 · Serial re-baselining hides scope creep — RPN 80

**Mechanism.** Every approved change request re-baselines. Performance is then measured
against the newest baseline. A project that has doubled in cost and duration reports as
on-plan, permanently, because the plan keeps moving to meet the actuals.

**Effect.** Scope creep — the exact thing Phase 2 exists to track — becomes structurally
invisible. This is how real PPM deployments fail silently.

**Mitigation.**
1. `baseline.is_original` is set exactly once per project and never again (trigger-enforced).
2. **All creep metrics read only `is_original`** (F-EV-13). `ScopeCreep_cost`,
   `ScopeCreep_time`, `CreepVelocity` are never computed against the latest baseline.
3. `baseline.parent_version` preserves the full lineage; the UI shows every re-baseline as a
   step on a staircase against the original (I-10).
4. `evm_snapshot.scope_creep_pct` is a first-class column, present on every period snapshot,
   not a report someone has to run.
5. A new baseline requires an approved `change_request` — there is no "re-baseline" button.
6. `ScopeCreep_count` and `CreepVelocity` are reported at G2 and G4; a high creep velocity
   with a healthy CPI is explicitly called out as the signature of this failure mode.

---

## F-07 · Monte Carlo correlation blindness — RPN 80

**Mechanism.** Sampling activity durations independently. It is the default in almost every
implementation and it is wrong: real overruns are correlated. One scope misunderstanding, one
key departure, one late client decision moves many activities at once.

**Effect.** By the central limit theorem, independent sampling shrinks aggregate variance by
roughly `1/√n`. For a 200-activity project the P80 finish date comes out dramatically
earlier than reality. The platform then reports high confidence in a date it will miss — a
worse outcome than offering no forecast.

**Mitigation.**
1. **Single-factor correlation is the default, not an option**: F-RK-01 samples a global drag
   factor `g_n` and mixes it with the idiosyncratic term at `√ρ / √(1−ρ)`. ⚙ `rho_default =
   0.30`, deliberately non-zero.
2. ρ is **calibrated from this firm's own history** by PostMortemAgent (Loop 4) — measured
   correlation of overrun across activities in closed projects, validated walk-forward.
3. Every foresight output carries an explicit caveat field: **P80 is a floor, not a ceiling**,
   surfaced in the UI next to the number rather than buried in documentation.
4. **Backtest reports Monte Carlo calibration directly**: of the historical projects whose
   P80 was computed at time *t*, what fraction actually finished by it? If the answer is not
   ≈80%, ρ is wrong and the report says so (see `05-BUILD-STAGES.md` §6).
5. ⚙ `rho = 0` is permitted but emits a warning on the run, because there are narrow cases
   (fully independent parallel workstreams) where it is defensible.

---

## F-20 · Backtest overfitting — RPN 80

**Mechanism.** Calibrate ⚙ parameters on historical projects, then report how well the model
predicts those same projects. The fit will be excellent and it will mean nothing. This is the
most seductive failure in the whole build, because it produces exactly the "proof" that was
asked for.

**Effect.** False confidence. The platform's forecasts are trusted precisely because they
were tuned to the data they are being tested on, and they then fail on new projects.

**Mitigation.**
1. **Strict walk-forward validation.** At each historical as-of date, the model sees only data
   that existed then — and parameters fitted only on projects *closed* before then. No
   lookahead, ever.
2. **Out-of-sample reporting only.** In-sample fit statistics are not published in the
   backtest report; including them invites exactly this error.
3. **Parameter-count discipline.** The number of free ⚙ parameters fitted is reported
   alongside the error, with the ratio of parameters to closed projects. Below ⚙
   `min_projects_per_param = 5`, the calibration is reported as `UNDERDETERMINED` and
   PostMortemAgent does not propose it.
4. **PostMortemAgent never auto-applies** a calibration (Loop 4 constraint). Every change
   goes through `formula_change_request`.
5. **Honest baselines.** Every forecast is scored against three naive benchmarks: "finishes
   on baseline date", "current slip persists linearly", and "historical average slip". A
   model that does not beat all three is reported as having no demonstrated skill.
6. **Brier score** for probabilistic claims (P(breach)), not just MAPE on point estimates —
   a well-calibrated probability is a different and stronger claim than an accurate mean.

---

## F-05 · Subjective percent-complete makes EV fiction — RPN 75

**Mechanism.** `EV = Σ pct_complete × BAC`. If `pct_complete` is a number a PM types, then
EV is a number a PM chooses. The classic pathology is "90% syndrome": a work package sits at
90% for months while CPI and SPI read healthy.

**Effect.** Every downstream metric — EV, CPI, SPI, SPI(t), EAC, POC, **revenue** — is
wrong, in the optimistic direction, with full apparent precision. Under DR-03 this
propagates straight into recognised revenue and then into a restatement.

**Mitigation.**
1. **Method restriction by activity type** (F-EV-04 table). Short packages must use
   `ZERO_HUNDRED` or `FIFTY_FIFTY` — objective, binary, ungameable.
2. `MILESTONE_WEIGHTED` for long packages: progress comes from achieved internal milestones,
   not a judgement call.
3. `PHYSICAL` requires a non-null `evidence_note`, enforced by constraint.
4. `LOE` is whitelisted to named support activities only (⚙ `loe_whitelist`). It earns value
   automatically and is therefore the most dangerous method in the catalogue.
5. **Stall detector**: `pct_complete` unchanged for ⚙ `stall_periods` while in `(0,100)`
   raises a QAAgent/FinancialGuardAgent finding.
6. `progress_update.prior_pct` is stored, so the full progress trajectory is auditable and a
   late correction cannot be disguised as steady progress.
7. **Reconciliation metric**: `EV/BAC` vs `AC/EAC` vs `hours_actual/hours_EAC`. Three
   independent completion estimates; divergence beyond ⚙ tolerance is a finding.

---

## F-11 · Chinese-wall leak through aggregate views — RPN 75

**Mechanism.** Row-level RLS is applied correctly to base tables. Then someone builds a
firm-wide utilisation heatmap, a practice-level margin chart, or a "who is available next
month" view. A user walled off from Client B now sees that four named architects are 100%
committed in March on *something* — and in a small practice, that is the leak.

**Effect.** Confidentiality breach by inference, with every individual row-level check
passing. The most likely leak after F-01, and the hardest to see.

**Mitigation.**
1. **Every aggregate reads through a `security_barrier` view** that applies the same
   `engagement_member` + `conflict_group` predicate as the base table. No aggregate queries a
   base table directly.
2. **k-anonymity floor** on cross-client aggregates: ⚙ `k_min = 3` distinct engagements, or
   the cell is suppressed rather than shown.
3. Firm-wide views collapse to **role-level** supply/demand, never person-level, for anyone
   without a `FIRM`-scope role.
4. The giant chart's resource lanes render **only** engagements the viewer is a member of;
   capacity consumed elsewhere appears as an unattributed grey block labelled "committed
   elsewhere" — the clash is still visible and actionable without disclosing its source.
5. **Negative test suite** covers aggregates and views explicitly, not just row reads
   (F-01 mitigation 4 extended): a walled user's utilisation query must not change when
   Client B's data changes.

---

## F-01b · Formula registry becomes the new hardwire, or rewrites history — RPN 64

**Mechanism.** Two opposite failures from the same cause. Either nobody ever edits the
registry and the seeded defaults ossify into de-facto hardcoded constants — making the whole
mechanism dead weight — or someone edits a formula mid-project and every historical number
shifts underneath the audit trail.

**Effect.** Mode 1: the "no hardwired metrics" requirement is satisfied on paper only.
Mode 2: the audit trail becomes unreliable; a closed gate's evidence no longer reproduces.

**Mitigation.**
1. `formula_version_id` is **NOT NULL on every metric row** (I-7). A historical value is
   always reproducible from its own stored inputs and its own formula version.
2. `formula_binding` is **scope- and time-effective**. Activating a new version does not
   touch any existing row.
3. Recomputing a closed period is a **separate, privileged, ledger-logged operation** that
   produces a new snapshot labelled `recompute_of`, leaving the original intact. There is no
   in-place history rewrite, by construction.
4. Against ossification: a **parameter-staleness report** lists ⚙ parameters unchanged since
   seeding alongside the backtest error they are producing, delivered to `PMO_LEAD` monthly.
   PostMortemAgent (Loop 4) actively proposes recalibrations, so the registry has a standing
   source of pressure to change.
5. `formula_test_case` rows must all pass before `ACTIVE` (I-8), run in CI — so an edit
   cannot break a formula silently.
6. `formula_change_request` requires `PMO_LEAD`, or `FINANCE_CONTROLLER` for EVM/REVENUE.
   The registry has its own gate.

---

## F-04 · Retro-dated / gamed timesheets corrupt AC — RPN 60

**Mechanism.** `AC` is the denominator of CPI and the numerator of POC. Hours moved between
projects, entered weeks late, or booked to the wrong activity corrupt every financial metric.
Under DR-03 the incentive is real: a project near its margin floor benefits from hours
landing elsewhere.

**Effect.** CPI, EAC, POC, revenue, margin — all wrong, and wrong in whichever direction
someone chose.

**Mitigation.**
1. `timesheet_period.locked_at`. After close, entries for that period are rejected; a
   correction is a visible adjusting entry in an open period, never a silent backdate.
2. `entry_date` vs `created_at` divergence is a monitored metric; AuditSentinelAgent flags
   entries created more than ⚙ `backdate_days` after their `entry_date`.
3. Approval chain: `DRAFT → SUBMITTED → APPROVED`, approver ≠ submitter, and only `APPROVED`
   hours count toward AC (F-EV-05).
4. Cost rate resolved at `entry_date` from the **versioned** `rate_card`, so AC does not
   shift when rates are revised.
5. Cross-check against `progress_update`: hours booked with no progress reported, or progress
   reported with no hours booked, is a finding.
6. Every timesheet mutation hits `audit_ledger` with actor and before/after (I-15).

---

## F-10 · Hash chain is theatre — RPN 50

**Mechanism.** If the application computes `prev_hash` and inserts it, the application can
recompute the whole chain after altering a row. If `service_role` can `UPDATE` the ledger,
the chain proves nothing. An "immutable audit log" that the system itself can rewrite is
decoration.

**Effect.** The governance claim the platform rests on is false, and nobody finds out until
an auditor tests it.

**Mitigation.**
1. `prev_hash` / `row_hash` computed in a **`BEFORE INSERT` trigger**, never by application
   code (I-9).
2. `UPDATE` and `DELETE` **revoked** on `audit_ledger` from every role including
   `service_role`, *plus* a trigger that raises on either — defence in depth, because grants
   can be changed by a superuser but a trigger shows up in the schema diff.
3. Nightly chain walk (F-GV-04) by AuditSentinelAgent, writing `ledger_checkpoint.root_hash`.
4. **Checkpoints are exported outside the database** — committed to this git repo by a
   scheduled Action, in the shape of the existing `refresh-data.yml`. A root hash published
   in an append-only external store is what makes in-database tampering detectable rather
   than merely discouraged.
5. A chain break is a P1 push escalation to `DIRECTOR`, not a dashboard row.

---

## F-06 · Under-linked network, fictitious critical path — RPN 48

**Mechanism.** A WBS entered without full dependency logic. Activities float freely, total
float is enormous and meaningless, and the "critical path" is whatever happens to be longest.
Every schedule forecast built on it is noise.

**Effect.** Schedule metrics, SPI(t), IEAC, Monte Carlo, forward clash detection — all
garbage in, confidently presented.

**Mitigation.** `schedule_health` (F-SD-05) as **blocking G1 criteria**: `dangling_count = 0`,
`cycle_count = 0`, `negative_float_count = 0`, `hard_constraint_count ≤ ⚙ 3`,
`logic_density ∈ [1.2, 3.0]`, `missing_resource_count = 0`. A project cannot enter Execution
on a network that cannot be analysed. Cycles are reported with the SCC enumerated (F-SD-04),
so the fix is actionable rather than a hunt.

---

## F-12 · Multi-currency drift — RPN 48

**Mechanism.** Contract in EUR, costs in USD and GBP. Someone sums a column. Margin is now
wrong by the FX spread, silently, and nothing errors.

**Mitigation.** Money is a composite of `(amount, currency)`; every aggregate requires an
explicit `fx_rate_version_id` (I-14). A check constraint rejects summing mixed currencies
without one. `fx_rate_version.locked_at` freezes the rate used for a closed period so a
closed month's margin never moves. Every displayed total names its rate version.

---

## F-18 · Unbounded delegation — RPN 48

**Mechanism.** A Director delegates signing authority before leave. The delegate delegates
onward. Three hops later someone with no authority is clearing G4, and the chain looks valid.

**Mitigation.** `user_role.delegated_from` with a **max depth of 1** (a delegate cannot
delegate), a mandatory `delegation_expires_at`, and `role_def.can_delegate` as an explicit
per-role flag. Delegation does **not** satisfy four-eyes (I-5). Granting a delegation is
itself a ledger-logged, gated action, and AuditSentinelAgent reports every active delegation
weekly to `PMO_LEAD`.

---

## F-19 · Timezone / fiscal-period ambiguity — RPN 48

**Mechanism.** `as_of` stored as a timestamp. A project in Singapore and a close run in
London disagree about which period a timesheet belongs to. Period comparisons drift by a day
and EVM curves develop phantom steps.

**Mitigation.** All timestamps UTC. **Every metric row additionally carries an explicit
`fiscal_period` key** derived from `firm.fiscal_year_start_month` — EVM, revenue and capacity
snapshots are keyed to the period, never to a raw timestamp. Working-day arithmetic always
goes through `calendar` + `calendar_exception` with an explicit timezone (F-SD domain note).
Period boundaries are stored rows (`timesheet_period`), not computed on the fly.

---

## F-14 · Revenue off a stale EAC — RPN 45

**Mechanism.** `POC = AC/EAC` (F-RV-01). If EAC is three months stale, POC is overstated,
revenue is overstated, and the correction lands as a restatement.

**Mitigation.** `revenue_recognition` reads **only** a `forecast_version` in state `APPROVED`
(F-RV domain note). Forecast staleness (⚙ `forecast_max_age_days`) is a blocking G2 criterion
and a FinancialGuardAgent escalation. Period close locks the recognised figure. F-RV-06's
onerous test runs at every close. `Margin_realised` vs `Margin_current` divergence (F-RV-07)
is a monitored signal precisely because it catches a stale EAC.

---

## F-17 · `profiles.role` privilege escalation — RPN 45 · **live defect in this repo**

**Mechanism.** `supabase/migrations/0001_init.sql:18-20` has no `WITH CHECK` on the update
policy. Postgres falls back to `USING`, which only pins `id`, so
`update profiles set role='admin' where id = auth.uid()` is permitted by RLS.

**Effect.** Any authenticated user self-promotes. CLAUDE.md earmarks `profiles.role` for
RBAC, so this is a direct path into any gate that trusts it.

**Mitigation.** (Stage 1, first migration.)
1. Replace the policy with a column-restricting `WITH CHECK`; revoke `UPDATE (role)` from
   `authenticated`.
2. Role mutation moves behind a `SECURITY DEFINER` function that writes to the ledger.
3. **Consulting authorisation never reads `profiles.role`** (DR-05) — it uses
   `consulting.user_role` with validity windows and scopes. Even if the legacy column is
   compromised, no gate depends on it.

---

## F-09 · Agents compute and drift — RPN 40

**Mechanism.** An agent, asked to assess a project, computes CPI itself from the numbers in
its context instead of calling the engine. It gets a slightly different answer. Two agents
now disagree, and neither matches the dashboard.

**Mitigation.** Invariant I-11, enforced three ways: the import-graph CI check; the
double-run determinism test; and the architectural rule that an agent's output schema has no
numeric field it did not receive from an engine call — `expected_effect_json` is **populated
by the engine after** the LLM drafts the diff, never by the LLM (§4.2 step 3). The LLM
proposes *what to change*; the engine computes *what that would do*.

---

## F-08 · Agent proposal flood — RPN 40

**Mechanism.** Ten agents × 20 engagements × nightly sweeps = hundreds of findings a day.
Humans triage for a week, then stop opening the inbox. The entire L2 architecture — which
depends on human acceptance — becomes inert.

**Effect.** The feedback loops die quietly. The system still *works*; nobody is listening.
This is the single most common way agentic systems fail in practice, and it fails without
any error.

**Mitigation.**
1. `agent_def.daily_proposal_budget` — a hard per-agent cap. Over budget, only the top-N by
   F-RK-04 priority are emitted.
2. `agent_finding.dedupe_key` + `occurrence_count`: a recurring condition increments a
   counter on one row. It never creates a second row.
3. ⚙ `propose_severity` floor — findings below it stay in the Finding Feed and never become
   proposals.
4. **Silence is a designed output.** Loop 1 emits nothing when metrics are within tolerance.
   An agent that reports every night that everything is fine has trained the team to ignore it.
5. **Acceptance-rate governance** (`agent_calibration`): below ⚙ `demote_floor = 0.30`, the
   agent **auto-demotes to L1** and is flagged for recalibration. An agent must earn the
   right to keep proposing.
6. Rejected `dedupe_key`s are suppressed for ⚙ 7 days — a rejected suggestion does not come
   back tomorrow.
7. Digest batching per role (§4.1) rather than per-event notification.

---

## F-15 · Phase skip via direct DB access — RPN 30

**Mechanism.** Someone with DB access runs `update project set current_phase = 'EXECUTION'`.
Every gate is bypassed and the ledger shows a bare column change.

**Mitigation.** Invariant I-1: a `BEFORE UPDATE` trigger on `project` rejects any change to
`current_phase` unless a transaction-local flag set by `consulting.advance_phase()` is
present. `advance_phase()` is the sole writer and performs the full six-step validation
(state machine §10.3). An attempted direct update is itself logged as a `VIOLATION_ATTEMPT`
finding to `PMO_LEAD`.

---

## F-13 · Giant chart collapses at scale — RPN 15

**Mechanism.** 20 engagements × 300 activities = 6 000 bars plus dependency arcs plus resource
lanes, in SVG, in React. The browser dies. Low RPN only because detection is trivial — it is
obvious the instant you load real data, which is also why it must be designed for up front
rather than discovered in Stage 5.

**Mitigation.**
1. CPM, aggregation and layout computed **server-side**; the client receives positioned
   geometry, not raw rows.
2. Canvas (or WebGL) renderer with **virtualisation** — only the visible time window and
   swimlanes are drawn. Recharts is used for small per-project panels only; it is not the
   giant chart.
3. **Level of detail by zoom**: engagement-level roll-up bars at wide zoom, work packages at
   medium, activities and dependency arcs only when the visible window is below ⚙
   `arc_render_threshold` activities.
4. Precomputed layout cached per `(project, baseline_id, forecast_version_id)` and
   invalidated on change.
5. **Performance budget as an acceptance criterion** (Stage 5): first paint < 1.5 s and
   sustained 30 fps pan/zoom at 20 engagements × 300 activities, tested with the seeded
   backtest dataset — not with a toy fixture.

---

---

## Mitigation → artefact traceability

| Mitigation type | Count | Verified in |
|---|---|---|
| DB constraint / trigger | 14 | Stage 1 — schema tests |
| RLS policy / barrier view | 6 | Stage 1 — negative test suite |
| CI check | 4 | Stages 1–5 — pipeline |
| Engine unit test | 11 | Stage 2 — determinism + fixture suite |
| Gate criterion (blocking) | 9 | Stage 3 — attempt-to-cheat suite |
| Monitored metric / finding | 13 | Stage 4 — agent suite |
| Acceptance criterion | 5 | Stage 5 — performance & E2E |

Every row in the FMEA table above is tested. A mitigation without a test is an intention.

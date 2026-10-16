# 01 — Domain Model, ERD & Phase State Machine

**Schema:** `consulting` (Postgres, Supabase). All tables RLS-enabled. All money columns
carry `currency` + `fx_rate_version` (invariant I-14).

Conventions used below:
- `PK` primary key · `FK` foreign key · `U` unique · `N` nullable
- every table has `id uuid pk default gen_random_uuid()`, `firm_id uuid not null`,
  `created_at`, `created_by`, `updated_at`, `updated_by` unless stated otherwise
- `firm_id` is the outermost tenant key and is present on **every** table, including
  children, so RLS never needs a join to establish tenancy

---

## 1. Layer A — Tenancy, Identity & Org (the Jira Align import)

| Table | Key columns | Notes |
|---|---|---|
| `firm` | `name`, `fiscal_year_start_month`, `base_currency` | the tenant root |
| `app_user` | `auth_user_id FK auth.users U`, `firm_id`, `email`, `display_name`, `employment_type`, `default_cost_rate_id`, `is_active` | deliberately **not** `public.profiles` (DR-05) |
| `org_unit` | `parent_id FK self N`, `code U`, `name`, `kind`, `path ltree`, `lead_user_id` | self-referencing people tree: `FIRM → PRACTICE → CAPABILITY_GROUP → POD`. `path` maintained by trigger for O(1) subtree queries |
| `org_membership` | `user_id`, `org_unit_id`, `from_date`, `to_date N`, `fte_pct` | a person can sit in >1 unit over time; history preserved |
| `role_def` | `code U`, `name`, `authority_rank int`, `is_client_side bool`, `can_waive bool`, `can_delegate bool` | `authority_rank` is what invariant I-6 compares |
| `user_role` | `user_id`, `role_def_id`, `scope_kind`, `scope_id N`, `valid_from`, `valid_to N`, `granted_by`, `delegated_from N`, `delegation_expires_at N` | `scope_kind ∈ {FIRM, CLIENT, ENGAGEMENT, PROJECT}`. Validity window is what invariant I-3 checks *at signing time* |
| `skill` | `code U`, `name`, `family` | |
| `person_skill` | `user_id`, `skill_id`, `proficiency 1..5`, `certified_at N`, `assessed_by` | drives skill-based capacity (the Planisware capacity model) |
| `calendar` | `code U`, `name`, `timezone`, `hours_per_day numeric`, `work_days int[]` | per geo / per client |
| `calendar_exception` | `calendar_id`, `date`, `kind`, `hours N` | holidays, half-days, client blackout windows |
| `rate_card` | `role_def_id N`, `user_id N`, `cost_rate`, `currency`, `effective_from`, `effective_to N`, `version` | **cost only** — no bill rate, per DR-03. Versioned so historical AC is reproducible |
| `fx_rate_version` | `as_of`, `base_currency`, `rates jsonb`, `source`, `locked_at N` | money never crosses currencies without one of these |

### Role catalogue (seeded, editable — not hardwired)

| `code` | `authority_rank` | Side | `can_waive` |
|---|---|---|---|
| `DIRECTOR` | 100 | firm | ✔ |
| `PMO_LEAD` | 90 | firm | ✔ |
| `FINANCE_CONTROLLER` | 85 | firm | ✔ (financial criteria only) |
| `ENGAGEMENT_MANAGER` | 70 | firm | ✘ |
| `DELIVERY_LEAD` | 60 | firm | ✘ |
| `SOLUTION_ARCHITECT` | 55 | firm | ✘ |
| `QA_LEAD` | 55 | firm | ✘ |
| `CONSULTANT` | 30 | firm | ✘ |
| `ANALYST` | 20 | firm | ✘ |
| `CLIENT_SPONSOR` | 80 | client | ✘ |
| `CLIENT_UAT_APPROVER` | 50 | client | ✘ |
| `CLIENT_OBSERVER` | 10 | client | ✘ |

`can_waive` scoped by domain in `role_waiver_domain` so a Finance Controller cannot waive
a QA criterion.

---

## 2. Layer B — Client, Engagement & the Security Barrier

| Table | Key columns | Notes |
|---|---|---|
| `client` | `legal_name`, `code U`, `industry_code`, `conflict_group_id N`, `risk_tier` | |
| `conflict_group` | `code U`, `name`, `rationale` | two clients in the same group are **mutually exclusive** for staffing and visibility |
| `conflict_waiver` | `user_id`, `client_a_id`, `client_b_id`, `granted_by`, `justification`, `valid_to` | the only legal way through the wall; itself audited and gated |
| `engagement` | `client_id`, `code U`, `name`, `contract_type`, `contract_value`, `currency`, `signed_at N`, `start_date`, `end_date`, `rev_rec_method`, `poc_basis`, `payment_terms_days` | `contract_type ∈ {FIXED_PRICE, MILESTONE, RETAINER, OUTCOME}` |
| `engagement_member` | `engagement_id`, `user_id`, `role_def_id`, `access_level`, `from_date`, `to_date N` | **this is the real RLS boundary**, not `firm_id` |
| `barrier_acknowledgement` | `user_id`, `engagement_id`, `document_version`, `accepted_at`, `ip` | audit of who accepted which confidentiality barrier |

### Why `engagement_member` and not `firm_id` is the RLS boundary

The catastrophic leak in a consulting firm is not cross-tenant (firm A seeing firm B) —
one firm usually owns the whole instance. It is **cross-engagement inside one firm**: the
team on Client A's transaction seeing Client B's. Tenant-level RLS does nothing about that.
So the default `SELECT` policy on every delivery table is:

```sql
-- shape of the barrier predicate (full policy set in Stage 1)
exists (
  select 1 from consulting.engagement_member em
  where em.engagement_id = <row's engagement_id>
    and em.user_id = consulting.current_app_user()
    and current_date between em.from_date and coalesce(em.to_date, 'infinity'::date)
)
or consulting.has_firm_role(array['DIRECTOR','PMO_LEAD'])
```

...*and* a conflict-group exclusion: a user who is a member of an engagement in conflict
group G cannot read any engagement in group G for a different client, even if granted,
unless a live `conflict_waiver` exists. Invariant I-13.

---

## 3. Layer C — Phase 1: Ideation & Intake

| Table | Key columns | Notes |
|---|---|---|
| `objective` | `parent_id FK self N`, `tier`, `code U`, `statement`, `weight numeric`, `period`, `owner_user_id`, `target_value N`, `actual_value N` | **Jira Align import**: `tier ∈ {FIRM, PRACTICE, ENGAGEMENT, PROJECT}`; weights normalise within a parent |
| `opportunity` | `client_id`, `title`, `narrative`, `requested_by`, `requested_at`, `estimated_value`, `currency`, `target_start`, `state`, `score_total N`, `priority_rank N` | the intake request; `state ∈ {DRAFT, SUBMITTED, SCORING, SCORED, APPROVED, REJECTED, PARKED, CONVERTED}` |
| `opportunity_objective_link` | `opportunity_id`, `objective_id`, `contribution_pct` | strategic alignment is **computed from this plus the objective tree**, never typed |
| `scoring_model` | `code`, `version`, `name`, `state`, `approved_by N` | versioned; a model is a set of criteria |
| `scoring_criterion` | `scoring_model_id`, `code`, `label`, `domain`, `weight`, `scale_min`, `scale_max`, `direction`, `source`, `formula_id N`, `is_blocking bool`, `block_threshold N` | `source ∈ {MANUAL, DERIVED}`. `DERIVED` criteria bind to a `formula` — e.g. ROI, NPV, alignment |
| `opportunity_score` | `opportunity_id`, `criterion_id`, `raw_value`, `normalized_value`, `weighted_value`, `formula_version_id FK`, `scored_by`, `scored_at`, `evidence_note` | `formula_version_id` is NOT NULL → invariant I-7 |
| `resource_estimate` | `opportunity_id`, `role_def_id`, `skill_id N`, `hours_optimistic`, `hours_likely`, `hours_pessimistic`, `hours_pert N`, `sigma N`, `rate_card_id`, `formula_version_id` | 3-point PERT; `hours_pert`/`sigma` are derived and stored with their formula version |
| `intake_feasibility` | `opportunity_id`, `as_of`, `min_slack_hours`, `bottleneck_role_id N`, `bottleneck_period`, `feasible bool`, `formula_version_id` | output of the capacity model against existing commitments |
| `conflict_check` | `opportunity_id`, `checked_at`, `result`, `conflicting_client_id N`, `cleared_by N` | blocking criterion on gate G0 |

---

## 4. Layer D — Phase 2: Scoping & Planning

| Table | Key columns | Notes |
|---|---|---|
| `project` | `engagement_id`, `opportunity_id N`, `code U`, `name`, `current_phase`, `state`, `calendar_id`, `planned_start`, `planned_finish`, `contract_milestone_date N` | `current_phase` is trigger-protected (I-1) |
| `wbs_node` | `project_id`, `parent_id FK self N`, `code`, `name`, `node_type`, `level int`, `is_leaf bool`, `sort_order`, `deliverable_desc N`, `acceptance_criteria N` | `node_type ∈ {SUMMARY, DELIVERABLE, WORK_PACKAGE, ACTIVITY, MILESTONE}`; `code` is the dotted path `1.2.3` |
| `activity` | `wbs_node_id U`, `duration_days numeric`, `effort_hours numeric`, `calendar_id`, `constraint_type`, `constraint_date N`, `pct_complete_method`, `es N`, `ef N`, `ls N`, `lf N`, `total_float N`, `free_float N`, `is_critical N`, `cpm_run_id N` | `constraint_type ∈ {ASAP, ALAP, SNET, SNLT, FNET, FNLT, MSO, MFO}`. CPM outputs are stored, stamped with the run that produced them |
| `dependency` | `project_id`, `predecessor_activity_id`, `successor_activity_id`, `dep_type`, `lag_days numeric`, `created_by` | `dep_type ∈ {FS, SS, FF, SF}` — all four, per brief |
| `assignment` | `activity_id`, `user_id N`, `role_def_id`, `skill_id N`, `allocation_pct`, `planned_hours`, `rate_card_id`, `is_generic bool` | `is_generic` = role-level demand before a named person is staffed (Planisware pattern) |
| `cost_account` | `project_id`, `code`, `name`, `kind`, `budget_amount`, `currency` | `kind ∈ {LABOUR, EXPENSE, SUBCONTRACT, CONTINGENCY, MANAGEMENT_RESERVE} ` |
| `wbs_cost_plan` | `wbs_node_id`, `cost_account_id`, `period`, `planned_amount`, `formula_version_id` | the calendar-spread plan that becomes PV |
| `baseline` | `project_id`, `version int`, `parent_version N`, `taken_at`, `taken_by`, `gate_instance_id N`, `reason`, `bac`, `planned_finish`, `is_original bool` | `is_original` is set once and never again — scope-creep is always measured against it (I-10) |
| `baseline_activity` | `baseline_id`, `activity_id`, frozen schedule fields | |
| `baseline_cost` | `baseline_id`, `wbs_node_id`, `period`, `planned_amount` | the immutable PV curve |
| `baseline_scope` | `baseline_id`, `wbs_node_id`, `name`, `acceptance_criteria`, `scope_hash` | `scope_hash` lets UAT signoff pin exactly what was accepted |
| `change_request` | `project_id`, `code`, `title`, `rationale`, `delta_cost`, `delta_days`, `delta_scope_json`, `requested_by`, `state`, `approved_by N`, `resulting_baseline_id N` | the only legal path to a new baseline |
| `schedule_health` | `project_id`, `as_of`, `dangling_count`, `cycle_count`, `negative_float_count`, `hard_constraint_count`, `logic_density`, `missing_resource_count`, `formula_version_id` | blocking criteria on gate G1 (failure mode F-06) |

---

## 5. Layer E — Phase 3: Execution & Tracking

| Table | Key columns | Notes |
|---|---|---|
| `timesheet_period` | `firm_id`, `period_start`, `period_end`, `state`, `locked_at N`, `locked_by N` | period close; locking prevents retro-dating (F-04) |
| `timesheet_entry` | `user_id`, `activity_id`, `entry_date`, `hours`, `note`, `state`, `submitted_at N`, `approved_by N`, `approved_at N`, `period_id`, `created_at` | `state ∈ {DRAFT, SUBMITTED, APPROVED, REJECTED}`. `entry_date` vs `created_at` divergence is a monitored signal |
| `expense_entry` | `user_id`, `project_id`, `cost_account_id`, `entry_date`, `amount`, `currency`, `category`, `receipt_url N`, `state`, `approved_by N` | |
| `progress_update` | `activity_id`, `as_of`, `pct_complete`, `method`, `reported_by`, `evidence_note N`, `prior_pct N` | `method ∈ {PHYSICAL, ZERO_HUNDRED, FIFTY_FIFTY, MILESTONE_WEIGHTED, UNITS, LOE}` — restricted per activity type (F-05) |
| `cost_actual` | `project_id`, `wbs_node_id`, `period`, `labour_amount`, `expense_amount`, `currency`, `fx_rate_version_id`, `formula_version_id`, `computed_at` | derived: approved hours × versioned cost rate |
| `forecast_version` | `project_id`, `version`, `as_of`, `method`, `etc_amount`, `eac_amount`, `forecast_finish`, `state`, `approved_by N`, `formula_version_id` | **rev-rec may only read an APPROVED forecast version** (F-14) |
| `evm_snapshot` | `project_id`, `as_of`, `fiscal_period`, `bac`, `pv`, `ev`, `ac`, `cv`, `sv`, `cpi`, `spi`, `es`, `sv_t`, `spi_t`, `eac`, `etc`, `vac`, `tcpi`, `ieac_days`, `burn_rate`, `runway_days`, `margin_pct`, `margin_erosion_pct`, `scope_creep_pct`, `spi_degenerate bool`, `formula_version_id`, `baseline_id` | one row per project per period; **every field traceable to a formula version** |
| `revenue_recognition` | `engagement_id`, `fiscal_period`, `method`, `poc`, `revenue_cum`, `revenue_period`, `invoiced_cum`, `wip_amount`, `deferred_amount`, `loss_provision`, `onerous bool`, `formula_version_id`, `forecast_version_id`, `state` | `onerous`/`loss_provision` implement the IFRS 15 / ASC 606 test |
| `milestone_invoice` | `engagement_id`, `wbs_node_id`, `amount`, `currency`, `due_condition`, `gate_instance_id N`, `state`, `invoiced_at N`, `paid_at N` | **FK to `gate_instance`** — a milestone becomes billable only when its gate passes (DR-03) |
| `capacity_snapshot` | `user_id`, `period`, `available_hours`, `committed_hours`, `utilization_pct`, `formula_version_id` | from `assignment` × `calendar` |

---

## 6. Layer F — Phase 4: Testing & QA

| Table | Key columns | Notes |
|---|---|---|
| `test_plan` | `project_id`, `version`, `name`, `scope_baseline_id`, `state`, `approved_by N` | pinned to a baseline so "what we test" = "what we baselined" |
| `test_case` | `test_plan_id`, `code`, `wbs_node_id`, `title`, `steps_json`, `expected_result`, `priority`, `is_uat bool` | `wbs_node_id` is **mandatory** → full requirement-to-test traceability |
| `test_coverage` | `test_plan_id`, `wbs_node_id`, `case_count`, `covered bool`, `as_of` | uncovered deliverables are a blocking G2 criterion |
| `uat_run` | `test_case_id`, `cycle int`, `executed_by`, `executed_at`, `result`, `evidence_url N`, `comments N` | `executed_by` must hold `CLIENT_UAT_APPROVER` for `is_uat` cases |
| `defect` | `project_id`, `uat_run_id N`, `code`, `title`, `severity`, `priority`, `state`, `root_cause_wbs_id N`, `root_cause_category N`, `assigned_to N`, `opened_at`, `closed_at N`, `reopen_count`, `is_leakage bool` | `severity ∈ {S1, S2, S3, S4}`; `is_leakage` = found post-release |
| `defect_metric` | `project_id`, `wbs_node_id N`, `as_of`, `defect_count`, `size_measure`, `size_basis`, `density`, `removal_efficiency`, `mttr_hours`, `open_s1`, `open_s2`, `reopen_rate`, `arrival_lambda N`, `predicted_remaining N`, `formula_version_id` | `size_basis` configurable (work packages / test cases / KLOC) — not hardwired |
| `uat_signoff` | `project_id`, `test_plan_id`, `scope_hash`, `signed_by`, `decision`, `signed_at`, `conditions N`, `signature_hash` | `scope_hash` pins exactly which baseline scope was accepted |

---

## 7. Layer G — Phase 5: Deployment & Handover

| Table | Key columns | Notes |
|---|---|---|
| `checklist_template` | `code`, `version`, `name`, `applies_to` | reusable |
| `checklist_template_item` | `template_id`, `seq`, `text`, `verification_type`, `required_role_id`, `is_blocking` | `verification_type ∈ {MANUAL, AUTOMATED_CHECK, EVIDENCE_UPLOAD}` |
| `deployment_checklist` | `project_id`, `template_id`, `template_version`, `state`, `opened_at`, `completed_at N` | instance |
| `checklist_item` | `checklist_id`, `template_item_id`, `state`, `evidence_url N`, `automated_result N`, `verified_by N`, `verified_at N` | automated items call a registered check and store the raw result |
| `handover_package` | `project_id`, `generated_at`, `generated_by`, `document_refs jsonb`, `content_hash`, `baseline_id`, `uat_signoff_id` | hashed so the delivered pack is provable |
| `client_signoff` | `project_id`, `handover_package_id`, `signed_by`, `decision`, `signed_at`, `signature_hash`, `conditions N` | final acceptance |
| `post_mortem` | `project_id`, `conducted_at`, `facilitator`, `responses_json`, `lessons jsonb`, `estimate_variance_json`, `state` | feeds the calibration loop (see `03-AGENT-ARCHITECTURE.md` §5) |

---

## 8. Layer H — Governance Core (cross-cutting, nothing hardwired)

| Table | Key columns | Notes |
|---|---|---|
| `phase_def` | `code U`, `seq int`, `name`, `description`, `version`, `is_active` | **phases are data** — the 5 phases are seeded, not compiled in |
| `gate_def` | `code U`, `name`, `phase_from_id`, `phase_to_id`, `four_eyes bool`, `sla_hours`, `version`, `is_active` | |
| `gate_criterion` | `gate_def_id`, `code`, `label`, `criterion_type`, `formula_id N`, `comparator`, `threshold_expr`, `required_role_id N`, `is_blocking bool`, `waiver_allowed bool`, `evidence_required bool` | `criterion_type ∈ {FORMULA, DELIVERABLE, SIGNOFF, CHECKLIST, EXTERNAL_CHECK}` |
| `gate_instance` | `project_id`, `gate_def_id`, `gate_def_version`, `state`, `opened_at`, `opened_by`, `decided_at N`, `decided_by N`, `return_reason N`, `cycle int` | `state ∈ {NOT_STARTED, IN_REVIEW, RETURNED, PASSED, WAIVED_PASS, REJECTED}` |
| `gate_criterion_result` | `gate_instance_id`, `criterion_id`, `evaluated_value`, `evaluated_text N`, `passed bool`, `evaluated_at`, `formula_version_id N`, `evidence_url N` | the evidence trail for the gate decision |
| `signoff` | `gate_instance_id`, `required_role_id`, `signer_user_id`, `signer_role_grant_id`, `decision`, `signed_at`, `comment N`, `signature_hash`, `ip`, `user_agent`, `delegated_from N`, `latency_seconds` | `signer_role_grant_id` pins **which grant** authorised it — invariant I-3. `latency_seconds` exposes rubber-stamping (F-02) |
| `gate_waiver` | `gate_instance_id`, `criterion_id`, `waived_by`, `waiver_role_id`, `justification`, `valid_until N`, `compensating_control N` | requires strictly higher `authority_rank` (I-6) |

### Formula registry — the engine behind "do not hardwire any metrics"

| Table | Key columns | Notes |
|---|---|---|
| `formula` | `code U`, `name`, `domain`, `description`, `unit`, `output_type`, `input_schema jsonb` | `domain ∈ {SCORING, SCHEDULE, EVM, REVENUE, CAPACITY, RISK, QUALITY, DERIVED}` |
| `formula_version` | `formula_id`, `version int`, `expression_ast jsonb`, `expression_src text`, `input_bindings jsonb`, `state`, `created_by`, `approved_by N`, `approved_at N`, `content_hash`, `notes` | `state ∈ {DRAFT, PENDING_APPROVAL, ACTIVE, SUPERSEDED, RETIRED}` |
| `formula_test_case` | `formula_version_id`, `name`, `inputs jsonb`, `expected jsonb`, `tolerance`, `last_result N`, `last_run_at N` | **a version cannot reach ACTIVE until every test passes** (I-8) |
| `formula_binding` | `formula_id`, `formula_version_id`, `scope_kind`, `scope_id N`, `effective_from`, `effective_to N` | lets one engagement use a different ROI definition without touching anyone else's history |
| `formula_change_request` | `formula_id`, `proposed_version_id`, `rationale`, `requested_by`, `state`, `approved_by N` | **the formula registry has its own gate** — resolving the contradiction flagged in Stage 0 §DR |

**Why the registry needs its own approval gate.** "Metrics are not hardwired" and "phase
transitions are hard-gated" are in direct conflict if formulae are freely editable: a
delivery lead could edit the formula that decides whether their own project clears a gate.
The resolution is three-part:

1. `formula_change_request` requires `PMO_LEAD` (or `FINANCE_CONTROLLER` for `domain IN
   (EVM, REVENUE)`) approval before a version becomes `ACTIVE`.
2. Every stored metric row carries `formula_version_id`. A historical number is therefore
   reproducible from its own stored inputs and its own formula version, forever.
3. Changing a formula **never silently rewrites history**. Recomputing a closed period is a
   separate, privileged, ledger-logged operation that produces a *new* snapshot row
   labelled `recompute_of`, leaving the original intact.

### Audit ledger

| Table | Key columns | Notes |
|---|---|---|
| `audit_ledger` | `seq bigserial`, `firm_id`, `actor_user_id N`, `actor_agent_id N`, `actor_role_id N`, `action`, `table_name`, `record_id`, `before_json N`, `after_json N`, `reason N`, `occurred_at`, `txid`, `prev_hash bytea`, `row_hash bytea` | append-only, hash-chained **per firm** |
| `ledger_checkpoint` | `firm_id`, `up_to_seq`, `root_hash`, `created_at`, `exported_to N` | periodic anchor for tamper detection |

`row_hash = sha256(prev_hash || seq || firm_id || actor || action || table_name ||
record_id || before_json || after_json || occurred_at)`, computed **in a `BEFORE INSERT`
trigger**, never by the application. `UPDATE`/`DELETE` revoked from all roles including
`service_role`, plus a trigger that raises. A nightly `AuditSentinelAgent` walks the chain
and writes a `ledger_checkpoint`; a break is a P1 alert. (Failure mode F-10.)

---

## 9. Layer I — Agents

| Table | Key columns | Notes |
|---|---|---|
| `agent_def` | `code U`, `name`, `domain`, `authority_level`, `is_enabled`, `schedule_cron N`, `event_subscriptions text[]`, `daily_proposal_budget int`, `model_hint N` | `authority_level ∈ {L0, L1, L2, L3}`; L3 flag-gated off |
| `agent_authority` | `agent_def_id`, `action_code`, `max_magnitude_json N`, `requires_role_id`, `is_enabled` | per-action envelope; empty for L1 agents |
| `agent_run` | `agent_def_id`, `trigger_kind`, `trigger_ref N`, `started_at`, `finished_at N`, `status`, `input_hash`, `output_hash`, `engine_version`, `formula_versions jsonb`, `tokens_in N`, `tokens_out N`, `cost N`, `error N` | `input_hash`/`output_hash` give replay-level reproducibility |
| `agent_finding` | `agent_run_id`, `finding_type`, `severity`, `subject_table`, `subject_id`, `engagement_id`, `summary`, `evidence_json`, `confidence`, `state`, `dedupe_key`, `occurrence_count`, `first_seen_at`, `acked_by N` | `dedupe_key` collapses repeats into a counter rather than new rows (F-08) |
| `agent_proposal` | `agent_run_id`, `finding_id N`, `target_table`, `target_id`, `diff_json`, `rationale`, `expected_effect_json`, `requires_role_id`, `state`, `decided_by N`, `decided_at N`, `reject_reason N`, `expires_at` | **the L2 artefact.** `diff_json` is a literal before/after |
| `agent_calibration` | `agent_def_id`, `window_start`, `window_end`, `proposed`, `accepted`, `rejected`, `expired`, `acceptance_rate`, `auto_demoted bool` | an agent below the acceptance floor is auto-demoted to L1 (F-08) |
| `clash` | `clash_type`, `severity`, `horizon`, `detected_at`, `window_start`, `window_end`, `entities_json`, `magnitude`, `probability N`, `resolution_options_json`, `state`, `owner_role_id`, `resolved_at N` | `horizon ∈ {CURRENT, FORECAST}`; `probability` populated for forecast clashes by Monte Carlo |
| `foresight_run` | `scope_kind`, `scope_id`, `as_of`, `iterations`, `seed`, `correlation_model`, `p50_finish`, `p80_finish`, `p50_cost`, `p80_cost`, `p_breach`, `formula_version_id` | `seed` stored → identical reruns (determinism proof) |

---

## 10. The Phase State Machine

### 10.1 States

```
                         ┌──────────┐
                         │  INTAKE  │  Phase 1 — Ideation & Intake
                         └────┬─────┘
                         G0 ──┤ Intake Gate
                         ┌────▼─────┐
          ┌──────────────│ SCOPING  │  Phase 2 — Scoping & Planning
          │              └────┬─────┘
          │              G1 ──┤ Scope Baseline Gate
          │              ┌────▼─────┐
          │   ┌──────────│EXECUTION │  Phase 3 — Execution & Tracking
          │   │          └────┬─────┘
          │   │          G2 ──┤ Test-Readiness Gate
          │   │          ┌────▼─────┐
          │   │   ┌──────│   QA     │  Phase 4 — Testing & QA
          │   │   │      └────┬─────┘
          │   │   │      G3 ──┤ UAT Sign-off Gate
          │   │   │      ┌────▼─────┐
          │   │   │      │DEPLOYMENT│  Phase 5 — Deployment & Handover
          │   │   │      └────┬─────┘
          │   │   │      G4 ──┤ Deployment & Handover Gate
          │   │   │      ┌────▼─────┐
          │   │   │      │  CLOSED  │
          │   │   │      └──────────┘
          │   │   └─ REWORK: QA → EXECUTION (defect-driven, requires DELIVERY_LEAD)
          │   └───── REWORK: EXECUTION → SCOPING (approved change_request only)
          └───────── CANCELLED / ON_HOLD reachable from any active phase (DIRECTOR only)
```

### 10.2 Gate criteria (seeded defaults — all thresholds live in `gate_criterion.threshold_expr`, none compiled in)

**G0 — Intake Gate** (`INTAKE → SCOPING`) · four-eyes: yes

| Criterion | Type | Default threshold | Required signer |
|---|---|---|---|
| Composite score | FORMULA | `score_total >= intake_score_floor` | — |
| No blocking criterion failed | FORMULA | `count(blocking fails) = 0` | — |
| Capacity feasible | FORMULA | `intake_feasibility.feasible = true` | — |
| Conflict-of-interest clear | EXTERNAL_CHECK | `conflict_check.result = CLEAR` | — |
| Resource estimate present | DELIVERABLE | `≥1 resource_estimate per required role` | — |
| Objective linkage | FORMULA | `sum(contribution_pct) > 0` | — |
| PMO approval | SIGNOFF | — | `PMO_LEAD` |
| Director approval (value-gated) | SIGNOFF | required when `estimated_value > director_threshold` | `DIRECTOR` |

**G1 — Scope Baseline Gate** (`SCOPING → EXECUTION`) · four-eyes: yes

| Criterion | Type | Default threshold | Required signer |
|---|---|---|---|
| WBS fully decomposed | FORMULA | `count(summary nodes without children) = 0` | — |
| No dependency cycles | FORMULA | `schedule_health.cycle_count = 0` | — |
| No dangling activities | FORMULA | `dangling_count = 0` | — |
| No negative float | FORMULA | `negative_float_count = 0` | — |
| Hard constraints bounded | FORMULA | `hard_constraint_count <= hard_constraint_max` | — |
| Every leaf resourced | FORMULA | `missing_resource_count = 0` | — |
| Plan finish ≤ contract date | FORMULA | `planned_finish <= contract_milestone_date` | — |
| Planned margin floor | FORMULA | `(contract_value − BAC)/contract_value >= margin_floor` | — |
| Original baseline taken | DELIVERABLE | `baseline.is_original` exists | — |
| Contract signed | EXTERNAL_CHECK | `engagement.signed_at is not null` | — |
| Budget approved | SIGNOFF | — | `FINANCE_CONTROLLER` |
| Delivery approval | SIGNOFF | — | `ENGAGEMENT_MANAGER` |
| Client scope acceptance | SIGNOFF | — | `CLIENT_SPONSOR` |

**G2 — Test-Readiness Gate** (`EXECUTION → QA`) · four-eyes: yes

| Criterion | Type | Default threshold | Required signer |
|---|---|---|---|
| Build WBS complete | FORMULA | `pct_complete = 100` for all `node_type=WORK_PACKAGE` in build scope | — |
| Test coverage of deliverables | FORMULA | `uncovered deliverables = 0` | — |
| Test plan approved | DELIVERABLE | `test_plan.state = APPROVED` | — |
| Schedule performance | FORMULA | `spi_t >= spi_t_floor` **or** variance explanation attached | — |
| Cost performance | FORMULA | `cpi >= cpi_floor` **or** approved forecast revision | — |
| Margin not breached | FORMULA | `margin_pct >= margin_warn` | — |
| Not onerous | FORMULA | `revenue_recognition.onerous = false` **or** provision booked | — |
| Environment ready | CHECKLIST | all blocking items verified | — |
| QA readiness | SIGNOFF | — | `QA_LEAD` |
| Delivery readiness | SIGNOFF | — | `DELIVERY_LEAD` |

**G3 — UAT Sign-off Gate** (`QA → DEPLOYMENT`) · four-eyes: yes

| Criterion | Type | Default threshold | Required signer |
|---|---|---|---|
| UAT pass rate | FORMULA | `pass_rate >= uat_pass_floor` | — |
| No open S1 | FORMULA | `open_s1 = 0` | — |
| No open S2 | FORMULA | `open_s2 <= open_s2_max` | — |
| Defect density | FORMULA | `density <= density_ceiling` | — |
| Predicted residual defects | FORMULA | `predicted_remaining <= residual_max` | — |
| Traceability complete | FORMULA | every baselined deliverable has ≥1 executed UAT case | — |
| Client UAT sign-off | SIGNOFF | `scope_hash` must match the current baseline | `CLIENT_UAT_APPROVER` |
| QA sign-off | SIGNOFF | — | `QA_LEAD` |

**G4 — Deployment & Handover Gate** (`DEPLOYMENT → CLOSED`) · four-eyes: yes

| Criterion | Type | Default threshold | Required signer |
|---|---|---|---|
| Checklist verified | FORMULA | `blocking items unverified = 0` | — |
| Automated checks green | EXTERNAL_CHECK | all `AUTOMATED_CHECK` items pass | — |
| Handover package generated | DELIVERABLE | `handover_package.content_hash` present | — |
| Final revenue reconciled | FORMULA | `revenue_cum = contract_value` ± tolerance, or variance approved | — |
| All milestones gated | FORMULA | `milestone_invoice` rows all have a passed `gate_instance_id` | — |
| Post-mortem scheduled | DELIVERABLE | `post_mortem.state >= SCHEDULED` | — |
| Client final acceptance | SIGNOFF | — | `CLIENT_SPONSOR` |
| Director closeout | SIGNOFF | — | `DIRECTOR` |

### 10.3 The only legal transition path

```sql
-- consulting.advance_phase(p_project_id uuid, p_to_phase_code text, p_reason text)
-- SECURITY DEFINER. The sole writer of project.current_phase.
--
--  1. resolve the gate_def joining current_phase → p_to_phase_code
--     (no gate_def for that pair  ->  raise 'illegal transition')
--  2. load the latest gate_instance for that gate_def
--     (state <> 'PASSED' and <> 'WAIVED_PASS'  ->  raise 'gate not passed')
--  3. re-verify every blocking criterion is passed or validly waived AT THIS MOMENT
--     (a criterion that has since gone red blocks the advance — gates do not go stale)
--  4. verify signoff set:
--       - every SIGNOFF criterion has a signoff with decision='APPROVE'
--       - each signer held required_role_id in scope, inside valid_from..valid_to,
--         at signoff.signed_at                                         (I-3)
--       - signer_user_id not in (authors of the approved artefact)      (I-4)
--       - count(distinct signer_user_id) >= 2 when gate_def.four_eyes  (I-5)
--  5. update project.current_phase  (the trigger allows it only inside this function,
--     identified by a transaction-local flag)                          (I-1)
--  6. insert audit_ledger row in the same transaction                  (I-15)
--  7. open the next gate_instance in state NOT_STARTED
```

Step 3 is the part most tools get wrong: they evaluate criteria once at review time and let
the pass persist. Here a gate that passed last week but whose margin criterion has since
gone red **will not let the project advance**.

---

## 11. Entity Relationship Overview

```
firm ─┬─ app_user ─┬─ org_membership ── org_unit (tree, ltree path)
      │            ├─ user_role ── role_def                [authority_rank]
      │            └─ person_skill ── skill
      ├─ calendar ── calendar_exception
      ├─ rate_card          fx_rate_version
      ├─ objective (tree, tiered)                          ◄── Jira Align import
      ├─ conflict_group ─ client ─┬─ engagement ─┬─ engagement_member  ◄── RLS boundary
      │                          │              ├─ milestone_invoice ──┐
      │                          │              └─ revenue_recognition │
      │                          └─ opportunity ─┬─ opportunity_score ─┼─ scoring_criterion
      │                                          ├─ resource_estimate  │
      │                                          ├─ intake_feasibility │
      │                                          └─ opportunity_objective_link
      │                                                                │
      └─ project ─┬─ wbs_node (tree) ─┬─ activity ─┬─ dependency ──────┤
                  │                   │            ├─ assignment       │
                  │                   │            └─ progress_update  │
                  │                   ├─ wbs_cost_plan ── cost_account │
                  │                   └─ test_case ── uat_run ── defect│
                  ├─ baseline ─┬─ baseline_activity                    │
                  │            ├─ baseline_cost      (the PV curve)    │
                  │            └─ baseline_scope     (scope_hash)      │
                  ├─ change_request ──► new baseline version           │
                  ├─ timesheet_entry ── timesheet_period               │
                  ├─ cost_actual · forecast_version · evm_snapshot ────┤
                  ├─ schedule_health · capacity_snapshot · defect_metric
                  ├─ test_plan · uat_signoff
                  ├─ deployment_checklist ── checklist_item
                  ├─ handover_package ── client_signoff · post_mortem
                  └─ gate_instance ─┬─ gate_criterion_result ── gate_criterion ── gate_def ── phase_def
                                    ├─ signoff            [role-validated, 4-eyes, SoD]
                                    └─ gate_waiver        [higher authority_rank only]
                                          ▲
                                          └── milestone_invoice.gate_instance_id
                                              (revenue depends on governance)

formula ── formula_version ─┬─ formula_test_case   [must pass before ACTIVE]
                            ├─ formula_binding     [scope + time effective]
                            └─ formula_change_request  [its own approval gate]
    ▲ referenced by formula_version_id on EVERY metric row (I-7)

agent_def ─┬─ agent_authority
           └─ agent_run ─┬─ agent_finding ─┬─ agent_proposal  [L2: human must accept]
                         │                 └─ clash
                         └─ foresight_run  [seeded Monte Carlo]
           └─ agent_calibration  [acceptance rate → auto-demotion]

audit_ledger (append-only, hash-chained) ── ledger_checkpoint
    ▲ written by trigger on every budget / timeline / scope / role / formula mutation (I-15)
```

---

## 12. Open items carried to Stage 1

| # | Item | Why it matters |
|---|---|---|
| O-1 | `ltree` extension availability on the Supabase plan in use | `org_unit.path` design; fall back to a materialised closure table if unavailable |
| O-2 | Fiscal calendar definition (firm's FY start month) | all `fiscal_period` keys and period-close logic |
| O-3 | Whether client-side users authenticate into this instance or receive exported signoff packets | changes `CLIENT_*` role plumbing and the signature model |
| O-4 | Base currency and whether multi-currency is live at launch | if single-currency, `fx_rate_version` can be seeded with identity rates |
| O-5 | Does `pg_cron` / Supabase scheduled functions drive agent runs, or a GitHub Action like `refresh-data.yml` | agent scheduler implementation |

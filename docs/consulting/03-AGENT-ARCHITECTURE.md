# 03 — Agent Architecture, Authority & Human Interaction Protocol

**Authority ceiling: L2 (Propose with diff)** — locked in DR-04.

This document answers the question you explicitly deferred to me: *how deep do the agents
interact with team members?* The answer is specified as a ladder, a per-action matrix, a
set of channels, and an escalation protocol — all of it data, none of it compiled in.

---

## 1. The Prime Directive: agents do not compute

```
┌──────────────────────────────────────────────────────────────────────────┐
│  src/lib/consulting/engine/**        PURE · DETERMINISTIC · TESTED       │
│                                                                          │
│  cpm.ts  evm.ts  earnedSchedule.ts  scoring.ts  capacity.ts              │
│  revenue.ts  quality.ts  montecarlo.ts  clash.ts  formulaEval.ts         │
│                                                                          │
│  No model client. No network. No clock read (time is injected).          │
│  Same inputs → byte-identical outputs, forever.                          │
└──────────────────────────────────────────────────────────────────────────┘
                                   ▲
                                   │ calls (never reimplements)
                                   │
┌──────────────────────────────────────────────────────────────────────────┐
│  src/lib/consulting/agents/**       LLM-DRIVEN · NON-DETERMINISTIC        │
│                                                                          │
│  Permitted: interpret results · rank findings · write rationale ·         │
│             draft a diff · choose which option to propose ·               │
│             summarise for a human · ask a clarifying question            │
│                                                                          │
│  Forbidden: arithmetic · deciding a gate · writing a metric row ·         │
│             mutating any delivery table directly                         │
└──────────────────────────────────────────────────────────────────────────┘
```

**Enforcement (invariant I-11):** a CI test walks the import graph under `engine/` and
fails the build if any module reaches an AI SDK, `fetch`, `Date.now()`, or `Math.random()`
without an injected source. Determinism is tested by running every engine function twice on
a fixed fixture and asserting byte equality, plus replaying `foresight_run.seed` and
asserting identical quantiles.

Why this is non-negotiable: you asked for proof of everything and for back-testing. Neither
is possible if an LLM produces the numbers — the same project would score differently on
Tuesday. The LLM's job is *judgement and language*; the engine's job is *arithmetic*.

---

## 2. The Authority Ladder

| Level | Agent may | Human obligation | Mutation path | Used by |
|---|---|---|---|---|
| **L0 Observe** | read, call engine, write metric rows (`evm_snapshot`, `capacity_snapshot`, `schedule_health`, `defect_metric`) | none | metric tables only, each stamped with `formula_version_id` | every agent's compute phase |
| **L1 Advise** | emit `agent_finding`; notify; rank | read & acknowledge | none | GateKeeper, AuditSentinel |
| **L2 Propose** | emit `agent_proposal` carrying a literal `diff_json` (before → after) + `rationale` + `expected_effect_json` | a named holder of `requires_role_id` must **Accept** or **Reject**; a Reject requires a reason, captured for calibration | only on Accept, applied by the server as the accepting human's action | default for all other agents |
| **L3 Act** | execute inside `agent_authority.max_magnitude_json`; human reviews post-hoc | review within SLA, may revert | direct, envelope-bounded | **built, flag OFF** |
| **L4 Approve** | — | — | — | **architecturally impossible** |

### Why L4 cannot be enabled even by changing a flag

`signoff.signer_user_id` is `NOT NULL REFERENCES consulting.app_user(id)`. Agents live in
`agent_def` and have no `app_user` row, therefore no `user_role` grant, therefore cannot
satisfy invariant I-3. Making an agent sign would require a schema migration plus a new
`app_user` row — which would itself appear on the audit ledger as a `DIRECTOR`-authorised
identity creation. There is no quiet path to it. That is the point of a hard gate.

### What L3 would unlock (and why it stays off at launch)

`agent_authority` rows define an envelope per action, e.g.:

| `action_code` | `max_magnitude_json` | `requires_role_id` |
|---|---|---|
| `REALLOCATE_ASSIGNMENT` | `{"max_hours_per_week": 8, "same_role_only": true, "non_critical_path_only": true}` | DELIVERY_LEAD |
| `SHIFT_ACTIVITY` | `{"max_days": 3, "requires_float_ge": 5, "non_critical_path_only": true}` | DELIVERY_LEAD |
| `OPEN_DEFECT` | `{"max_severity": "S3"}` | QA_LEAD |
| `RECOMPUTE_SNAPSHOT` | `{"open_periods_only": true}` | PMO_LEAD |

Anything outside the envelope automatically degrades to L2. It stays off at launch because
the acceptance-rate data in `agent_calibration` does not exist yet — enabling autonomous
action before you know an agent's rejection rate is how you lose the team's trust in one
afternoon. The gate to switch it on is stated in `05-BUILD-STAGES.md` §7.

---

## 3. The Subagent Fleet

Ten dedicated agents. Each has one domain, one authority level, and one owning role.

### A-01 · IntakeTriageAgent — L2
| | |
|---|---|
| **Triggers** | event `opportunity.submitted`; cron nightly re-score |
| **Engine calls** | F-SC-01..09, F-CP-01..03 |
| **Reads** | `opportunity`, `objective` tree, historical `post_mortem`, `scoring_model` |
| **Proposes** | criterion values for `MANUAL` criteria, inferred from the narrative + analogous past engagements; objective links with contribution weights; missing-input requests |
| **Accepting role** | `PMO_LEAD` |
| **Never** | sets `score_total` (that is F-SC-02 on accepted inputs); approves G0 |

### A-02 · EstimationAgent — L2
| | |
|---|---|
| **Triggers** | event `opportunity.scored`; event `wbs.decomposed` |
| **Engine calls** | F-CP-01, F-CP-02, F-CP-03 |
| **Reads** | closed projects' `post_mortem.estimate_variance_json`, `baseline_activity` vs actuals |
| **Proposes** | 3-point estimates per role, with the analogous projects cited as evidence; a drag factor derived from this firm's historical optimism bias |
| **Accepting role** | `DELIVERY_LEAD` |
| **Key behaviour** | reports its own historical MAPE on every proposal, so the reviewer knows how much to trust it |

### A-03 · ScheduleAgent — L2
| | |
|---|---|
| **Triggers** | event `dependency.*`, `activity.*`; cron nightly |
| **Engine calls** | F-SD-01..05 |
| **Proposes** | dependency additions for dangling activities; cycle-breaking edge removals (with the SCC enumerated); re-sequencing to clear negative float; constraint removals |
| **Accepting role** | `DELIVERY_LEAD` |
| **Never** | touches `baseline_*` (invariant I-10); changes `duration_days` without an EstimationAgent basis |

### A-04 · ResourceClashAgent — L2
| | |
|---|---|
| **Triggers** | event `assignment.*`, `timesheet.approved`, `engagement.created`; cron nightly |
| **Engine calls** | F-CP-04..08, F-RK-02 |
| **Detects** | current over-allocation; forecast over-allocation to `foresight_days`; skill-capacity bottlenecks; **conflict-group staffing violations** |
| **Proposes** | reallocation options ranked by F-RK-04, each with its effect on every affected project's finish date |
| **Accepting role** | `DELIVERY_LEAD`, escalating to `ENGAGEMENT_MANAGER` when >1 engagement is affected |
| **Hard rule** | a proposal that would place a person across a live conflict group is **never emitted** — it is raised as a `CLASH_CONFLICT_OF_INTEREST` finding to `PMO_LEAD` instead |

### A-05 · FinancialGuardAgent — L2
| | |
|---|---|
| **Triggers** | event `timesheet.approved`, `expense.approved`, `change_request.approved`, `period.closed`; cron daily |
| **Engine calls** | F-EV-01..14, F-RV-01..07 |
| **Detects** | CPI / SPI(t) drift; EAC growth; margin erosion past `margin_warn`; burn-rate runway breach; onerous-contract trigger; POC vs realised-margin divergence; revenue reversal |
| **Proposes** | a new `forecast_version` (DRAFT) with the method switched per F-EV-10 when `CPI < force_bottom_up_cpi`; a loss provision when F-RV-06 trips; escalation to `DIRECTOR` past `margin_critical` |
| **Accepting role** | `FINANCE_CONTROLLER` (forecast / provision), `ENGAGEMENT_MANAGER` (delivery actions) |
| **Never** | writes `revenue_recognition` for a closed period; marks a forecast `APPROVED` |

### A-06 · QAAgent — L2
| | |
|---|---|
| **Triggers** | event `uat_run.recorded`, `defect.*`; cron daily during Phase 4 |
| **Engine calls** | F-QA-01..07 |
| **Detects** | density/weighted-density breach; traceability gaps against `baseline_scope`; blocked-rate masking; reopen-rate invalidating pass rate; arrival-curve forecast of residual defects |
| **Proposes** | test cases for uncovered baselined deliverables; severity reclassification with evidence; a predicted UAT-ready date with confidence |
| **Accepting role** | `QA_LEAD` |
| **Never** | closes a defect; records a `uat_run`; signs G3 |

### A-07 · GateKeeperAgent — **L1 only, deliberately capped**
| | |
|---|---|
| **Triggers** | event `gate_instance.opened`; event on any criterion's underlying data; cron hourly on open gates |
| **Engine calls** | F-GV-01, plus re-evaluation of every `FORMULA` criterion |
| **Emits** | a readiness report: per-criterion pass/fail with the evaluated value, the formula version, and what would have to change; a **"gate has gone stale"** finding when a previously-passed criterion turns red |
| **Accepting role** | n/a — advisory only |
| **Capped at L1 on purpose** | an agent that can *propose* a gate outcome starts to look like an agent that decides one. The one place in the system where agent influence is held furthest from the decision is the gate itself. It reports; humans decide. |

### A-08 · AuditSentinelAgent — L1
| | |
|---|---|
| **Triggers** | cron nightly; event `signoff.created`, `gate_waiver.created`, `formula_version.activated`, `user_role.granted` |
| **Engine calls** | F-GV-02..05 |
| **Detects** | hash-chain break (P1); retro-dated timesheets (`entry_date` vs `created_at` divergence); rubber-stamp latency; approvals-per-day outliers; self-approval attempts; privilege escalation; formula activation without an approved `formula_change_request`; revenue resting on waivers |
| **Accepting role** | n/a — reports to `PMO_LEAD` and `DIRECTOR`, and a hash-chain break pages immediately |
| **Independence** | reads the ledger through a dedicated read-only role and never writes to it |

### A-09 · ForesightAgent — L2
| | |
|---|---|
| **Triggers** | cron nightly firm-wide; event `baseline.created`, `forecast_version.approved` |
| **Engine calls** | F-RK-01..04, F-SD-01, F-CP-05 |
| **Detects** | **future** clashes: P(gate breach) per gate; P50/P80 finish and cost; cross-engagement resource collisions in the forward window; the earliest date at which a currently-healthy project becomes unrecoverable |
| **Proposes** | ranked mitigations, each quantified as a Δ in P(breach) — "add 0.5 FTE Architect in W12 → P(G3 breach) 0.62 → 0.21" |
| **Accepting role** | `ENGAGEMENT_MANAGER`, escalating to `DIRECTOR` when >2 engagements are affected |
| **Determinism** | `foresight_run.seed` is stored; a rerun with the same seed and inputs is byte-identical |

### A-10 · PostMortemAgent — L2
| | |
|---|---|
| **Triggers** | event `project.closed`; cron monthly calibration sweep |
| **Engine calls** | variance decomposition over `baseline_*` vs actuals; F-QA-04 |
| **Produces** | estimate-vs-actual decomposition by role, phase and WBS branch; which gate criteria were leading indicators and which were noise; which agent findings were later vindicated |
| **Proposes** | **recalibrated ⚙ parameters as a `formula_change_request`** — e.g. `rho_default 0.30 → 0.41`, `short_pkg_days 10 → 7` |
| **Accepting role** | `PMO_LEAD` (or `FINANCE_CONTROLLER` for EVM/REVENUE domains) |
| **Critical constraint** | a calibration proposal **never auto-applies**. It goes through the formula registry's own gate, and it is validated walk-forward out-of-sample before being proposed (failure mode F-20). This is the learning loop, and it is the one loop that must stay slow. |

---

## 4. Human Interaction Protocol — the answer to "how deep?"

### 4.1 Four channels, by urgency

| Channel | Latency | Carries | Example |
|---|---|---|---|
| **Proposal Inbox** (per role, in-app) | pull | all `agent_proposal` rows awaiting that role | "Reallocate 6h/wk from PRJ-112 to PRJ-098" |
| **Finding Feed** (per engagement) | pull | `agent_finding` rows, deduped with occurrence counts | "SPI(t) 0.82 for 3 consecutive periods" |
| **Digest** (email/Slack, ⚙ schedule) | daily / weekly | top-N by F-RK-04 priority for that person's roles | director daily digest, consultant weekly |
| **Escalation** (push) | immediate | severity ≥ ⚙ `escalate_severity`; hash-chain break; onerous-contract trigger; S1 defect at G3 | pages `DIRECTOR` |

### 4.2 What a proposal looks like

Every `agent_proposal` must carry all five, or it is rejected at insert by a check constraint:

1. **`diff_json`** — the literal before/after of specific rows. Not prose.
2. **`rationale`** — why, in ≤3 sentences, citing the finding and the formula version.
3. **`expected_effect_json`** — the quantified consequence, computed by the engine:
   affected projects, Δ finish date, Δ EAC, Δ margin, Δ P(breach).
4. **`requires_role_id`** — exactly who may accept.
5. **`expires_at`** — default ⚙ `proposal_ttl_hours = 72`.

The reviewer sees the diff, the reason, and the cost of doing nothing. They click Accept or
Reject-with-reason. On Accept the server applies the diff **as that human's action** —
`audit_ledger.actor_user_id` is the human, with `actor_agent_id` recorded alongside as the
originator. The human owns the change; the agent owns the suggestion. That distinction is
what keeps the audit trail answerable to "who authorised this modification."

### 4.3 Expiry and escalation

```
proposal created
   ├─ accepted  →  diff applied as human action, ledger written, calibration +1 accept
   ├─ rejected  →  reason captured, calibration +1 reject, dedupe_key suppressed ⚙ 7 days
   └─ no action by expires_at
         ├─ severity < escalate_severity  →  EXPIRED, calibration +1 expire, silent
         └─ severity ≥ escalate_severity  →  re-issued to the next higher authority_rank,
                                             original marked ESCALATED, ledger written
```

Escalation depth is capped at ⚙ `max_escalation_hops = 2` so nothing loops to the Director
forever. A proposal that expires twice at Director level becomes a standing
`agent_finding` on the engagement's risk register.

### 4.4 What agents may never do to a person

| Prohibited | Why |
|---|---|
| Contact a client-side user directly | all client-facing output passes a firm-side human. A client must never receive an unreviewed machine assertion about their own project. |
| Write to a performance or HR record | utilisation and variance data is for delivery forecasting, not appraisal. There is no agent path to an HR system, by design. |
| Name an individual as the cause of a variance | findings attribute to activities, roles and work packages. `root_cause_category`, never `root_cause_person`. |
| Reassign a person without `DELIVERY_LEAD` acceptance | people are not fungible resources; a reallocation proposal always names the human who must agree. |
| Act during a locked period | `timesheet_period.locked_at` blocks all proposals touching that period. |

That third row is a deliberate design constraint, not a nicety: an agent that attributes
overruns to named individuals will be gamed within a month — people will stop reporting
accurate progress. The system's data quality depends on the data not being used against the
people entering it.

### 4.5 Interaction depth by role

| Role | Sees | Must act on | Digest |
|---|---|---|---|
| `DIRECTOR` | firm-wide, all engagements | escalations; G0 (value-gated) & G4 signoffs; waivers | daily |
| `PMO_LEAD` | firm-wide governance | G0 signoff; formula change requests; conflict findings; calibration proposals | daily |
| `FINANCE_CONTROLLER` | all financials | G1 signoff; forecast & provision proposals | daily |
| `ENGAGEMENT_MANAGER` | own engagements | G1 signoff; cross-project clash proposals; foresight mitigations | daily |
| `DELIVERY_LEAD` | own projects | G2 signoff; schedule, estimation & reallocation proposals | daily |
| `QA_LEAD` | own projects' QA | G2 & G3 signoff; QA proposals | daily during Phase 4 |
| `SOLUTION_ARCHITECT` | assigned projects | technical findings, advisory only | weekly |
| `CONSULTANT` / `ANALYST` | own assignments & timesheets | own timesheet + progress updates; stall prompts | weekly |
| `CLIENT_SPONSOR` | own engagement, curated view | G1 & G4 signoff | never (human-sent only) |
| `CLIENT_UAT_APPROVER` | own engagement UAT | G3 signoff; UAT execution | never |
| `CLIENT_OBSERVER` | own engagement, read-only curated | — | never |

---

## 5. The Autonomous Feedback Loops

Four nested loops, each with a different time constant. The nesting is the point: a fast
loop that can change a slow loop's parameters without approval is how a governance system
silently drifts.

### Loop 1 — Detection (minutes to hours)

```
   data mutation (timesheet, progress, dependency, defect, assignment)
        │
        ▼  event bus
   agent compute phase (L0): engine recalculates affected metrics
        │
        ▼
   threshold comparison against ⚙ parameters
        │
        ├─ within tolerance ──────────────────────────► no output (silence is a feature)
        └─ breach ──► agent_finding (deduped by dedupe_key, occurrence_count++)
```

### Loop 2 — Proposal & human decision (hours to days)

```
   agent_finding (severity ≥ ⚙ propose_severity)
        │
        ▼
   LLM phase: rank by F-RK-04, select option, draft diff + rationale
        │
        ▼
   engine phase: compute expected_effect_json for the drafted diff
        │
        ▼
   agent_proposal ──► Proposal Inbox of requires_role_id
        │
        ├─ Accept ──► diff applied as human action ──► Loop 1 re-fires on the new data
        ├─ Reject ──► reason captured ──► Loop 4
        └─ Expire ──► escalate or lapse ──► Loop 4
```

### Loop 3 — Foresight (nightly)

```
   cron nightly, firm-wide
        │
        ▼
   for each project: CPM forward pass on current forecast (F-SD-01)
        │
        ▼
   Monte Carlo with stored seed (F-RK-01, ρ-correlated)
        │
        ▼
   cross-engagement resource projection (F-RK-02) + gate breach probability (F-RK-03)
        │
        ▼
   clash rows with horizon=FORECAST, probability, lead_time
        │
        ▼
   ForesightAgent proposes mitigations quantified as Δ P(breach)
```

This is the **forward-view clash engine**. It answers "what will collide in eight weeks",
not "what collided yesterday" — and it does so deterministically, from a stored seed.

### Loop 4 — Calibration (monthly, gated)

```
   agent_calibration window closes
        │
        ▼
   acceptance_rate = accepted / (accepted + rejected + expired)
        │
        ├─ acceptance_rate < ⚙ demote_floor (0.30)  ──► auto-demote agent to L1,
        │                                                 flag for review  [F-08]
        ├─ rejection reasons clustered              ──► PostMortemAgent analyses the cluster
        └─ project closed                           ──► estimate-vs-actual decomposition
        │
        ▼
   walk-forward out-of-sample validation of any proposed ⚙ change
        │
        ▼
   formula_change_request  ──►  PMO_LEAD / FINANCE_CONTROLLER approval  ──►  new
   formula_version ACTIVE (history untouched, invariant I-7)
```

**The load-bearing constraint:** Loop 4 cannot change anything on its own. It can only
*request* a parameter change, and the request goes through the formula registry's own gate.
Without this, the fast loops would gradually rewrite the thresholds that constrain them —
a system that tunes away its own alarms.

---

## 6. Orchestration & Determinism

### Scheduling

| Mechanism | Used for | Source |
|---|---|---|
| `pg_cron` (or a GitHub Action in the shape of `.github/workflows/refresh-data.yml`) | nightly sweeps, Loop 3 | open item O-5 |
| Postgres `NOTIFY` → a Next.js route handler | event triggers, Loop 1 | `src/app/api/consulting/agents/dispatch` |
| Manual run | debugging, replay | agent console, `PMO_LEAD` |

### Reproducibility contract

Every `agent_run` stores:

- `input_hash` — sha256 of the canonicalised input set (row ids + versions, not full rows)
- `engine_version` — git sha of `src/lib/consulting/engine/`
- `formula_versions` — the exact `formula_version_id` set used
- `output_hash` — sha256 of the emitted findings/proposals
- `seed` (on `foresight_run`)

A run is **replayable**: given `input_hash` + `engine_version` + `formula_versions` + `seed`,
the engine portion reproduces byte-identically. The LLM portion does not, and is not claimed
to — which is exactly why no number comes from it.

### Cost control

`agent_def.daily_proposal_budget` caps proposals per agent per day. `agent_run` records
`tokens_in/out/cost`. A firm-level daily ceiling (⚙ `agent_cost_ceiling`) suspends
non-critical agents when breached, logging the suspension. Escalation-severity findings are
exempt from the ceiling.

---

## 7. Agent Fleet Summary

| # | Agent | Level | Domain | Accepting role | Primary loop |
|---|---|---|---|---|---|
| A-01 | IntakeTriageAgent | L2 | scoring | PMO_LEAD | 1, 2 |
| A-02 | EstimationAgent | L2 | capacity | DELIVERY_LEAD | 1, 2 |
| A-03 | ScheduleAgent | L2 | schedule | DELIVERY_LEAD | 1, 2 |
| A-04 | ResourceClashAgent | L2 | capacity | DELIVERY_LEAD / ENG_MGR | 1, 2, 3 |
| A-05 | FinancialGuardAgent | L2 | EVM + revenue | FINANCE_CONTROLLER / ENG_MGR | 1, 2 |
| A-06 | QAAgent | L2 | quality | QA_LEAD | 1, 2 |
| A-07 | GateKeeperAgent | **L1** | governance | — (advisory) | 1 |
| A-08 | AuditSentinelAgent | **L1** | audit | — (reports) | 1 |
| A-09 | ForesightAgent | L2 | risk | ENG_MGR / DIRECTOR | 3 |
| A-10 | PostMortemAgent | L2 | calibration | PMO_LEAD / FIN_CTRL | 4 |

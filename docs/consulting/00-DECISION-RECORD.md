# 00 — Decision Record & Platform Teardown

**System:** Integrated Consulting Delivery Governance Platform (codename **ATLAS**)
**Status:** Stage 0 — architecture, pre-code
**Date:** 2026-10-16
**Owner:** rogerhabr71@gmail.com

---

## 1. Platform Teardown — What We Are Actually Cloning

Two reference platforms were studied. They are not variants of one idea; they encode
opposite governance philosophies. Choosing "either" without analysis guarantees fighting
the framework for most of the stated requirements.

### 1.1 Planisware — deterministic, financially-gated PPM

Object graph (as inferred from product documentation and the PPM core-components model):

```
Portfolio / Investment bucket
  └── Program
        └── Project
              ├── Phase ── Gate ── Deliverable ── Approval record
              ├── WBS element (Deliverable / Work package / Activity / Milestone)
              │     ├── Dependency (FS / SS / FF / SF + lag)
              │     └── Assignment ── Timesheet ── Cost line
              ├── Budget envelope ── Cost account ── Forecast version
              └── Baseline (schedule + cost + scope snapshot)
Resource ── Role / Skill ── Capacity calendar ── Cost rate / Bill rate
Scoring: Criteria set ── Weight ── Scorecard ── Priority rank
```

Planisware's documented design thesis is that an R&D/NPD portfolio runs **three models
over one governed data environment**:

| Model | Purpose | Our mapping |
|---|---|---|
| **Stage-gate model** | decision discipline; budget release tied to formal approval milestones | Phases 1–5 + gates G0–G4 |
| **Scoring model** | prioritisation against strategic objectives, expected value, risk, feasibility — "shifts debate from advocacy to evidence" | Phase 1 intake scoring |
| **Capacity model** | feasibility; skill-based capacity planning that surfaces bottlenecks in shared critical roles *before* dates are at risk | Resource clash engine |

The phrase *"before launch dates are at risk"* is precisely the forward-view clash
requirement in the brief. Planisware solves it with skill-based capacity modelling, not
with inference.

### 1.2 Jira Align — flow-based SAFe alignment

Two **parallel** hierarchies, which is its genuine architectural contribution:

```
PEOPLE / ORG                          WORK / REQUIREMENTS
Enterprise                            Theme
  └── Portfolio                         └── Epic
        └── (Solution)                        └── Capability
              └── Program (ART)                     └── Feature
                    └── Team                              └── Story
TIME: Program Increment (PI) └── Sprint
OBJECTIVES: tiered team | program | solution | portfolio, with parent→child rollup
```

Documented constraint: *every user must ultimately belong to a team to see data* — i.e. the
org tree is the visibility primitive, not the project.

### 1.3 Requirement-by-requirement fit

| Brief requirement | Planisware | Jira Align | Verdict |
|---|---|---|---|
| Hard-gated phase transitions, role-ID signoff | **Core primitive** | Absent by design (SAFe removes gates) | Planisware |
| EVM — SPI / CPI tracking | **Native** | **Anti-pattern** in SAFe; not modelled | Planisware |
| WBS with FS/SS dependency mapping | **Native** | No WBS | Planisware |
| Baseline snapshot / scope-creep tracking | **Native** | Partial (PI commitment only) | Planisware |
| Scoring matrices (ROI, alignment, complexity) | **Native** | Weak (value points) | Planisware |
| Resource estimation & capacity feasibility | **Native** | Team velocity only | Planisware |
| Timesheets / burn rate | Native | Absent | Planisware |
| UAT log + signoff → deployment trigger | Partial | Absent | Build fresh |
| Defect density | Absent | Absent | Build fresh |
| People org as first-class, independent of project | Weak (resources hang off projects) | **Native & better** | **Jira Align** |
| Strategic alignment as a *computed* rollup, not a typed score | Weak (manual criterion) | **Native & better** (tiered objective tree) | **Jira Align** |
| Client as a security boundary / conflict-of-interest walls | Absent | Absent | Build fresh |
| Revenue recognition (fixed-price / milestone) | Partial | Absent | Build fresh |

**Conclusion: the brief is ~90% Planisware.** Cloning Jira Align would require bolting
gates, EVM, WBS and baselines onto a framework explicitly designed without them.

---

## 2. Locked Decisions

### DR-01 — Codebase placement
**Decision:** same repository, new Next.js route group `src/app/(consulting)/`, same Supabase
project, dedicated `consulting` Postgres schema.

**Rationale:** inherits auth, RLS, `middleware.ts`, CI, Vercel, Sentry, and the CLAUDE.md
13-layer policy at zero cost. A separate repo would mean rebuilding all thirteen layers.

**Accepted risk:** single deploy blast radius with the tokenomics dashboard. Mitigated by
`SectionErrorBoundary`-style isolation per route group and by CI gating on `npm run build`.

**Hard constraint:** consulting RBAC **must not** reuse `public.profiles.role`
(see DR-05).

### DR-02 — Platform DNA
**Decision:** Planisware-shaped core. Import exactly two mechanisms from Jira Align:

1. **Dual hierarchy.** `org_unit` (firm → practice → capability group → pod) is a
   first-class self-referencing tree, independent of `project`/`wbs_node`. Reason: a
   consulting firm shares people across concurrent client engagements; resource contention
   is only computable if the people tree exists independently of any one project.
2. **Tiered objective tree.** `objective` is hierarchical (firm → practice → engagement →
   project) with weighted parent↔child rollup. Reason: the Phase-1 "strategic alignment"
   score becomes a **derived path weight**, not a number a sponsor types into a box. This
   is the single largest integrity improvement to the scoring matrix.

**Explicitly rejected from Jira Align:** PI/sprint time-boxing, flow metrics as primary,
story-point estimation, gateless progression.

### DR-03 — Contract & revenue types in scope
**Decision:** `FIXED_PRICE` and `MILESTONE / RETAINER / OUTCOME`. Time & Materials is
**out of scope**.

**Consequences — these drive the whole financial engine:**

| Consequence | Detail |
|---|---|
| CPI is meaningful | Cost ≠ revenue, so `CPI = EV/AC` is a true efficiency signal and overrun erodes margin directly. (Under T&M, `cost ≡ revenue` forces `CPI → 1.0` and the metric is noise — excluding T&M removes that trap.) |
| Timesheets are a **cost** instrument only | Hours never bill. `AC = Σ(approved hours × cost_rate) + expenses`. No realisation rate, no effective bill rate, no leakage model needed. |
| Revenue is decoupled from effort | Recognised via percent-complete (cost-to-cost or effort-based) **or** milestone acceptance. |
| **Revenue depends on the gate engine** | A milestone is not revenue until the corresponding signoff exists. `milestone_invoice` is foreign-keyed to `gate_instance`. This makes the governance layer load-bearing on the P&L, not decorative. |
| Onerous-contract test is mandatory | Fixed-price means a project can be loss-making. When `EAC > contract_value`, the full expected loss must be provisioned immediately (IFRS 15 / ASC 606). Most project trackers omit this; it is a blocking criterion here. |
| Margin is the primary KPI | `margin = (contract_value − EAC)/contract_value`. Textbook EVM omits it; a consulting director cares about nothing else. |

### DR-04 — Agent authority ceiling: **L2 (Propose with diff)**
Agents may read, compute, and emit a concrete before/after diff as an `agent_proposal`.
A named human role-holder must Accept or Reject. **Nothing mutates autonomously.**
L3 (bounded autonomous action) infrastructure is built but feature-flagged **off**.
L4 (agent approves a gate) is made *architecturally impossible*, not merely disabled:
`signoff.signer_id` references a human `app_user`, and agents have no user identity.
Full ladder and interaction protocol in `03-AGENT-ARCHITECTURE.md`.

### DR-05 — Do not extend `profiles.role`
**Decision:** consulting authorisation lives in `consulting.role_def` / `consulting.user_role`
/ `consulting.engagement_member`. `public.profiles.role` is not used for any gate decision.

**Rationale — a live defect in this repository.** `supabase/migrations/0001_init.sql:18-20`:

```sql
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);
```

There is no `WITH CHECK` clause. For `UPDATE`, Postgres falls back to the `USING`
expression as the row check, which only pins `id`. Therefore any authenticated user can
execute:

```sql
update public.profiles set role = 'admin' where id = auth.uid();
```

and RLS permits it. `profiles.role` is documented in CLAUDE.md as the future RBAC column —
so this is a direct privilege-escalation path into any gate that trusts it.

**Remediation (Stage 1):** add a column-restricting `WITH CHECK`, revoke `UPDATE` on
`role` from `authenticated`, and move role mutation behind a `SECURITY DEFINER` function
that writes to the audit ledger. Carried as finding **F-17** in `04-FMEA.md`.

### DR-06 — Org and objective trees use a materialised TEXT path, not `ltree`
**Decision:** `org_unit.path` / `objective.path` are `text` with a
`text_pattern_ops` index; ancestor and descendant queries are prefix `LIKE`s.

**Rationale:** removes Stage 0 open item **O-1** (whether `ltree` is available on
the Supabase plan in use) at no functional loss. One fewer extension dependency.

**Bug this surfaced during implementation:** the subtree re-path trigger was
originally `AFTER UPDATE OF path`. Postgres arms an `UPDATE OF col` trigger from
the columns **named in the statement**, not from columns a BEFORE trigger went on
to change — and `update org_unit set parent_id = ...` never names `path`. The
result was that a practice could move while every descendant kept a stale path
and a wrong depth, silently. Both triggers now fire unconditionally and guard on
`is distinct from`. Proven by executing a real subtree move, not by review.

### DR-07 — Client-side users authenticate into the platform
**Decision:** `CLIENT_SPONSOR`, `CLIENT_UAT_APPROVER` and `CLIENT_OBSERVER` are
real `app_user` rows (`party = 'CLIENT'`, pinned to one `client_id`) with real
time-windowed `user_role` grants.

**Consequence:** invariant **I-3** applies to client signatures too. A client UAT
sign-off is tied to an authenticated identity whose grant was provably live at
the moment of signing, rather than to an attached document. Enforced by
`guard_uat_executor_role()` — a UAT case cannot be executed by anyone without a
live `CLIENT_UAT_APPROVER` grant in scope. Resolves open item **O-3**.

### DR-08 — Single currency at launch, multi-currency schema in place
**Decision:** every money column carries `currency`; cross-currency aggregates
require an explicit `fx_rate_version_id`; `firm.multi_currency_enabled` is
`false` at launch and `fx_rate_version` is seeded with identity rates.
Resolves open item **O-4**. Fiscal year starts in **January** (open item **O-2**).

### DR-09 — A shipped formula default is not an approved one
**Decision:** `formula_version.provenance ∈ {SEEDED, HUMAN, AGENT_PROPOSED}`. A
`SEEDED` version may be `ACTIVE` with **no** approver, and is forbidden from
carrying one.

**Rationale:** this surfaced as a constraint violation while seeding. The
constraint was right and the seed was wrong. `seed_firm_defaults()` originally
set `state='ACTIVE', approved_at=now()` with a null approver; the obvious
"fixes" were to relax the constraint or to stamp a system user as approver.
Both put a falsehood in the audit trail — nobody at the firm has approved a
vendor default. `SEEDED` says so explicitly, and
`consulting.formula_staleness` turns it into the FMEA **F-01b** ossification
report: every threshold still running on a default nobody here has ever looked
at. The two failure halves of F-01b — silent edits and silent ossification —
are now both visible.

---

## 3. Architectural Invariants

Non-negotiable. Every subsequent stage is tested against these.

| # | Invariant | Enforced by |
|---|---|---|
| **I-1** | A project's phase can change **only** via `consulting.advance_phase()`. Direct `UPDATE` on `project.current_phase` is blocked. | `BEFORE UPDATE` trigger |
| **I-2** | `advance_phase()` succeeds only if the governing `gate_instance` is `PASSED`. | function body |
| **I-3** | A signoff is valid only if the signer holds the required `role_def` **in the required scope at the moment of signing**. | trigger + `user_role` validity window |
| **I-4** | **Segregation of duties:** the signer of a gate criterion may not be the actor who produced the artefact being approved. | trigger comparing `audit_ledger` authorship |
| **I-5** | **Four-eyes:** ≥2 distinct human identities per gate where `gate_def.four_eyes = true`. Delegation does not satisfy this. | trigger |
| **I-6** | A criterion waiver requires a role of strictly **higher** authority rank than the criterion's `required_role_id`. | trigger |
| **I-7** | Every number displayed anywhere carries a `formula_version_id`. No value is computed by ad-hoc code. | NOT NULL FK on all metric tables |
| **I-8** | A `formula_version` may become `ACTIVE` only after approval **and** only if all its `formula_test_case` rows pass. | function + CI |
| **I-9** | `audit_ledger` is append-only and hash-chained. `prev_hash`/`row_hash` are computed in-database. `UPDATE`/`DELETE` are revoked and additionally blocked by trigger. | grants + trigger |
| **I-10** | Post-G1, baseline rows are immutable. Scope change requires `change_request` → approval → new `baseline` version; lineage to the **original** baseline is never broken. | trigger + `baseline.parent_version` |
| **I-11** | No arithmetic inside the LLM boundary. `src/lib/consulting/engine/**` is pure, deterministic, dependency-free of any model client. | CI test asserting no AI SDK import under `engine/` |
| **I-12** | Agents cannot hold a role, sign, waive, or advance a phase. | schema: no agent identity in `user_role`/`signoff` |
| **I-13** | Cross-client visibility is denied by default and governed by `conflict_group`; aggregate views apply the same barrier, not just row views. | RLS on base tables + barrier views |
| **I-14** | Money columns never sum without an explicit `currency` + `fx_rate_version`. | composite type + check constraint |
| **I-15** | Every mutation that touches budget, timeline, scope, role, or formula writes a ledger row **in the same transaction**. | trigger, not application code |

---

## 4. Deliverable Map

| Doc | Content |
|---|---|
| `00-DECISION-RECORD.md` | this file — platform study, locked decisions, invariants |
| `01-DOMAIN-MODEL.md` | full entity model, ERD, 5-phase state machine, gate criteria |
| `02-FORMULA-CATALOGUE.md` | every formula with symbols, defaults, and degeneracy notes |
| `03-AGENT-ARCHITECTURE.md` | subagent fleet, authority ladder, human-interaction protocol, feedback loops |
| `04-FMEA.md` | 20 failure modes, severity, detection, mitigation |
| `05-BUILD-STAGES.md` | staged build plan, inter-stage contracts, backtest & forward-pass protocol |

---

## Sources

- [Planisware — 6 Core Components of Project Portfolio Management](https://planisware.com/resources/project-management-office-pmo/core-components-project-portfolio-management)
- [Planisware — Enterprise PMO Oversight Platforms](https://planisware.com/resources/project-management-office-pmo/enterprise-pmo-oversight-platforms)
- [Planisware — Enterprise Project Management: Resource & Budget Control](https://planisware.com/enterprise-project-management-resource-budget-control)
- [Planisware Nova — Strategic Portfolio Management](https://planisware.com/products/planisware-nova)
- [Jira Align — Organizational structure](https://help.jiraalign.com/hc/en-us/articles/115000152674-Jira-Align-organizational-structure)
- [Jira Align — Create objectives](https://help.jiraalign.com/hc/en-us/articles/115005897548-Create-objectives)
- [A Crash Course on Jira Align's Core Hierarchies](https://community.atlassian.com/forums/Jira-Align-articles/A-Crash-Course-on-Jira-Align-s-Core-Hierarchies/ba-p/1167395)
- [Atlassian — Jira Align product page](https://www.atlassian.com/software/jira-align)

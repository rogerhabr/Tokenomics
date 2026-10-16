-- ============================================================================
-- 0008 — Phases 4 and 5: UAT, defects, deployment checklist, handover, post-mortem
-- Layers F and G of docs/consulting/01-DOMAIN-MODEL.md.
-- ============================================================================

-- ============================================================================
-- Phase 4 — Testing & QA
-- ============================================================================

create table consulting.test_plan (
  id                uuid primary key default gen_random_uuid(),
  firm_id           uuid not null references consulting.firm(id) on delete cascade,
  project_id        uuid not null references consulting.project(id) on delete cascade,
  version           integer not null default 1,
  name              text not null,
  -- Pinned to a baseline, so "what we test" is provably "what we baselined".
  -- Scope quietly dropped during execution then shows up as an uncovered
  -- deliverable rather than vanishing from the denominator (F-QA-07).
  scope_baseline_id uuid not null references consulting.baseline(id) on delete restrict,
  state             text not null default 'DRAFT'
                      check (state in ('DRAFT','PENDING_APPROVAL','APPROVED','SUPERSEDED')),
  approved_by       uuid references consulting.app_user(id),
  approved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references consulting.app_user(id), updated_by uuid,
  unique (project_id, version),
  constraint test_plan_approved_shape check (
    state <> 'APPROVED' or (approved_by is not null and approved_at is not null)
  ),
  constraint test_plan_no_self_approval check (approved_by is null or approved_by <> created_by)
);
alter table consulting.test_plan enable row level security;

create table consulting.test_case (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references consulting.firm(id) on delete cascade,
  test_plan_id    uuid not null references consulting.test_plan(id) on delete cascade,
  code            text not null,
  -- NOT NULL by design: full requirement-to-test traceability. A test case that
  -- does not trace to a WBS deliverable cannot contribute to coverage, and a
  -- deliverable with no case is a blocking G2 criterion.
  wbs_node_id     uuid not null references consulting.wbs_node(id) on delete restrict,
  title           text not null,
  steps_json      jsonb not null default '[]'::jsonb,
  expected_result text not null,
  priority        text not null default 'MEDIUM'
                    check (priority in ('LOW','MEDIUM','HIGH','CRITICAL')),
  is_uat          boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid, updated_by uuid,
  unique (test_plan_id, code)
);
alter table consulting.test_case enable row level security;
create index test_case_wbs_idx on consulting.test_case (wbs_node_id);

create table consulting.test_coverage (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references consulting.firm(id) on delete cascade,
  test_plan_id uuid not null references consulting.test_plan(id) on delete cascade,
  wbs_node_id  uuid not null references consulting.wbs_node(id) on delete cascade,
  case_count   integer not null default 0,
  executed_count integer not null default 0,
  covered      boolean not null default false,
  as_of        timestamptz not null default now(),
  formula_version_id uuid not null references consulting.formula_version(id) on delete restrict,
  unique (test_plan_id, wbs_node_id, as_of)
);
alter table consulting.test_coverage enable row level security;

create table consulting.uat_run (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references consulting.firm(id) on delete cascade,
  project_id   uuid not null references consulting.project(id) on delete cascade,
  test_case_id uuid not null references consulting.test_case(id) on delete cascade,
  cycle        integer not null default 1,
  executed_by  uuid not null references consulting.app_user(id) on delete restrict,
  executed_at  timestamptz not null default now(),
  result       text not null check (result in ('PASS','FAIL','BLOCKED','NOT_RUN')),
  evidence_url text,
  comments     text,
  created_at   timestamptz not null default now(),
  unique (test_case_id, cycle)
);
alter table consulting.uat_run enable row level security;
create index uat_run_project_idx on consulting.uat_run (project_id, cycle, result);

-- A UAT case must be executed by someone holding CLIENT_UAT_APPROVER on that
-- engagement. DR-07 (client users authenticate in) is what makes this
-- enforceable rather than a convention -- the executor is a real identity with
-- a real, time-windowed grant.
create or replace function consulting.guard_uat_executor_role()
returns trigger language plpgsql as $$
declare v_is_uat boolean; v_eng uuid; v_ok boolean;
begin
  select tc.is_uat into v_is_uat from consulting.test_case tc where tc.id = new.test_case_id;
  if not coalesce(v_is_uat, false) then
    return new;   -- internal test execution is unrestricted
  end if;

  select p.engagement_id into v_eng from consulting.project p where p.id = new.project_id;

  select exists (
    select 1
      from consulting.user_role ur
      join consulting.role_def rd on rd.id = ur.role_def_id
     where ur.user_id = new.executed_by
       and rd.code = 'CLIENT_UAT_APPROVER'
       and new.executed_at >= ur.valid_from
       and (ur.valid_to is null or new.executed_at < ur.valid_to)
       and ((ur.scope_kind = 'ENGAGEMENT' and ur.scope_id = v_eng)
         or (ur.scope_kind = 'PROJECT'    and ur.scope_id = new.project_id)
         or (ur.scope_kind = 'CLIENT'     and ur.scope_id =
              (select client_id from consulting.engagement where id = v_eng)))
  ) into v_ok;

  if not v_ok then
    raise exception
      'UAT execution requires a live CLIENT_UAT_APPROVER grant in scope at execution time'
      using errcode = '42501', hint = 'Invariant I-3';
  end if;
  return new;
end $$;

create trigger guard_uat_executor_role
  before insert or update on consulting.uat_run
  for each row execute function consulting.guard_uat_executor_role();

create table consulting.defect (
  id                  uuid primary key default gen_random_uuid(),
  firm_id             uuid not null references consulting.firm(id) on delete cascade,
  project_id          uuid not null references consulting.project(id) on delete cascade,
  uat_run_id          uuid references consulting.uat_run(id) on delete set null,
  code                text not null,
  title               text not null,
  description         text,
  severity            text not null check (severity in ('S1','S2','S3','S4')),
  priority            text not null default 'MEDIUM'
                        check (priority in ('LOW','MEDIUM','HIGH','CRITICAL')),
  state               text not null default 'OPEN'
                        check (state in ('OPEN','TRIAGED','IN_PROGRESS','FIXED',
                                         'RETEST','CLOSED','REJECTED','DEFERRED')),
  root_cause_wbs_id   uuid references consulting.wbs_node(id) on delete set null,
  -- Attribution is to work, never to a person. An agent that blames individuals
  -- gets gamed within a month and the progress data stops being honest.
  -- 03-AGENT-ARCHITECTURE.md §4.4. There is deliberately no root_cause_person.
  root_cause_category text,
  assigned_to         uuid references consulting.app_user(id) on delete set null,
  opened_at           timestamptz not null default now(),
  closed_at           timestamptz,
  reopen_count        integer not null default 0,
  -- Found post-release: the denominator term in defect removal efficiency.
  is_leakage          boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid, updated_by uuid,
  unique (project_id, code),
  constraint defect_closed_shape check (state <> 'CLOSED' or closed_at is not null)
);
alter table consulting.defect enable row level security;
create index defect_project_state_idx on consulting.defect (project_id, state, severity);
create index defect_open_sev_idx on consulting.defect (project_id, severity)
  where state not in ('CLOSED','REJECTED');

create or replace function consulting.track_defect_reopen()
returns trigger language plpgsql as $$
begin
  -- A reopen rate that invalidates the pass rate is only measurable if reopens
  -- are counted rather than inferred from a state history nobody keeps.
  if old.state in ('CLOSED','FIXED') and new.state in ('OPEN','TRIAGED','IN_PROGRESS') then
    new.reopen_count := old.reopen_count + 1;
    new.closed_at := null;
  end if;
  return new;
end $$;

create trigger track_defect_reopen
  before update on consulting.defect
  for each row execute function consulting.track_defect_reopen();

create table consulting.defect_metric (
  id                  uuid primary key default gen_random_uuid(),
  firm_id             uuid not null references consulting.firm(id) on delete cascade,
  project_id          uuid not null references consulting.project(id) on delete cascade,
  wbs_node_id         uuid references consulting.wbs_node(id) on delete cascade,
  as_of               timestamptz not null default now(),
  defect_count        integer not null default 0,
  size_measure        numeric(14,4) not null,
  -- Configurable, never hardwired (F-QA-01).
  size_basis          text not null default 'WORK_PACKAGES'
                        check (size_basis in ('WORK_PACKAGES','TEST_CASES','KLOC','FUNCTION_POINTS')),
  density             numeric(14,6),
  weighted_density    numeric(14,6),
  pass_rate           numeric(9,6),
  blocked_rate        numeric(9,6),
  removal_efficiency  numeric(9,6),
  mttr_hours          numeric(12,2),
  open_s1             integer not null default 0,
  open_s2             integer not null default 0,
  reopen_rate         numeric(9,6),
  -- Goel-Okumoto / Rayleigh fit. Answers "are we finding fewer defects because
  -- the software is clean, or because we stopped testing?" (F-QA-05).
  arrival_model       text check (arrival_model in ('GOEL_OKUMOTO','RAYLEIGH','WEIBULL')),
  arrival_n_inf       numeric(14,4),
  arrival_lambda      numeric(14,6),
  predicted_remaining numeric(14,4),
  fit_points          integer,
  fit_sufficient      boolean not null default false,
  formula_version_id  uuid not null references consulting.formula_version(id) on delete restrict,
  computed_at         timestamptz not null default now()
);
alter table consulting.defect_metric enable row level security;
create index defect_metric_project_idx on consulting.defect_metric (project_id, as_of desc);

create table consulting.uat_signoff (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references consulting.firm(id) on delete cascade,
  project_id     uuid not null references consulting.project(id) on delete cascade,
  test_plan_id   uuid not null references consulting.test_plan(id) on delete restrict,
  -- Pins exactly which baseline scope the client accepted. If the baseline has
  -- moved since, the hash will not match and G3 will not pass.
  scope_hash     bytea not null,
  signed_by      uuid not null references consulting.app_user(id) on delete restrict,
  signer_role_grant_id uuid references consulting.user_role(id) on delete restrict,
  decision       text not null check (decision in ('APPROVE','APPROVE_WITH_CONDITIONS','REJECT')),
  signed_at      timestamptz not null default now(),
  conditions     text,
  signature_hash bytea not null,
  ip             inet,
  user_agent     text,
  created_at     timestamptz not null default now(),
  constraint uat_signoff_conditions_shape check (
    decision <> 'APPROVE_WITH_CONDITIONS' or conditions is not null
  )
);
alter table consulting.uat_signoff enable row level security;

-- ============================================================================
-- Phase 5 — Deployment & Handover
-- ============================================================================

create table consulting.checklist_template (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references consulting.firm(id) on delete cascade,
  code        text not null,
  version     integer not null default 1,
  name        text not null,
  applies_to  text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid, updated_by uuid,
  unique (firm_id, code, version)
);
alter table consulting.checklist_template enable row level security;

create table consulting.checklist_template_item (
  id                uuid primary key default gen_random_uuid(),
  firm_id           uuid not null references consulting.firm(id) on delete cascade,
  template_id       uuid not null references consulting.checklist_template(id) on delete cascade,
  seq               integer not null,
  text              text not null,
  verification_type text not null
                      check (verification_type in ('MANUAL','AUTOMATED_CHECK','EVIDENCE_UPLOAD')),
  -- For AUTOMATED_CHECK: the registered check to call. The raw result is stored,
  -- so a green checklist is evidence rather than an assertion.
  check_code        text,
  required_role_id  uuid references consulting.role_def(id) on delete restrict,
  is_blocking       boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (template_id, seq),
  constraint checklist_template_item_automated_shape check (
    verification_type <> 'AUTOMATED_CHECK' or check_code is not null
  )
);
alter table consulting.checklist_template_item enable row level security;

create table consulting.deployment_checklist (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references consulting.firm(id) on delete cascade,
  project_id       uuid not null references consulting.project(id) on delete cascade,
  template_id      uuid not null references consulting.checklist_template(id) on delete restrict,
  template_version integer not null,
  state            text not null default 'OPEN'
                     check (state in ('OPEN','IN_PROGRESS','COMPLETE','ABANDONED')),
  opened_at        timestamptz not null default now(),
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid, updated_by uuid
);
alter table consulting.deployment_checklist enable row level security;

create table consulting.checklist_item (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references consulting.firm(id) on delete cascade,
  checklist_id     uuid not null references consulting.deployment_checklist(id) on delete cascade,
  template_item_id uuid not null references consulting.checklist_template_item(id) on delete restrict,
  state            text not null default 'PENDING'
                     check (state in ('PENDING','VERIFIED','FAILED','WAIVED','NA')),
  evidence_url     text,
  automated_result jsonb,
  verified_by      uuid references consulting.app_user(id) on delete set null,
  verified_at      timestamptz,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid, updated_by uuid,
  unique (checklist_id, template_item_id),
  constraint checklist_item_verified_shape check (
    state <> 'VERIFIED' or (verified_by is not null and verified_at is not null)
  )
);
alter table consulting.checklist_item enable row level security;

create table consulting.handover_package (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references consulting.firm(id) on delete cascade,
  project_id      uuid not null references consulting.project(id) on delete cascade,
  baseline_id     uuid not null references consulting.baseline(id) on delete restrict,
  uat_signoff_id  uuid references consulting.uat_signoff(id) on delete restrict,
  generated_at    timestamptz not null default now(),
  generated_by    uuid references consulting.app_user(id),
  document_refs   jsonb not null default '[]'::jsonb,
  -- Hashed so the pack that was delivered is the pack that was signed for.
  content_hash    bytea not null,
  created_at      timestamptz not null default now()
);
alter table consulting.handover_package enable row level security;

create table consulting.client_signoff (
  id                   uuid primary key default gen_random_uuid(),
  firm_id              uuid not null references consulting.firm(id) on delete cascade,
  project_id           uuid not null references consulting.project(id) on delete cascade,
  handover_package_id  uuid not null references consulting.handover_package(id) on delete restrict,
  signed_by            uuid not null references consulting.app_user(id) on delete restrict,
  signer_role_grant_id uuid references consulting.user_role(id) on delete restrict,
  decision             text not null check (decision in ('APPROVE','APPROVE_WITH_CONDITIONS','REJECT')),
  signed_at            timestamptz not null default now(),
  conditions           text,
  signature_hash       bytea not null,
  ip                   inet,
  user_agent           text,
  created_at           timestamptz not null default now()
);
alter table consulting.client_signoff enable row level security;

create table consulting.post_mortem (
  id                     uuid primary key default gen_random_uuid(),
  firm_id                uuid not null references consulting.firm(id) on delete cascade,
  project_id             uuid not null unique references consulting.project(id) on delete cascade,
  state                  text not null default 'SCHEDULED'
                           check (state in ('SCHEDULED','IN_PROGRESS','COMPLETE')),
  scheduled_for          date,
  conducted_at           timestamptz,
  facilitator            uuid references consulting.app_user(id),
  responses_json         jsonb not null default '{}'::jsonb,
  lessons                jsonb not null default '[]'::jsonb,
  -- Feeds Loop 4 calibration: estimate-vs-actual decomposition by role, phase
  -- and WBS branch, plus the measured activity-overrun correlation that
  -- recalibrates rho (F-RK-01, FMEA F-07).
  estimate_variance_json jsonb,
  measured_rho           numeric(9,6),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  created_by             uuid, updated_by uuid
);
alter table consulting.post_mortem enable row level security;

do $$
declare t record;
begin
  for t in
    select c.relname from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'updated_at'
     where n.nspname = 'consulting' and c.relkind = 'r'
       and not exists (select 1 from pg_trigger g
                        where g.tgrelid = c.oid and g.tgname = 'touch_updated_at')
  loop
    execute format('create trigger touch_updated_at before update on consulting.%I
                      for each row execute function consulting.touch_updated_at()', t.relname);
  end loop;
end $$;

grant select, insert, update, delete on all tables in schema consulting to authenticated;
revoke update, delete, truncate on consulting.audit_ledger from authenticated;
revoke update, delete on consulting.baseline, consulting.baseline_activity,
       consulting.baseline_cost, consulting.baseline_scope from authenticated;

-- ============================================================================
-- 0006 — Phase 2: project, WBS, CPM network, cost plan, baselines
--
-- Layer D of docs/consulting/01-DOMAIN-MODEL.md.
--
-- Two invariants are enforced structurally here:
--   I-1  project.current_phase_id is writable only inside advance_phase()
--   I-10 baseline rows are immutable, and `is_original` is set exactly once
-- ============================================================================

create table consulting.project (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references consulting.firm(id) on delete cascade,
  engagement_id    uuid not null references consulting.engagement(id) on delete cascade,
  opportunity_id   uuid references consulting.opportunity(id) on delete set null,
  code             text not null,
  name             text not null,
  -- Trigger-protected (I-1). advance_phase() is the only legal writer.
  current_phase_id uuid not null references consulting.phase_def(id) on delete restrict,
  state            text not null default 'ACTIVE'
                     check (state in ('ACTIVE','ON_HOLD','CANCELLED','CLOSED')),
  calendar_id      uuid not null references consulting.calendar(id) on delete restrict,
  planned_start    date not null,
  planned_finish   date,
  -- The contractual date that P(breach) in F-RK-03 is measured against.
  contract_milestone_date date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid, updated_by uuid,
  unique (firm_id, code)
);
alter table consulting.project enable row level security;
create index project_engagement_idx on consulting.project (engagement_id, state);

-- ---------------------------------------------------------------- I-1, F-15
-- A bare `update project set current_phase_id = ...` bypasses every gate. The
-- trigger permits the write only when advance_phase() has set a
-- transaction-local flag, and records the attempt otherwise.
create or replace function consulting.guard_project_phase()
returns trigger
language plpgsql
as $$
begin
  if new.current_phase_id is distinct from old.current_phase_id
     and coalesce(current_setting('consulting.phase_advance', true), 'off') <> 'on' then
    raise exception
      'project.current_phase_id may only be changed via consulting.advance_phase()'
      using errcode = '42501',
            hint    = 'Invariant I-1 / FMEA F-15. Every gate would otherwise be bypassable.';
  end if;
  return new;
end $$;

create trigger guard_project_phase
  before update on consulting.project
  for each row execute function consulting.guard_project_phase();

-- ============================================================================
-- WBS
-- ============================================================================

create table consulting.wbs_node (
  id                  uuid primary key default gen_random_uuid(),
  firm_id             uuid not null references consulting.firm(id) on delete cascade,
  project_id          uuid not null references consulting.project(id) on delete cascade,
  parent_id           uuid references consulting.wbs_node(id) on delete restrict,
  -- Dotted path, e.g. '1.2.3'
  code                text not null,
  name                text not null,
  node_type           text not null
                        check (node_type in ('SUMMARY','DELIVERABLE','WORK_PACKAGE',
                                             'ACTIVITY','MILESTONE')),
  level               smallint not null default 0,
  is_leaf             boolean not null default true,
  sort_order          integer not null default 0,
  deliverable_desc    text,
  acceptance_criteria text,
  -- Scope classification: BUILD work must be 100% complete at G2; SUPPORT work
  -- is what LOE progress is whitelisted for (F-EV-04).
  scope_class         text not null default 'BUILD'
                        check (scope_class in ('BUILD','TEST','DEPLOY','SUPPORT','MGMT')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid, updated_by uuid,
  unique (project_id, code)
);
alter table consulting.wbs_node enable row level security;
create index wbs_node_project_idx on consulting.wbs_node (project_id, parent_id);

-- Maintain is_leaf on the parent as children appear and disappear. Without this,
-- the G1 criterion "no summary node without children" has nothing to read.
create or replace function consulting.wbs_maintain_leaf()
returns trigger language plpgsql as $$
begin
  if tg_op in ('INSERT','UPDATE') and new.parent_id is not null then
    update consulting.wbs_node set is_leaf = false
     where id = new.parent_id and is_leaf;
  end if;
  if tg_op in ('UPDATE','DELETE') and old.parent_id is not null then
    update consulting.wbs_node p set is_leaf = not exists (
      select 1 from consulting.wbs_node c where c.parent_id = p.id
    ) where p.id = old.parent_id;
  end if;
  return null;
end $$;

create trigger wbs_maintain_leaf
  after insert or update or delete on consulting.wbs_node
  for each row execute function consulting.wbs_maintain_leaf();

-- ============================================================================
-- Activities and the dependency network
-- ============================================================================

create table consulting.activity (
  id                  uuid primary key default gen_random_uuid(),
  firm_id             uuid not null references consulting.firm(id) on delete cascade,
  project_id          uuid not null references consulting.project(id) on delete cascade,
  wbs_node_id         uuid not null unique references consulting.wbs_node(id) on delete cascade,
  duration_days       numeric(10,3) not null default 0 check (duration_days >= 0),
  effort_hours        numeric(12,2) not null default 0 check (effort_hours >= 0),
  calendar_id         uuid references consulting.calendar(id) on delete restrict,
  constraint_type     text not null default 'ASAP'
                        check (constraint_type in ('ASAP','ALAP','SNET','SNLT',
                                                   'FNET','FNLT','MSO','MFO')),
  constraint_date     date,
  -- F-EV-04: which methods are legal is enforced by trigger against scope_class
  -- and duration, because an unrestricted subjective % makes EV fiction.
  pct_complete_method text not null default 'ZERO_HUNDRED'
                        check (pct_complete_method in ('ZERO_HUNDRED','FIFTY_FIFTY',
                               'MILESTONE_WEIGHTED','UNITS','PHYSICAL','LOE')),
  -- CPM outputs (F-SD-01..03), stored and stamped with the run that produced them
  es                  date, ef date, ls date, lf date,
  total_float         numeric(10,3),
  free_float          numeric(10,3),
  is_critical         boolean,
  cpm_run_id          uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid, updated_by uuid,
  constraint activity_constraint_date_required check (
    constraint_type in ('ASAP','ALAP') or constraint_date is not null
  )
);
alter table consulting.activity enable row level security;
create index activity_project_idx on consulting.activity (project_id);
create index activity_critical_idx on consulting.activity (project_id) where is_critical;

create table consulting.dependency (
  id                     uuid primary key default gen_random_uuid(),
  firm_id                uuid not null references consulting.firm(id) on delete cascade,
  project_id             uuid not null references consulting.project(id) on delete cascade,
  predecessor_activity_id uuid not null references consulting.activity(id) on delete cascade,
  successor_activity_id   uuid not null references consulting.activity(id) on delete cascade,
  -- All four types, per the brief. FF and SF are the ones most tools skip and
  -- the ones that make a real consulting network expressible.
  dep_type               text not null default 'FS'
                           check (dep_type in ('FS','SS','FF','SF')),
  lag_days               numeric(10,3) not null default 0,
  created_at             timestamptz not null default now(),
  created_by             uuid references consulting.app_user(id),
  unique (predecessor_activity_id, successor_activity_id, dep_type),
  -- A self-loop is the degenerate cycle; catch it in the schema rather than
  -- leaving it to the SCC detector.
  constraint dependency_no_self_loop check (predecessor_activity_id <> successor_activity_id)
);
alter table consulting.dependency enable row level security;
create index dependency_pred_idx on consulting.dependency (predecessor_activity_id);
create index dependency_succ_idx on consulting.dependency (successor_activity_id);

-- A dependency across two projects would make each project's CPM depend on data
-- the other project's members may not be able to read, which would break both
-- the forward pass and the RLS barrier. Cross-project links belong to a future
-- programme layer, explicitly out of scope here.
create or replace function consulting.guard_dependency_same_project()
returns trigger language plpgsql as $$
declare v_p uuid; v_s uuid;
begin
  select project_id into v_p from consulting.activity where id = new.predecessor_activity_id;
  select project_id into v_s from consulting.activity where id = new.successor_activity_id;
  if v_p is distinct from v_s then
    raise exception 'dependency endpoints must belong to the same project'
      using errcode = '23514';
  end if;
  if v_p is distinct from new.project_id then
    raise exception 'dependency.project_id does not match its endpoints'
      using errcode = '23514';
  end if;
  return new;
end $$;

create trigger guard_dependency_same_project
  before insert or update on consulting.dependency
  for each row execute function consulting.guard_dependency_same_project();

create table consulting.assignment (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references consulting.firm(id) on delete cascade,
  project_id     uuid not null references consulting.project(id) on delete cascade,
  activity_id    uuid not null references consulting.activity(id) on delete cascade,
  -- Generic (role-level) demand before a named person is staffed: the
  -- Planisware pattern, and what makes capacity planning possible pre-staffing.
  user_id        uuid references consulting.app_user(id) on delete set null,
  role_def_id    uuid not null references consulting.role_def(id) on delete restrict,
  skill_id       uuid references consulting.skill(id) on delete set null,
  is_generic     boolean not null default true,
  allocation_pct consulting.unit_fraction not null default 1.0,
  planned_hours  numeric(12,2) not null default 0 check (planned_hours >= 0),
  rate_card_id   uuid references consulting.rate_card(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid, updated_by uuid,
  constraint assignment_generic_consistent check (
    (is_generic and user_id is null) or (not is_generic and user_id is not null)
  )
);
alter table consulting.assignment enable row level security;
create index assignment_activity_idx on consulting.assignment (activity_id);
create index assignment_user_idx on consulting.assignment (user_id) where user_id is not null;

-- ============================================================================
-- Cost plan
-- ============================================================================

create table consulting.cost_account (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references consulting.firm(id) on delete cascade,
  project_id    uuid not null references consulting.project(id) on delete cascade,
  code          text not null,
  name          text not null,
  kind          text not null
                  check (kind in ('LABOUR','EXPENSE','SUBCONTRACT',
                                  'CONTINGENCY','MANAGEMENT_RESERVE')),
  budget_amount numeric(18,4) not null default 0,
  currency      consulting.currency_code not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid, updated_by uuid,
  unique (project_id, code)
);
alter table consulting.cost_account enable row level security;

create table consulting.wbs_cost_plan (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references consulting.firm(id) on delete cascade,
  project_id         uuid not null references consulting.project(id) on delete cascade,
  wbs_node_id        uuid not null references consulting.wbs_node(id) on delete cascade,
  cost_account_id    uuid not null references consulting.cost_account(id) on delete restrict,
  -- Fiscal period key, not a timestamp. FMEA F-19.
  fiscal_period      text not null,
  planned_amount     numeric(18,4) not null default 0,
  currency           consulting.currency_code not null,
  formula_version_id uuid references consulting.formula_version(id) on delete restrict,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid, updated_by uuid,
  unique (wbs_node_id, cost_account_id, fiscal_period)
);
alter table consulting.wbs_cost_plan enable row level security;

-- ============================================================================
-- Baselines — and the one-way `is_original` flag
--
-- FMEA F-16 is the quietest failure in PPM: every approved change request
-- re-baselines, performance is measured against the newest baseline, and a
-- project that has doubled in cost reports as permanently on plan. The defence
-- is that creep metrics read ONLY the original baseline, which means the
-- original must be impossible to move or re-designate.
-- ============================================================================

create table consulting.baseline (
  id                uuid primary key default gen_random_uuid(),
  firm_id           uuid not null references consulting.firm(id) on delete cascade,
  project_id        uuid not null references consulting.project(id) on delete cascade,
  version           integer not null,
  parent_version    integer,
  taken_at          timestamptz not null default now(),
  taken_by          uuid references consulting.app_user(id),
  gate_instance_id  uuid,
  change_request_id uuid,
  reason            text not null,
  bac               numeric(18,4) not null default 0,
  currency          consulting.currency_code not null,
  planned_finish    date,
  planned_duration_days numeric(10,3),
  is_original       boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (project_id, version)
);
alter table consulting.baseline enable row level security;
-- Exactly one original per project, enforced by the index rather than by hope.
create unique index baseline_one_original
  on consulting.baseline (project_id) where is_original;

create table consulting.baseline_activity (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references consulting.firm(id) on delete cascade,
  baseline_id   uuid not null references consulting.baseline(id) on delete cascade,
  activity_id   uuid not null references consulting.activity(id) on delete cascade,
  duration_days numeric(10,3) not null,
  effort_hours  numeric(12,2) not null,
  es date, ef date, ls date, lf date,
  total_float   numeric(10,3),
  is_critical   boolean,
  unique (baseline_id, activity_id)
);
alter table consulting.baseline_activity enable row level security;

create table consulting.baseline_cost (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references consulting.firm(id) on delete cascade,
  baseline_id    uuid not null references consulting.baseline(id) on delete cascade,
  wbs_node_id    uuid not null references consulting.wbs_node(id) on delete cascade,
  fiscal_period  text not null,
  planned_amount numeric(18,4) not null,
  currency       consulting.currency_code not null,
  unique (baseline_id, wbs_node_id, fiscal_period)
);
alter table consulting.baseline_cost enable row level security;
comment on table consulting.baseline_cost is
  'The immutable PV curve. F-EV-02 reads this and nothing else.';

create table consulting.baseline_scope (
  id                  uuid primary key default gen_random_uuid(),
  firm_id             uuid not null references consulting.firm(id) on delete cascade,
  baseline_id         uuid not null references consulting.baseline(id) on delete cascade,
  wbs_node_id         uuid not null references consulting.wbs_node(id) on delete cascade,
  name                text not null,
  acceptance_criteria text,
  -- Lets a UAT signoff pin exactly which scope the client accepted, so scope
  -- quietly dropped during execution shows up as an uncovered deliverable
  -- rather than vanishing from the denominator (F-QA-07).
  scope_hash          bytea not null,
  unique (baseline_id, wbs_node_id)
);
alter table consulting.baseline_scope enable row level security;

-- I-10: a taken baseline is history. Nothing in it may change, and is_original
-- can never be set or cleared after insert.
create or replace function consulting.guard_baseline_immutable()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.is_original is distinct from old.is_original then
      raise exception 'baseline.is_original is set once at creation and never changed'
        using errcode = '42501', hint = 'Invariant I-10 / FMEA F-16';
    end if;
    if new.bac is distinct from old.bac
       or new.planned_finish is distinct from old.planned_finish
       or new.planned_duration_days is distinct from old.planned_duration_days
       or new.version is distinct from old.version
       or new.project_id is distinct from old.project_id then
      raise exception 'baseline % is immutable; raise a change_request for a new version',
        old.version using errcode = '42501', hint = 'Invariant I-10';
    end if;
  else
    raise exception 'baseline rows may not be deleted' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger guard_baseline_immutable
  before update or delete on consulting.baseline
  for each row execute function consulting.guard_baseline_immutable();

create or replace function consulting.guard_baseline_child_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'baseline snapshot rows are immutable (% on %)', tg_op, tg_table_name
    using errcode = '42501', hint = 'Invariant I-10';
end $$;

create trigger guard_baseline_activity_immutable
  before update or delete on consulting.baseline_activity
  for each row execute function consulting.guard_baseline_child_immutable();
create trigger guard_baseline_cost_immutable
  before update or delete on consulting.baseline_cost
  for each row execute function consulting.guard_baseline_child_immutable();
create trigger guard_baseline_scope_immutable
  before update or delete on consulting.baseline_scope
  for each row execute function consulting.guard_baseline_child_immutable();

-- ============================================================================
-- Change requests — the only legal path to a new baseline
-- ============================================================================

create table consulting.change_request (
  id                   uuid primary key default gen_random_uuid(),
  firm_id              uuid not null references consulting.firm(id) on delete cascade,
  project_id           uuid not null references consulting.project(id) on delete cascade,
  code                 text not null,
  title                text not null,
  rationale            text not null,
  delta_cost           numeric(18,4) not null default 0,
  delta_days           numeric(10,3) not null default 0,
  delta_scope_json     jsonb,
  currency             consulting.currency_code not null,
  requested_by         uuid references consulting.app_user(id),
  state                text not null default 'DRAFT'
                         check (state in ('DRAFT','SUBMITTED','APPROVED','REJECTED','WITHDRAWN')),
  approved_by          uuid references consulting.app_user(id),
  approved_at          timestamptz,
  reject_reason        text,
  resulting_baseline_id uuid references consulting.baseline(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid, updated_by uuid,
  unique (project_id, code),
  -- Segregation of duties: the requester may not approve their own change.
  constraint change_request_no_self_approval check (
    approved_by is null or approved_by <> requested_by
  ),
  constraint change_request_approved_shape check (
    state <> 'APPROVED' or (approved_by is not null and approved_at is not null)
  )
);
alter table consulting.change_request enable row level security;

alter table consulting.baseline
  add constraint baseline_change_request_fk
  foreign key (change_request_id) references consulting.change_request(id) on delete set null;

-- A non-original baseline must cite an APPROVED change request. There is no
-- "re-baseline" button, by construction.
create or replace function consulting.guard_baseline_requires_cr()
returns trigger language plpgsql as $$
declare v_state text;
begin
  if new.is_original then
    if new.change_request_id is not null then
      raise exception 'the original baseline is not the result of a change request'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if new.change_request_id is null then
    raise exception
      'a non-original baseline requires an approved change_request'
      using errcode = '23514', hint = 'Invariant I-10 / FMEA F-16';
  end if;

  select state into v_state from consulting.change_request where id = new.change_request_id;
  if v_state is distinct from 'APPROVED' then
    raise exception 'change_request % is % , not APPROVED', new.change_request_id,
      coalesce(v_state,'missing') using errcode = '23514';
  end if;
  return new;
end $$;

create trigger guard_baseline_requires_cr
  before insert on consulting.baseline
  for each row execute function consulting.guard_baseline_requires_cr();

-- ============================================================================
-- Schedule health — the blocking G1 criteria (FMEA F-06)
-- ============================================================================

create table consulting.schedule_health (
  id                    uuid primary key default gen_random_uuid(),
  firm_id               uuid not null references consulting.firm(id) on delete cascade,
  project_id            uuid not null references consulting.project(id) on delete cascade,
  as_of                 timestamptz not null default now(),
  dangling_count        integer not null default 0,
  cycle_count           integer not null default 0,
  negative_float_count  integer not null default 0,
  hard_constraint_count integer not null default 0,
  logic_density         numeric(9,4),
  missing_resource_count integer not null default 0,
  undecomposed_summary_count integer not null default 0,
  -- Tarjan output: which loop, not merely that one exists (F-SD-04).
  cycle_detail_json     jsonb,
  formula_version_id    uuid not null references consulting.formula_version(id) on delete restrict,
  cpm_run_id            uuid,
  created_at            timestamptz not null default now()
);
alter table consulting.schedule_health enable row level security;
create index schedule_health_project_idx on consulting.schedule_health (project_id, as_of desc);

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

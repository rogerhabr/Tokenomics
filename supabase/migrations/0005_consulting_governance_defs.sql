-- ============================================================================
-- 0005 — Phase, gate and criterion DEFINITIONS + Phase 1 intake
--
-- The five phases and four gates are ROWS, not enum values or code branches.
-- "Do not hardwire any metrics" extends to the lifecycle itself: a firm can add
-- a sixth phase, retire a gate, or change a threshold without a deployment.
-- Every threshold lives in gate_criterion.threshold_expr, resolved through the
-- formula registry from 0004.
-- ============================================================================

-- ============================================================================
-- Lifecycle definitions
-- ============================================================================

create table consulting.phase_def (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references consulting.firm(id) on delete cascade,
  code        text not null,
  seq         smallint not null,
  name        text not null,
  description text,
  -- A terminal phase has no outgoing gate (CLOSED, CANCELLED).
  is_terminal boolean not null default false,
  version     integer not null default 1,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid, updated_by uuid,
  unique (firm_id, code),
  unique (firm_id, seq)
);
alter table consulting.phase_def enable row level security;

create table consulting.gate_def (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references consulting.firm(id) on delete cascade,
  code          text not null,
  name          text not null,
  phase_from_id uuid not null references consulting.phase_def(id) on delete cascade,
  phase_to_id   uuid not null references consulting.phase_def(id) on delete cascade,
  -- Invariant I-5. Delegation does not satisfy this; see the signoff trigger.
  four_eyes     boolean not null default true,
  sla_hours     integer,
  -- A REWORK edge runs backwards through the lifecycle and needs a named
  -- authorising role rather than the full criterion set.
  is_rework     boolean not null default false,
  rework_role_id uuid references consulting.role_def(id),
  version       integer not null default 1,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid, updated_by uuid,
  unique (firm_id, code),
  -- One active gate per ordered phase pair: the transition must be unambiguous,
  -- or advance_phase() would have to guess which gate governs.
  constraint gate_def_distinct_phases check (phase_from_id <> phase_to_id)
);
alter table consulting.gate_def enable row level security;
create unique index gate_def_transition_unique
  on consulting.gate_def (firm_id, phase_from_id, phase_to_id) where is_active;

create table consulting.gate_criterion (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references consulting.firm(id) on delete cascade,
  gate_def_id     uuid not null references consulting.gate_def(id) on delete cascade,
  code            text not null,
  label           text not null,
  criterion_type  text not null
                    check (criterion_type in ('FORMULA','DELIVERABLE','SIGNOFF',
                                              'CHECKLIST','EXTERNAL_CHECK')),
  domain          text not null default 'GOVERNANCE'
                    check (domain in ('SCORING','SCHEDULE','EVM','REVENUE',
                                      'CAPACITY','RISK','QUALITY','GOVERNANCE')),
  -- FORMULA criteria resolve a registry formula and compare its result.
  formula_id      uuid references consulting.formula(id) on delete restrict,
  comparator      text check (comparator in ('GTE','GT','LTE','LT','EQ','NEQ','IS_TRUE','IS_FALSE')),
  -- The threshold as a registry parameter name or a literal, e.g.
  -- 'margin_floor' or '0'. Resolved at evaluation time, never compiled in.
  threshold_expr  text,
  -- SIGNOFF criteria name the role that must sign.
  required_role_id uuid references consulting.role_def(id) on delete restrict,
  -- Value-gated signoffs: only required above a threshold (e.g. Director
  -- signature on G0 only above director_threshold).
  condition_expr  text,
  is_blocking     boolean not null default true,
  waiver_allowed  boolean not null default false,
  evidence_required boolean not null default false,
  sort_order      smallint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid, updated_by uuid,
  unique (gate_def_id, code),
  constraint gate_criterion_formula_shape check (
    criterion_type <> 'FORMULA'
    or (formula_id is not null and comparator is not null)
  ),
  constraint gate_criterion_signoff_shape check (
    criterion_type <> 'SIGNOFF' or required_role_id is not null
  )
);
alter table consulting.gate_criterion enable row level security;

-- ============================================================================
-- Objective tree — the second Jira Align import (DR-02)
--
-- Strategic alignment (F-SC-04) is a weighted path product through this tree,
-- not a 1-5 score someone types. Two opportunities cannot both claim maximum
-- alignment to the same objective unless its weight genuinely supports it.
-- ============================================================================

create table consulting.objective (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references consulting.firm(id) on delete cascade,
  parent_id     uuid references consulting.objective(id) on delete restrict,
  tier          text not null
                  check (tier in ('FIRM','PRACTICE','ENGAGEMENT','PROJECT')),
  code          text not null,
  statement     text not null,
  -- Normalised against siblings at evaluation time (F-SC-04), so weights need
  -- not sum to 1 in the data. Adding an objective must not silently rescale
  -- every historical alignment score.
  weight        numeric(9,4) not null default 1 check (weight >= 0),
  period        text,
  owner_user_id uuid references consulting.app_user(id) on delete set null,
  org_unit_id   uuid references consulting.org_unit(id) on delete set null,
  target_value  numeric(18,4),
  actual_value  numeric(18,4),
  path          text not null default '',
  depth         smallint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid, updated_by uuid,
  unique (firm_id, code)
);
alter table consulting.objective enable row level security;
create index objective_path_idx on consulting.objective (path text_pattern_ops);
create index objective_parent_idx on consulting.objective (parent_id);

-- Same materialised-path machinery as org_unit, and the same trigger lesson:
-- no column list, because a BEFORE trigger's own writes do not arm an
-- `UPDATE OF` clause.
create or replace function consulting.objective_maintain_path()
returns trigger language plpgsql as $$
declare v_p text; v_d smallint; v_f uuid;
begin
  if new.parent_id is null then
    new.path := new.code; new.depth := 0;
  else
    if new.parent_id = new.id then
      raise exception 'objective cannot be its own parent';
    end if;
    select path, depth, firm_id into v_p, v_d, v_f
      from consulting.objective where id = new.parent_id;
    if v_p is null then raise exception 'parent objective % not found', new.parent_id; end if;
    if v_f <> new.firm_id then raise exception 'objective parent belongs to a different firm'; end if;
    new.path := v_p || '.' || new.code; new.depth := v_d + 1;
  end if;
  return new;
end $$;

create trigger objective_maintain_path
  before insert or update on consulting.objective
  for each row execute function consulting.objective_maintain_path();

create or replace function consulting.objective_repath_descendants()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('consulting.repathing', true), 'off') = 'on' then
    return null;
  end if;
  if new.path is distinct from old.path then
    perform set_config('consulting.repathing', 'on', true);
    update consulting.objective c
       set path  = new.path || substring(c.path from length(old.path) + 1),
           depth = new.depth + (c.depth - old.depth)
     where c.firm_id = new.firm_id and c.path like old.path || '.%';
    perform set_config('consulting.repathing', 'off', true);
  end if;
  return null;
end $$;

create trigger objective_repath_descendants
  after update on consulting.objective
  for each row execute function consulting.objective_repath_descendants();

-- ============================================================================
-- Phase 1 — Ideation & Intake
-- ============================================================================

create table consulting.scoring_model (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references consulting.firm(id) on delete cascade,
  code        text not null,
  version     integer not null default 1,
  name        text not null,
  state       text not null default 'DRAFT'
                check (state in ('DRAFT','PENDING_APPROVAL','ACTIVE','SUPERSEDED','RETIRED')),
  approved_by uuid references consulting.app_user(id),
  approved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references consulting.app_user(id), updated_by uuid,
  unique (firm_id, code, version)
);
alter table consulting.scoring_model enable row level security;

create table consulting.scoring_criterion (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references consulting.firm(id) on delete cascade,
  scoring_model_id uuid not null references consulting.scoring_model(id) on delete cascade,
  code             text not null,
  label            text not null,
  domain           text not null default 'SCORING',
  weight           numeric(9,4) not null default 1 check (weight >= 0),
  scale_min        numeric(18,6) not null default 1,
  scale_max        numeric(18,6) not null default 5,
  direction        text not null default 'HIGHER_BETTER'
                     check (direction in ('HIGHER_BETTER','LOWER_BETTER')),
  -- MANUAL: a human supplies raw_value.  DERIVED: a registry formula computes it
  -- (ROI, NPV, strategic alignment, complexity).
  source           text not null default 'MANUAL'
                     check (source in ('MANUAL','DERIVED')),
  formula_id       uuid references consulting.formula(id) on delete restrict,
  -- F-SC-09: a blocking criterion bypasses the composite entirely. A proposal
  -- with a fatal flaw must not be rescued by a high average.
  is_blocking      boolean not null default false,
  block_threshold  numeric(9,6),
  sort_order       smallint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid, updated_by uuid,
  unique (scoring_model_id, code),
  constraint scoring_criterion_scale check (scale_max > scale_min),
  constraint scoring_criterion_derived_needs_formula check (
    source <> 'DERIVED' or formula_id is not null
  ),
  constraint scoring_criterion_blocking_needs_threshold check (
    not is_blocking or block_threshold is not null
  )
);
alter table consulting.scoring_criterion enable row level security;

create table consulting.opportunity (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references consulting.firm(id) on delete cascade,
  client_id        uuid not null references consulting.client(id) on delete restrict,
  code             text not null,
  title            text not null,
  narrative        text,
  requested_by     uuid references consulting.app_user(id),
  requested_at     timestamptz not null default now(),
  estimated_value  numeric(18,4) check (estimated_value >= 0),
  currency         consulting.currency_code,
  target_start     date,
  scoring_model_id uuid references consulting.scoring_model(id) on delete restrict,
  state            text not null default 'DRAFT'
                     check (state in ('DRAFT','SUBMITTED','SCORING','SCORED',
                                      'APPROVED','REJECTED','PARKED','CONVERTED')),
  -- Derived by F-SC-02 / F-SC-03 / F-SC-08, each stamped with its formula
  -- version on the opportunity_score rows that feed it.
  score_total      numeric(9,6),
  score_adjusted   numeric(9,6),
  priority_rank    numeric(18,6),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid, updated_by uuid,
  unique (firm_id, code)
);
alter table consulting.opportunity enable row level security;
create index opportunity_client_idx on consulting.opportunity (client_id, state);

create table consulting.opportunity_objective_link (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references consulting.firm(id) on delete cascade,
  opportunity_id   uuid not null references consulting.opportunity(id) on delete cascade,
  objective_id     uuid not null references consulting.objective(id) on delete restrict,
  contribution_pct consulting.unit_fraction not null,
  created_at       timestamptz not null default now(),
  created_by       uuid,
  unique (opportunity_id, objective_id)
);
alter table consulting.opportunity_objective_link enable row level security;

create table consulting.opportunity_score (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references consulting.firm(id) on delete cascade,
  opportunity_id     uuid not null references consulting.opportunity(id) on delete cascade,
  criterion_id       uuid not null references consulting.scoring_criterion(id) on delete restrict,
  raw_value          numeric(18,6),
  normalized_value   numeric(9,6),
  weighted_value     numeric(18,6),
  -- Invariant I-7: NOT NULL. There is no path to a stored score without a
  -- recorded formula version, which is what makes a historical score
  -- reproducible years later.
  formula_version_id uuid not null references consulting.formula_version(id) on delete restrict,
  scored_by          uuid references consulting.app_user(id),
  scored_at          timestamptz not null default now(),
  evidence_note      text,
  -- Set when an agent proposed the value and a human accepted it.
  originating_agent_id uuid,
  unique (opportunity_id, criterion_id)
);
alter table consulting.opportunity_score enable row level security;

create table consulting.resource_estimate (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references consulting.firm(id) on delete cascade,
  opportunity_id     uuid not null references consulting.opportunity(id) on delete cascade,
  role_def_id        uuid not null references consulting.role_def(id) on delete restrict,
  skill_id           uuid references consulting.skill(id) on delete set null,
  hours_optimistic   numeric(12,2) not null check (hours_optimistic >= 0),
  hours_likely       numeric(12,2) not null check (hours_likely >= 0),
  hours_pessimistic  numeric(12,2) not null check (hours_pessimistic >= 0),
  -- F-CP-01 outputs, stored with their formula version
  hours_pert         numeric(12,2),
  sigma              numeric(12,4),
  rate_card_id       uuid references consulting.rate_card(id) on delete set null,
  estimated_cost     numeric(18,4),
  currency           consulting.currency_code,
  formula_version_id uuid not null references consulting.formula_version(id) on delete restrict,
  originating_agent_id uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid, updated_by uuid,
  unique (opportunity_id, role_def_id, skill_id),
  -- A three-point estimate whose points are out of order is not a conservative
  -- estimate, it is a data-entry error, and PERT would silently absorb it.
  constraint resource_estimate_ordered check (
    hours_optimistic <= hours_likely and hours_likely <= hours_pessimistic
  )
);
alter table consulting.resource_estimate enable row level security;

create table consulting.intake_feasibility (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references consulting.firm(id) on delete cascade,
  opportunity_id     uuid not null references consulting.opportunity(id) on delete cascade,
  as_of              timestamptz not null default now(),
  min_slack_hours    numeric(12,2),
  -- Named so the answer is "infeasible BECAUSE Solution Architects are short
  -- 60h in 2026-W14", not just "no". F-CP-08.
  bottleneck_role_id uuid references consulting.role_def(id),
  bottleneck_period  text,
  feasible           boolean not null,
  formula_version_id uuid not null references consulting.formula_version(id) on delete restrict,
  created_at         timestamptz not null default now(),
  created_by         uuid
);
alter table consulting.intake_feasibility enable row level security;
create index intake_feasibility_opp_idx on consulting.intake_feasibility (opportunity_id, as_of desc);

create table consulting.conflict_check (
  id                   uuid primary key default gen_random_uuid(),
  firm_id              uuid not null references consulting.firm(id) on delete cascade,
  opportunity_id       uuid not null references consulting.opportunity(id) on delete cascade,
  checked_at           timestamptz not null default now(),
  result               text not null check (result in ('CLEAR','FLAGGED','BLOCKED')),
  conflicting_client_id uuid references consulting.client(id),
  detail               text,
  cleared_by           uuid references consulting.app_user(id),
  cleared_at           timestamptz,
  created_at           timestamptz not null default now(),
  created_by           uuid,
  -- A FLAGGED or BLOCKED check that claims to be cleared must name who cleared
  -- it; otherwise the gate criterion could be satisfied by an empty gesture.
  constraint conflict_check_clearance check (
    result = 'CLEAR' or cleared_by is null or cleared_at is not null
  )
);
alter table consulting.conflict_check enable row level security;

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

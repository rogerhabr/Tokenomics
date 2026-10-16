-- ============================================================================
-- 0003 — ATLAS consulting core: tenancy, identity, org tree, client, engagement
--
-- Implements Layers A and B of docs/consulting/01-DOMAIN-MODEL.md.
--
-- Design notes carried from Stage 0:
--   DR-01  own schema `consulting`; nothing added to `public`
--   DR-02  org_unit is a first-class people tree, independent of any project
--          (the Jira Align import)
--   DR-05  authorisation lives here, never in public.profiles.role
--   DR-06  the org tree uses a materialised TEXT path, not ltree -- removes the
--          extension dependency (Stage 0 open item O-1) at no loss: ancestor and
--          descendant queries are prefix LIKEs served by a text_pattern_ops index
--   DR-07  client-side users authenticate in, so CLIENT_* roles are real
--          app_user rows with real user_role grants and validity windows.
--          Invariant I-3 therefore applies to client signatures too.
--   DR-08  single currency at launch, multi-currency schema in place: every
--          money column carries currency, and any cross-currency aggregate
--          needs an explicit fx_rate_version (invariant I-14, FMEA F-12)
--
-- RLS is ENABLED on every table here; the policies themselves land in 0007.
-- A table with RLS on and no policy denies everything, which is the safe
-- intermediate state.
-- ============================================================================

create extension if not exists pgcrypto;

create schema if not exists consulting;
revoke all on schema consulting from public;
grant usage on schema consulting to authenticated, service_role;

-- ============================================================================
-- Shared plumbing
-- ============================================================================

-- plpgsql, so the call to current_app_user_unsafe() below resolves at run
-- time; the helper itself is defined further down, after app_user exists.
create or replace function consulting.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(new.updated_by, consulting.current_app_user_unsafe());
  return new;
end $$;

-- Money: a 3-letter ISO code, enforced shape.
create domain consulting.currency_code as char(3)
  check (value ~ '^[A-Z]{3}$');

-- Percent 0..1 (allocations, contributions, POC).
create domain consulting.unit_fraction as numeric(9,6)
  check (value >= 0 and value <= 1);

-- ============================================================================
-- Layer A1 — Firm (tenant root)
-- ============================================================================

create table consulting.firm (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  base_currency           consulting.currency_code not null default 'USD',
  -- Stage 0 open item O-2, answered: calendar year.
  fiscal_year_start_month smallint not null default 1
                            check (fiscal_year_start_month between 1 and 12),
  -- DR-08: flip to true when multi-currency goes live.
  multi_currency_enabled  boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by              uuid,
  updated_by              uuid
);
alter table consulting.firm enable row level security;

comment on column consulting.firm.fiscal_year_start_month is
  'Drives every fiscal_period key on metric rows. FMEA F-19.';

-- ============================================================================
-- Layer A2 — Identity
-- ============================================================================

create table consulting.app_user (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references consulting.firm(id) on delete restrict,
  auth_user_id    uuid unique references auth.users(id) on delete set null,
  email           text not null,
  display_name    text,
  -- CLIENT-side users authenticate in (DR-07) but are never firm staff.
  party           text not null default 'FIRM'
                    check (party in ('FIRM', 'CLIENT')),
  employment_type text not null default 'EMPLOYEE'
                    check (employment_type in ('EMPLOYEE','CONTRACTOR','PARTNER','CLIENT')),
  -- A client-side user is pinned to exactly one client; firm staff to none.
  client_id       uuid,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid,
  updated_by      uuid,
  unique (firm_id, email),
  constraint app_user_client_party_consistent check (
    (party = 'CLIENT' and client_id is not null) or
    (party = 'FIRM'   and client_id is null)
  )
);
alter table consulting.app_user enable row level security;
create index app_user_firm_idx on consulting.app_user (firm_id) where is_active;
create index app_user_auth_idx on consulting.app_user (auth_user_id);

-- ============================================================================
-- Layer A3 — Org tree (Jira Align import, DR-02)
-- ============================================================================

create table consulting.org_unit (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references consulting.firm(id) on delete cascade,
  parent_id   uuid references consulting.org_unit(id) on delete restrict,
  code        text not null,
  name        text not null,
  kind        text not null
                check (kind in ('FIRM','PRACTICE','CAPABILITY_GROUP','POD')),
  -- Materialised path, maintained by trigger: 'ROOT.PRAC_DATA.CG_ENG.POD_A'
  path        text not null default '',
  depth       smallint not null default 0,
  lead_user_id uuid references consulting.app_user(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid,
  unique (firm_id, code)
);
alter table consulting.org_unit enable row level security;
-- text_pattern_ops so `path like 'ROOT.PRAC_DATA.%'` uses the index
create index org_unit_path_idx on consulting.org_unit (path text_pattern_ops);
create index org_unit_parent_idx on consulting.org_unit (parent_id);

create or replace function consulting.org_unit_maintain_path()
returns trigger
language plpgsql
as $$
declare
  v_parent_path  text;
  v_parent_depth smallint;
  v_parent_firm  uuid;
begin
  if new.parent_id is null then
    new.path  := new.code;
    new.depth := 0;
  else
    select path, depth, firm_id
      into v_parent_path, v_parent_depth, v_parent_firm
      from consulting.org_unit where id = new.parent_id;

    if v_parent_path is null then
      raise exception 'parent org_unit % not found', new.parent_id;
    end if;
    if v_parent_firm <> new.firm_id then
      raise exception 'org_unit parent belongs to a different firm';
    end if;

    new.path  := v_parent_path || '.' || new.code;
    new.depth := v_parent_depth + 1;
  end if;

  -- A cycle would make the path infinite; catch it before writing.
  if new.parent_id = new.id then
    raise exception 'org_unit cannot be its own parent';
  end if;

  return new;
end $$;

-- No column list on either trigger, deliberately. `UPDATE OF col` fires on the
-- columns NAMED IN THE STATEMENT, not on columns a BEFORE trigger went on to
-- change. `update org_unit set parent_id = ...` never names `path`, so a
-- `before update of parent_id` / `after update of path` pair silently skips the
-- subtree re-path -- the move lands but every descendant keeps a stale path.
-- Both bodies are guarded by `is distinct from`, so firing on every update is
-- idempotent and costs one comparison.
create trigger org_unit_maintain_path
  before insert or update on consulting.org_unit
  for each row execute function consulting.org_unit_maintain_path();

-- Re-path the subtree when a node moves or is renamed.
create or replace function consulting.org_unit_repath_descendants()
returns trigger
language plpgsql
as $$
begin
  -- The statement below rewrites the whole subtree in one pass, which re-fires
  -- this same AFTER trigger for every descendant row. Those nested calls would
  -- find nothing to do (their old paths no longer exist), but they would still
  -- scan the table once per node. A transaction-local guard makes a subtree move
  -- one UPDATE instead of O(nodes) of them.
  if coalesce(current_setting('consulting.repathing', true), 'off') = 'on' then
    return null;
  end if;

  if new.path is distinct from old.path then
    perform set_config('consulting.repathing', 'on', true);
    update consulting.org_unit c
       set path  = new.path || substring(c.path from length(old.path) + 1),
           depth = new.depth + (c.depth - old.depth)
     where c.firm_id = new.firm_id
       and c.path like old.path || '.%';
    perform set_config('consulting.repathing', 'off', true);
  end if;
  return null;
end $$;

create trigger org_unit_repath_descendants
  after update on consulting.org_unit
  for each row execute function consulting.org_unit_repath_descendants();

create table consulting.org_membership (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references consulting.firm(id) on delete cascade,
  user_id     uuid not null references consulting.app_user(id) on delete cascade,
  org_unit_id uuid not null references consulting.org_unit(id) on delete restrict,
  from_date   date not null,
  to_date     date,
  fte_pct     consulting.unit_fraction not null default 1.0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid,
  constraint org_membership_window check (to_date is null or to_date >= from_date)
);
alter table consulting.org_membership enable row level security;
create index org_membership_user_idx on consulting.org_membership (user_id, from_date desc);

-- ============================================================================
-- Layer A4 — Roles & authority
-- ============================================================================

create table consulting.role_def (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references consulting.firm(id) on delete cascade,
  code           text not null,
  name           text not null,
  -- Invariant I-6 compares this: a waiver needs a STRICTLY higher rank.
  authority_rank smallint not null check (authority_rank between 0 and 1000),
  is_client_side boolean not null default false,
  can_waive      boolean not null default false,
  can_delegate   boolean not null default false,
  can_sign       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid,
  updated_by     uuid,
  unique (firm_id, code)
);
alter table consulting.role_def enable row level security;

-- Domain-scoped waiver authority: a FINANCE_CONTROLLER must not be able to
-- waive a QA criterion even though can_waive is true. FMEA F-02.
create table consulting.role_waiver_domain (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references consulting.firm(id) on delete cascade,
  role_def_id uuid not null references consulting.role_def(id) on delete cascade,
  domain      text not null
                check (domain in ('SCORING','SCHEDULE','EVM','REVENUE',
                                  'CAPACITY','RISK','QUALITY','GOVERNANCE','ANY')),
  created_at  timestamptz not null default now(),
  created_by  uuid,
  unique (role_def_id, domain)
);
alter table consulting.role_waiver_domain enable row level security;

create table consulting.user_role (
  id                   uuid primary key default gen_random_uuid(),
  firm_id              uuid not null references consulting.firm(id) on delete cascade,
  user_id              uuid not null references consulting.app_user(id) on delete cascade,
  role_def_id          uuid not null references consulting.role_def(id) on delete restrict,
  scope_kind           text not null
                         check (scope_kind in ('FIRM','CLIENT','ENGAGEMENT','PROJECT')),
  scope_id             uuid,
  -- Invariant I-3: a signature is valid only if the grant was live at the
  -- moment of signing. Hence a window, not a boolean.
  valid_from           timestamptz not null default now(),
  valid_to             timestamptz,
  granted_by           uuid references consulting.app_user(id),
  -- FMEA F-18: delegation depth is capped at 1 and must expire.
  delegated_from       uuid references consulting.user_role(id) on delete cascade,
  delegation_expires_at timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid,
  updated_by           uuid,
  constraint user_role_window check (valid_to is null or valid_to > valid_from),
  constraint user_role_scope_id_required check (
    (scope_kind = 'FIRM' and scope_id is null) or
    (scope_kind <> 'FIRM' and scope_id is not null)
  ),
  constraint user_role_delegation_expires check (
    delegated_from is null or delegation_expires_at is not null
  )
);
alter table consulting.user_role enable row level security;
create index user_role_lookup_idx
  on consulting.user_role (user_id, role_def_id, scope_kind, scope_id);
create index user_role_validity_idx
  on consulting.user_role (valid_from, valid_to);

-- FMEA F-18: a delegate may not delegate onward, and the delegating role must
-- actually permit delegation.
create or replace function consulting.guard_delegation_depth()
returns trigger
language plpgsql
as $$
declare
  v_parent_delegated uuid;
  v_can_delegate     boolean;
begin
  if new.delegated_from is null then
    return new;
  end if;

  select ur.delegated_from, rd.can_delegate
    into v_parent_delegated, v_can_delegate
    from consulting.user_role ur
    join consulting.role_def rd on rd.id = ur.role_def_id
   where ur.id = new.delegated_from;

  if v_parent_delegated is not null then
    raise exception 'delegation depth is capped at 1: a delegate may not delegate'
      using errcode = '42501', hint = 'FMEA F-18';
  end if;

  if not coalesce(v_can_delegate, false) then
    raise exception 'this role may not delegate signing authority'
      using errcode = '42501';
  end if;

  if new.delegation_expires_at <= now() then
    raise exception 'delegation_expires_at must be in the future'
      using errcode = '22023';
  end if;

  return new;
end $$;

create trigger guard_delegation_depth
  before insert or update on consulting.user_role
  for each row execute function consulting.guard_delegation_depth();

-- ============================================================================
-- Layer A5 — Skills (drives the Planisware capacity model)
-- ============================================================================

create table consulting.skill (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references consulting.firm(id) on delete cascade,
  code       text not null,
  name       text not null,
  family     text,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (firm_id, code)
);
alter table consulting.skill enable row level security;

create table consulting.person_skill (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references consulting.firm(id) on delete cascade,
  user_id      uuid not null references consulting.app_user(id) on delete cascade,
  skill_id     uuid not null references consulting.skill(id) on delete cascade,
  proficiency  smallint not null check (proficiency between 1 and 5),
  certified_at date,
  assessed_by  uuid references consulting.app_user(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid,
  updated_by   uuid,
  unique (user_id, skill_id)
);
alter table consulting.person_skill enable row level security;

-- ============================================================================
-- Layer A6 — Calendars (working-time arithmetic; FMEA F-19)
-- ============================================================================

create table consulting.calendar (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references consulting.firm(id) on delete cascade,
  code           text not null,
  name           text not null,
  timezone       text not null default 'UTC',
  hours_per_day  numeric(5,2) not null default 8.0 check (hours_per_day > 0),
  -- ISO weekday numbers that are working days: 1=Mon .. 7=Sun
  work_days      smallint[] not null default '{1,2,3,4,5}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid,
  updated_by     uuid,
  unique (firm_id, code)
);
alter table consulting.calendar enable row level security;

create table consulting.calendar_exception (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references consulting.firm(id) on delete cascade,
  calendar_id uuid not null references consulting.calendar(id) on delete cascade,
  date        date not null,
  kind        text not null
                check (kind in ('HOLIDAY','HALF_DAY','CLIENT_BLACKOUT','EXTRA_WORKDAY')),
  hours       numeric(5,2),
  note        text,
  created_at  timestamptz not null default now(),
  created_by  uuid,
  unique (calendar_id, date)
);
alter table consulting.calendar_exception enable row level security;

-- ============================================================================
-- Layer A7 — Rates & FX
--
-- DR-03: cost rates only. Under FIXED_PRICE / MILESTONE contracts hours never
-- bill, so there is deliberately no bill_rate column -- its absence is the
-- schema-level statement that T&M is out of scope.
-- ============================================================================

create table consulting.rate_card (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references consulting.firm(id) on delete cascade,
  version        integer not null default 1,
  -- either a role-level default rate or a person-specific override
  role_def_id    uuid references consulting.role_def(id) on delete cascade,
  user_id        uuid references consulting.app_user(id) on delete cascade,
  cost_rate      numeric(18,4) not null check (cost_rate >= 0),
  currency       consulting.currency_code not null,
  effective_from date not null,
  effective_to   date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid,
  updated_by     uuid,
  constraint rate_card_target check (
    (role_def_id is not null and user_id is null) or
    (role_def_id is null     and user_id is not null)
  ),
  constraint rate_card_window check (effective_to is null or effective_to >= effective_from)
);
alter table consulting.rate_card enable row level security;
create index rate_card_role_idx on consulting.rate_card (role_def_id, effective_from desc);
create index rate_card_user_idx on consulting.rate_card (user_id, effective_from desc);

create table consulting.fx_rate_version (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references consulting.firm(id) on delete cascade,
  as_of         date not null,
  base_currency consulting.currency_code not null,
  -- {"EUR": 0.92, "GBP": 0.79, ...} relative to base_currency
  rates         jsonb not null default '{}'::jsonb,
  source        text,
  -- Once a period closes its rate is frozen, so a closed month's margin
  -- can never move. FMEA F-12.
  locked_at     timestamptz,
  created_at    timestamptz not null default now(),
  created_by    uuid,
  unique (firm_id, as_of, base_currency)
);
alter table consulting.fx_rate_version enable row level security;

-- ============================================================================
-- Layer B1 — Client & the conflict barrier
-- ============================================================================

create table consulting.conflict_group (
  id         uuid primary key default gen_random_uuid(),
  firm_id    uuid not null references consulting.firm(id) on delete cascade,
  code       text not null,
  name       text not null,
  rationale  text,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (firm_id, code)
);
alter table consulting.conflict_group enable row level security;

comment on table consulting.conflict_group is
  'Two clients in one group are mutually exclusive for staffing and visibility. '
  'Invariant I-13, FMEA F-11.';

create table consulting.client (
  id                uuid primary key default gen_random_uuid(),
  firm_id           uuid not null references consulting.firm(id) on delete cascade,
  code              text not null,
  legal_name        text not null,
  industry_code     text,
  conflict_group_id uuid references consulting.conflict_group(id) on delete set null,
  risk_tier         text not null default 'STANDARD'
                      check (risk_tier in ('LOW','STANDARD','ELEVATED','RESTRICTED')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid,
  updated_by        uuid,
  unique (firm_id, code)
);
alter table consulting.client enable row level security;
create index client_conflict_idx on consulting.client (conflict_group_id);

-- Now that client exists, pin the app_user -> client FK (DR-07).
alter table consulting.app_user
  add constraint app_user_client_fk
  foreign key (client_id) references consulting.client(id) on delete restrict;

create table consulting.conflict_waiver (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references consulting.firm(id) on delete cascade,
  user_id       uuid not null references consulting.app_user(id) on delete cascade,
  client_a_id   uuid not null references consulting.client(id) on delete cascade,
  client_b_id   uuid not null references consulting.client(id) on delete cascade,
  granted_by    uuid not null references consulting.app_user(id),
  justification text not null,
  valid_from    timestamptz not null default now(),
  valid_to      timestamptz not null,
  created_at    timestamptz not null default now(),
  created_by    uuid,
  constraint conflict_waiver_distinct check (client_a_id <> client_b_id),
  constraint conflict_waiver_window  check (valid_to > valid_from)
);
alter table consulting.conflict_waiver enable row level security;
create index conflict_waiver_user_idx on consulting.conflict_waiver (user_id, valid_to);

-- ============================================================================
-- Layer B2 — Engagement (DR-03: contract types)
-- ============================================================================

create table consulting.engagement (
  id                uuid primary key default gen_random_uuid(),
  firm_id           uuid not null references consulting.firm(id) on delete cascade,
  client_id         uuid not null references consulting.client(id) on delete restrict,
  code              text not null,
  name              text not null,
  -- DR-03: T&M is deliberately absent from this CHECK. Adding it would require
  -- a migration AND a different KPI set (realisation, effective bill rate),
  -- which the Stage 0 decision record rules out of scope.
  contract_type     text not null
                      check (contract_type in ('FIXED_PRICE','MILESTONE','RETAINER','OUTCOME')),
  contract_value    numeric(18,4) not null check (contract_value > 0),
  currency          consulting.currency_code not null,
  signed_at         timestamptz,
  start_date        date not null,
  end_date          date not null,
  -- F-RV-01..04: how revenue is recognised
  rev_rec_method    text not null default 'PERCENT_COMPLETE'
                      check (rev_rec_method in ('PERCENT_COMPLETE','MILESTONE')),
  poc_basis         text not null default 'COST_TO_COST'
                      check (poc_basis in ('COST_TO_COST','EFFORT','UNITS')),
  payment_terms_days smallint not null default 30,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid,
  updated_by        uuid,
  unique (firm_id, code),
  constraint engagement_dates check (end_date >= start_date)
);
alter table consulting.engagement enable row level security;
create index engagement_client_idx on consulting.engagement (client_id);

-- THE RLS boundary. Not firm_id -- see 01-DOMAIN-MODEL.md §2.
create table consulting.engagement_member (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references consulting.firm(id) on delete cascade,
  engagement_id uuid not null references consulting.engagement(id) on delete cascade,
  user_id       uuid not null references consulting.app_user(id) on delete cascade,
  role_def_id   uuid not null references consulting.role_def(id) on delete restrict,
  access_level  text not null default 'CONTRIBUTE'
                  check (access_level in ('READ','CONTRIBUTE','MANAGE')),
  from_date     date not null default current_date,
  to_date       date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid,
  constraint engagement_member_window check (to_date is null or to_date >= from_date)
);
alter table consulting.engagement_member enable row level security;
create unique index engagement_member_unique_live
  on consulting.engagement_member (engagement_id, user_id, role_def_id, from_date);
create index engagement_member_user_idx
  on consulting.engagement_member (user_id, engagement_id);

comment on table consulting.engagement_member is
  'The real row-level security boundary. Cross-engagement leakage inside one '
  'firm is the catastrophic case, not cross-tenant. See FMEA F-11.';

create table consulting.barrier_acknowledgement (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references consulting.firm(id) on delete cascade,
  user_id          uuid not null references consulting.app_user(id) on delete cascade,
  engagement_id    uuid not null references consulting.engagement(id) on delete cascade,
  document_version text not null,
  accepted_at      timestamptz not null default now(),
  ip               inet,
  user_agent       text,
  unique (user_id, engagement_id, document_version)
);
alter table consulting.barrier_acknowledgement enable row level security;

-- ============================================================================
-- Authorisation helpers
--
-- Every one is SECURITY DEFINER and STABLE. They are called from RLS policies,
-- so they must not themselves be subject to the policies they serve.
-- ============================================================================

-- Resolves auth.uid() -> consulting.app_user.id without touching RLS.
-- SECURITY DEFINER + a direct read, because every policy calls it and a
-- policy that recursed through its own table would deadlock the planner.
create or replace function consulting.current_app_user_unsafe()
returns uuid
language sql
stable
security definer
set search_path = consulting, public, pg_temp
as $$
  select u.id
    from consulting.app_user u
   where u.auth_user_id = auth.uid()
     and u.is_active
   limit 1;
$$;

create or replace function consulting.current_firm()
returns uuid
language sql stable security definer
set search_path = consulting, public, pg_temp
as $$
  select firm_id from consulting.app_user
   where auth_user_id = auth.uid() and is_active
   limit 1;
$$;

-- Does the caller hold any of these role codes at FIRM scope, right now?
create or replace function consulting.has_firm_role(p_codes text[])
returns boolean
language sql stable security definer
set search_path = consulting, public, pg_temp
as $$
  select exists (
    select 1
      from consulting.user_role ur
      join consulting.role_def rd on rd.id = ur.role_def_id
      join consulting.app_user u  on u.id  = ur.user_id
     where u.auth_user_id = auth.uid()
       and u.is_active
       and ur.scope_kind = 'FIRM'
       and rd.code = any (p_codes)
       and now() >= ur.valid_from
       and (ur.valid_to is null or now() < ur.valid_to)
       and (ur.delegation_expires_at is null or now() < ur.delegation_expires_at)
  );
$$;

-- Is the caller a live member of this engagement?
create or replace function consulting.is_engagement_member(p_engagement_id uuid)
returns boolean
language sql stable security definer
set search_path = consulting, public, pg_temp
as $$
  select exists (
    select 1
      from consulting.engagement_member em
      join consulting.app_user u on u.id = em.user_id
     where em.engagement_id = p_engagement_id
       and u.auth_user_id = auth.uid()
       and u.is_active
       and current_date >= em.from_date
       and (em.to_date is null or current_date <= em.to_date)
  );
$$;

-- Invariant I-13. Is the caller barred from this engagement because they are
-- already inside a different client in the same conflict group, with no live
-- waiver? Firm-wide roles are NOT exempt: a Director is still walled.
create or replace function consulting.conflict_blocked(p_engagement_id uuid)
returns boolean
language sql stable security definer
set search_path = consulting, public, pg_temp
as $$
  with me as (
    select id from consulting.app_user
     where auth_user_id = auth.uid() and is_active limit 1
  ),
  target as (
    select e.client_id, c.conflict_group_id
      from consulting.engagement e
      join consulting.client c on c.id = e.client_id
     where e.id = p_engagement_id
  )
  select exists (
    select 1
      from consulting.engagement_member em
      join consulting.engagement e2 on e2.id = em.engagement_id
      join consulting.client      c2 on c2.id = e2.client_id
      cross join target t
      join me on em.user_id = me.id
     where t.conflict_group_id is not null
       and c2.conflict_group_id = t.conflict_group_id
       and c2.id <> t.client_id
       and current_date >= em.from_date
       and (em.to_date is null or current_date <= em.to_date)
       and not exists (
         select 1 from consulting.conflict_waiver w
          where w.user_id = me.id
            and now() between w.valid_from and w.valid_to
            and ((w.client_a_id = t.client_id and w.client_b_id = c2.id)
              or (w.client_b_id = t.client_id and w.client_a_id = c2.id))
       )
  );
$$;

-- The predicate every delivery-table policy uses.
create or replace function consulting.can_see_engagement(p_engagement_id uuid)
returns boolean
language sql stable security definer
set search_path = consulting, public, pg_temp
as $$
  select p_engagement_id is not null
     and not consulting.conflict_blocked(p_engagement_id)
     and (
          consulting.is_engagement_member(p_engagement_id)
       or consulting.has_firm_role(array['DIRECTOR','PMO_LEAD','FINANCE_CONTROLLER'])
     );
$$;

create or replace function consulting.authority_rank_of(p_role_def_id uuid)
returns smallint
language sql stable security definer
set search_path = consulting, public, pg_temp
as $$
  select authority_rank from consulting.role_def where id = p_role_def_id;
$$;

-- Highest FIRM-scope authority rank the caller currently holds.
create or replace function consulting.my_max_authority_rank()
returns smallint
language sql stable security definer
set search_path = consulting, public, pg_temp
as $$
  select coalesce(max(rd.authority_rank), 0)::smallint
    from consulting.user_role ur
    join consulting.role_def rd on rd.id = ur.role_def_id
    join consulting.app_user u  on u.id  = ur.user_id
   where u.auth_user_id = auth.uid()
     and u.is_active
     and now() >= ur.valid_from
     and (ur.valid_to is null or now() < ur.valid_to);
$$;

-- updated_at triggers, applied uniformly
do $$
declare t record;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'updated_at'
     where n.nspname = 'consulting' and c.relkind = 'r'
  loop
    execute format(
      'create trigger touch_updated_at before update on consulting.%I
         for each row execute function consulting.touch_updated_at()', t.relname);
  end loop;
end $$;

grant select, insert, update, delete on all tables in schema consulting to authenticated;
grant usage, select on all sequences in schema consulting to authenticated;

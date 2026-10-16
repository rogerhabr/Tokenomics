-- ============================================================================
-- 0007 — Phase 3: timesheets, actuals, forecasts, EVM, revenue recognition
--
-- Layer E of docs/consulting/01-DOMAIN-MODEL.md. Calibrated for FIXED_PRICE and
-- MILESTONE contracts only (DR-03), which has three structural consequences
-- visible in this schema:
--
--   * timesheet_entry has no bill rate and no billable flag. Hours are a COST
--     instrument only. Their absence is the schema stating that T&M is out of
--     scope, not an omission.
--   * revenue_recognition reads an APPROVED forecast_version, never live EAC.
--   * milestone_invoice is foreign-keyed to a gate instance: a milestone is not
--     revenue until its gate passes. Governance is load-bearing on the P&L.
-- ============================================================================

-- ============================================================================
-- Period control — the defence against retro-dating (FMEA F-04)
-- ============================================================================

create table consulting.timesheet_period (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references consulting.firm(id) on delete cascade,
  fiscal_period text not null,
  period_start  date not null,
  period_end    date not null,
  state         text not null default 'OPEN'
                  check (state in ('OPEN','SUBMISSION_CLOSED','LOCKED')),
  locked_at     timestamptz,
  locked_by     uuid references consulting.app_user(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid, updated_by uuid,
  unique (firm_id, fiscal_period),
  constraint timesheet_period_dates check (period_end >= period_start),
  constraint timesheet_period_locked_shape check (
    state <> 'LOCKED' or (locked_at is not null and locked_by is not null)
  )
);
alter table consulting.timesheet_period enable row level security;
create index timesheet_period_range_idx on consulting.timesheet_period (period_start, period_end);

create table consulting.timesheet_entry (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references consulting.firm(id) on delete cascade,
  project_id   uuid not null references consulting.project(id) on delete cascade,
  activity_id  uuid not null references consulting.activity(id) on delete restrict,
  user_id      uuid not null references consulting.app_user(id) on delete restrict,
  period_id    uuid not null references consulting.timesheet_period(id) on delete restrict,
  entry_date   date not null,
  hours        numeric(8,2) not null check (hours > 0 and hours <= 24),
  note         text,
  state        text not null default 'DRAFT'
                 check (state in ('DRAFT','SUBMITTED','APPROVED','REJECTED')),
  submitted_at timestamptz,
  approved_by  uuid references consulting.app_user(id),
  approved_at  timestamptz,
  reject_reason text,
  -- entry_date is what the hours are FOR; created_at is when they were typed.
  -- The divergence is a monitored signal (F-04), so both are first-class.
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid, updated_by uuid,
  -- Approver may not be the submitter.
  constraint timesheet_no_self_approval check (approved_by is null or approved_by <> user_id),
  constraint timesheet_approved_shape check (
    state <> 'APPROVED' or (approved_by is not null and approved_at is not null)
  )
);
alter table consulting.timesheet_entry enable row level security;
create index timesheet_user_date_idx on consulting.timesheet_entry (user_id, entry_date);
create index timesheet_activity_idx on consulting.timesheet_entry (activity_id, state);
-- F-04 detector: how late were these hours entered?
--
-- `created_at::date` cannot be indexed -- the timestamptz->date cast is STABLE,
-- not IMMUTABLE, because it depends on the session TimeZone. Rather than index
-- a cast, the lateness is computed once at insert, in UTC, and stored. That
-- also makes it a first-class queryable signal instead of something every
-- AuditSentinelAgent query has to recompute.
alter table consulting.timesheet_entry
  add column entered_days_late integer not null default 0;

create index timesheet_backdate_idx
  on consulting.timesheet_entry (entered_days_late desc) where state = 'APPROVED';

create or replace function consulting.set_timesheet_lateness()
returns trigger language plpgsql as $$
begin
  new.entered_days_late :=
    greatest(0, ((now() at time zone 'UTC')::date - new.entry_date));
  return new;
end $$;

create trigger set_timesheet_lateness
  before insert on consulting.timesheet_entry
  for each row execute function consulting.set_timesheet_lateness();

-- A locked period accepts nothing. A correction becomes a visible adjusting
-- entry in an open period, never a silent backdate.
create or replace function consulting.guard_timesheet_period_lock()
returns trigger language plpgsql as $$
declare v_state text; v_start date; v_end date;
begin
  select state, period_start, period_end into v_state, v_start, v_end
    from consulting.timesheet_period
   where id = coalesce(new.period_id, old.period_id);

  if v_state = 'LOCKED' then
    raise exception 'fiscal period is LOCKED; book a correcting entry in an open period'
      using errcode = '42501', hint = 'FMEA F-04';
  end if;

  if tg_op <> 'DELETE' then
    if new.entry_date < v_start or new.entry_date > v_end then
      raise exception 'entry_date % falls outside its period (% .. %)',
        new.entry_date, v_start, v_end using errcode = '23514';
    end if;
    -- SUBMISSION_CLOSED still permits approval/rejection of what is already in,
    -- but no new hours and no edits to hours.
    if v_state = 'SUBMISSION_CLOSED' then
      if tg_op = 'INSERT' then
        raise exception 'period submission is closed; no new entries'
          using errcode = '42501';
      elsif new.hours is distinct from old.hours
         or new.entry_date is distinct from old.entry_date
         or new.activity_id is distinct from old.activity_id then
        raise exception 'period submission is closed; hours and dates are frozen'
          using errcode = '42501';
      end if;
    end if;
  end if;
  return coalesce(new, old);
end $$;

create trigger guard_timesheet_period_lock
  before insert or update or delete on consulting.timesheet_entry
  for each row execute function consulting.guard_timesheet_period_lock();

create table consulting.expense_entry (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references consulting.firm(id) on delete cascade,
  project_id      uuid not null references consulting.project(id) on delete cascade,
  cost_account_id uuid not null references consulting.cost_account(id) on delete restrict,
  user_id         uuid not null references consulting.app_user(id) on delete restrict,
  period_id       uuid not null references consulting.timesheet_period(id) on delete restrict,
  entry_date      date not null,
  amount          numeric(18,4) not null check (amount > 0),
  currency        consulting.currency_code not null,
  category        text not null,
  receipt_url     text,
  state           text not null default 'DRAFT'
                    check (state in ('DRAFT','SUBMITTED','APPROVED','REJECTED')),
  approved_by     uuid references consulting.app_user(id),
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid, updated_by uuid,
  constraint expense_no_self_approval check (approved_by is null or approved_by <> user_id)
);
alter table consulting.expense_entry enable row level security;

-- ============================================================================
-- Progress — and the restriction that keeps EV honest (FMEA F-05)
-- ============================================================================

create table consulting.progress_update (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references consulting.firm(id) on delete cascade,
  project_id    uuid not null references consulting.project(id) on delete cascade,
  activity_id   uuid not null references consulting.activity(id) on delete cascade,
  as_of         date not null,
  pct_complete  consulting.unit_fraction not null,
  prior_pct     consulting.unit_fraction,
  method        text not null
                  check (method in ('ZERO_HUNDRED','FIFTY_FIFTY','MILESTONE_WEIGHTED',
                                    'UNITS','PHYSICAL','LOE')),
  units_done    numeric(12,2),
  units_total   numeric(12,2),
  reported_by   uuid not null references consulting.app_user(id) on delete restrict,
  evidence_note text,
  created_at    timestamptz not null default now(),
  created_by    uuid,
  unique (activity_id, as_of),
  constraint progress_units_shape check (
    method <> 'UNITS' or (units_done is not null and units_total is not null and units_total > 0)
  )
);
alter table consulting.progress_update enable row level security;
create index progress_activity_idx on consulting.progress_update (activity_id, as_of desc);

-- "90% syndrome" is the single most likely way this platform produces
-- confident, wrong numbers (FMEA F-05, RPN 75). An unrestricted subjective
-- percentage makes EV a number the PM chooses rather than one the work earns.
-- These rules are the whole defence, so they live in the database:
--
--   * the reported method must match the activity's declared method
--   * ZERO_HUNDRED accepts only 0 or 1
--   * FIFTY_FIFTY accepts only 0, 0.5 or 1
--   * PHYSICAL requires evidence
--   * LOE is whitelisted to non-BUILD scope, because it earns value
--     automatically and is therefore the most dangerous method in the catalogue
--   * progress may not go backwards without an explicit evidence note
create or replace function consulting.guard_progress_method()
returns trigger language plpgsql as $$
declare
  v_declared text;
  v_scope    text;
  v_prior    numeric;
begin
  select a.pct_complete_method, w.scope_class
    into v_declared, v_scope
    from consulting.activity a
    join consulting.wbs_node w on w.id = a.wbs_node_id
   where a.id = new.activity_id;

  if new.method is distinct from v_declared then
    raise exception 'progress method % does not match the activity''s declared method %',
      new.method, v_declared using errcode = '23514', hint = 'FMEA F-05';
  end if;

  if new.method = 'ZERO_HUNDRED' and new.pct_complete not in (0, 1) then
    raise exception 'ZERO_HUNDRED progress must be 0 or 1, got %', new.pct_complete
      using errcode = '23514';
  end if;

  if new.method = 'FIFTY_FIFTY' and new.pct_complete not in (0, 0.5, 1) then
    raise exception 'FIFTY_FIFTY progress must be 0, 0.5 or 1, got %', new.pct_complete
      using errcode = '23514';
  end if;

  if new.method = 'PHYSICAL' and coalesce(btrim(new.evidence_note), '') = '' then
    raise exception 'PHYSICAL progress requires an evidence_note'
      using errcode = '23514',
            hint = 'FMEA F-05: an assessed percentage without evidence is an assertion';
  end if;

  if new.method = 'LOE' and v_scope = 'BUILD' then
    raise exception 'LOE progress is not permitted on BUILD scope (it earns value automatically)'
      using errcode = '23514', hint = 'FMEA F-05';
  end if;

  if new.method = 'UNITS' then
    if abs(new.pct_complete - (new.units_done / new.units_total)) > 0.0001 then
      raise exception 'UNITS progress % does not match units_done/units_total (%/%)',
        new.pct_complete, new.units_done, new.units_total using errcode = '23514';
    end if;
  end if;

  -- Carry the previous value so the full trajectory is auditable and a late
  -- correction cannot be disguised as steady progress.
  select pct_complete into v_prior
    from consulting.progress_update
   where activity_id = new.activity_id and as_of < new.as_of
   order by as_of desc limit 1;
  new.prior_pct := v_prior;

  if v_prior is not null and new.pct_complete < v_prior
     and coalesce(btrim(new.evidence_note), '') = '' then
    raise exception 'progress regressed from % to % without an evidence_note',
      v_prior, new.pct_complete using errcode = '23514';
  end if;

  return new;
end $$;

create trigger guard_progress_method
  before insert or update on consulting.progress_update
  for each row execute function consulting.guard_progress_method();

-- ============================================================================
-- Derived cost, forecasts and EVM
-- ============================================================================

create table consulting.cost_actual (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references consulting.firm(id) on delete cascade,
  project_id         uuid not null references consulting.project(id) on delete cascade,
  wbs_node_id        uuid references consulting.wbs_node(id) on delete cascade,
  fiscal_period      text not null,
  labour_amount      numeric(18,4) not null default 0,
  expense_amount     numeric(18,4) not null default 0,
  currency           consulting.currency_code not null,
  fx_rate_version_id uuid references consulting.fx_rate_version(id) on delete restrict,
  formula_version_id uuid not null references consulting.formula_version(id) on delete restrict,
  computed_at        timestamptz not null default now(),
  unique (project_id, wbs_node_id, fiscal_period)
);
alter table consulting.cost_actual enable row level security;

create table consulting.forecast_version (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references consulting.firm(id) on delete cascade,
  project_id         uuid not null references consulting.project(id) on delete cascade,
  version            integer not null,
  as_of              date not null,
  -- F-EV-10. BOTTOM_UP becomes mandatory below force_bottom_up_cpi, because
  -- the statistical extrapolations are no longer defensible there.
  method             text not null
                       check (method in ('CPI_PERSISTS','AT_PLAN','COMPOSITE','BOTTOM_UP')),
  etc_amount         numeric(18,4) not null,
  eac_amount         numeric(18,4) not null,
  forecast_finish    date,
  currency           consulting.currency_code not null,
  state              text not null default 'DRAFT'
                       check (state in ('DRAFT','PENDING_APPROVAL','APPROVED','SUPERSEDED')),
  approved_by        uuid references consulting.app_user(id),
  approved_at        timestamptz,
  formula_version_id uuid not null references consulting.formula_version(id) on delete restrict,
  originating_agent_id uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references consulting.app_user(id), updated_by uuid,
  unique (project_id, version),
  constraint forecast_approved_shape check (
    state <> 'APPROVED' or (approved_by is not null and approved_at is not null)
  ),
  -- Segregation of duties: the author of a forecast may not approve it.
  constraint forecast_no_self_approval check (approved_by is null or approved_by <> created_by)
);
alter table consulting.forecast_version enable row level security;
create index forecast_approved_idx
  on consulting.forecast_version (project_id, as_of desc) where state = 'APPROVED';

create table consulting.evm_snapshot (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references consulting.firm(id) on delete cascade,
  project_id         uuid not null references consulting.project(id) on delete cascade,
  as_of              date not null,
  fiscal_period      text not null,
  baseline_id        uuid not null references consulting.baseline(id) on delete restrict,
  forecast_version_id uuid references consulting.forecast_version(id) on delete restrict,
  currency           consulting.currency_code not null,

  bac numeric(18,4), pv numeric(18,4), ev numeric(18,4), ac numeric(18,4),
  cv  numeric(18,4), sv numeric(18,4),
  cpi numeric(12,6),
  -- Raw SPI is stored but must not be displayed past the degeneracy point: as
  -- EV approaches BAC, SPI approaches 1.0 regardless of lateness, so a project
  -- three months late finishes reporting "on schedule". F-EV-07.
  spi numeric(12,6),
  spi_degenerate boolean not null default false,
  -- Earned Schedule. This is what G2 gates on. F-EV-08.
  es_days numeric(10,3), at_days numeric(10,3),
  sv_t numeric(10,3), spi_t numeric(12,6),

  eac numeric(18,4), etc numeric(18,4), vac numeric(18,4),
  tcpi_bac numeric(12,6), tcpi_eac numeric(12,6),
  ieac_days numeric(10,3),
  burn_rate numeric(18,4), runway_periods numeric(10,3),

  -- The two numbers a consulting director actually acts on, both absent from
  -- textbook EVM. F-EV-12, F-EV-13.
  margin_pct numeric(12,6),
  margin_erosion_pct numeric(12,6),
  margin_at_risk numeric(18,4),
  scope_creep_cost_pct numeric(12,6),
  scope_creep_time_pct numeric(12,6),

  formula_version_id uuid not null references consulting.formula_version(id) on delete restrict,
  -- Set when this row re-states a prior period under a newer formula version.
  -- A recompute never overwrites history; it appends a labelled row. F-01b.
  recompute_of       uuid references consulting.evm_snapshot(id) on delete set null,
  computed_at        timestamptz not null default now()
);
alter table consulting.evm_snapshot enable row level security;
create unique index evm_snapshot_period_unique
  on consulting.evm_snapshot (project_id, fiscal_period) where recompute_of is null;
create index evm_snapshot_project_idx on consulting.evm_snapshot (project_id, as_of desc);

-- ============================================================================
-- Revenue — gated by governance (DR-03)
-- ============================================================================

create table consulting.revenue_recognition (
  id                  uuid primary key default gen_random_uuid(),
  firm_id             uuid not null references consulting.firm(id) on delete cascade,
  engagement_id       uuid not null references consulting.engagement(id) on delete cascade,
  fiscal_period       text not null,
  method              text not null check (method in ('PERCENT_COMPLETE','MILESTONE')),
  poc                 consulting.unit_fraction,
  revenue_cum         numeric(18,4) not null default 0,
  revenue_period      numeric(18,4) not null default 0,
  invoiced_cum        numeric(18,4) not null default 0,
  wip_amount          numeric(18,4) not null default 0,
  deferred_amount     numeric(18,4) not null default 0,
  -- IFRS 15 / ASC 606: when EAC exceeds contract value the FULL expected loss
  -- is provisioned in the period the test first turns true, not amortised.
  -- F-RV-06. Blocking on G2 unless booked.
  onerous             boolean not null default false,
  expected_loss       numeric(18,4) not null default 0,
  loss_provision      numeric(18,4) not null default 0,
  -- F-RV-03: a POC reversal is a real accounting event and must be visible.
  revenue_reversal    boolean not null default false,
  currency            consulting.currency_code not null,
  -- Reads an APPROVED forecast only. FMEA F-14.
  forecast_version_id uuid references consulting.forecast_version(id) on delete restrict,
  formula_version_id  uuid not null references consulting.formula_version(id) on delete restrict,
  state               text not null default 'DRAFT'
                        check (state in ('DRAFT','POSTED','LOCKED')),
  computed_at         timestamptz not null default now(),
  unique (engagement_id, fiscal_period),
  constraint revenue_wip_xor check (wip_amount = 0 or deferred_amount = 0)
);
alter table consulting.revenue_recognition enable row level security;

-- Only an APPROVED forecast may back a revenue figure. Enforced here rather
-- than in application code, because revenue is where a stale EAC turns into a
-- restatement (FMEA F-14).
create or replace function consulting.guard_revenue_forecast_approved()
returns trigger language plpgsql as $$
declare v_state text;
begin
  if new.method = 'PERCENT_COMPLETE' then
    if new.forecast_version_id is null then
      raise exception 'percent-complete revenue requires an approved forecast_version'
        using errcode = '23514', hint = 'FMEA F-14';
    end if;
    select state into v_state from consulting.forecast_version where id = new.forecast_version_id;
    if v_state not in ('APPROVED','SUPERSEDED') then
      raise exception 'forecast_version is %, not APPROVED; revenue may not be recognised from it',
        coalesce(v_state,'missing') using errcode = '23514', hint = 'FMEA F-14';
    end if;
  end if;

  if new.onerous and new.expected_loss <= 0 then
    raise exception 'an onerous contract must carry a positive expected_loss'
      using errcode = '23514';
  end if;
  return new;
end $$;

create trigger guard_revenue_forecast_approved
  before insert or update on consulting.revenue_recognition
  for each row execute function consulting.guard_revenue_forecast_approved();

create table consulting.milestone_invoice (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references consulting.firm(id) on delete cascade,
  engagement_id    uuid not null references consulting.engagement(id) on delete cascade,
  wbs_node_id      uuid references consulting.wbs_node(id) on delete set null,
  code             text not null,
  amount           numeric(18,4) not null check (amount > 0),
  currency         consulting.currency_code not null,
  due_condition    text not null,
  -- THE coupling from DR-03: a milestone is not billable, and not revenue,
  -- until its gate instance has passed. FK added in 0009 once gate_instance
  -- exists; the column is declared here so the shape is visible in one place.
  gate_instance_id uuid,
  state            text not null default 'PENDING'
                     check (state in ('PENDING','RELEASABLE','INVOICED','PAID','CANCELLED')),
  invoiced_at      timestamptz,
  paid_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid, updated_by uuid,
  unique (engagement_id, code)
);
alter table consulting.milestone_invoice enable row level security;

create table consulting.capacity_snapshot (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references consulting.firm(id) on delete cascade,
  user_id            uuid references consulting.app_user(id) on delete cascade,
  role_def_id        uuid references consulting.role_def(id) on delete cascade,
  skill_id           uuid references consulting.skill(id) on delete cascade,
  fiscal_period      text not null,
  period_start       date not null,
  period_end         date not null,
  available_hours    numeric(12,2) not null default 0,
  committed_hours    numeric(12,2) not null default 0,
  utilization_pct    numeric(12,6),
  -- Supply/Demand/Slack for the role-level bottleneck view (F-CP-07), which is
  -- what gets shown to anyone without firm-scope access -- person-level rows
  -- would leak staffing across the conflict barrier (FMEA F-11).
  supply_hours       numeric(12,2),
  demand_hours       numeric(12,2),
  slack_hours        numeric(12,2),
  horizon            text not null default 'CURRENT' check (horizon in ('CURRENT','FORECAST')),
  formula_version_id uuid not null references consulting.formula_version(id) on delete restrict,
  computed_at        timestamptz not null default now(),
  constraint capacity_snapshot_subject check (
    (user_id is not null)::int + (role_def_id is not null)::int + (skill_id is not null)::int >= 1
  )
);
alter table consulting.capacity_snapshot enable row level security;
create index capacity_snapshot_user_idx
  on consulting.capacity_snapshot (user_id, fiscal_period) where user_id is not null;
create index capacity_snapshot_role_idx
  on consulting.capacity_snapshot (role_def_id, fiscal_period) where role_def_id is not null;

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

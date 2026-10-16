-- ============================================================================
-- 0009 — Gate instances, signoffs, waivers and advance_phase()
--
-- The hard gate. Everything in docs/consulting/00-DECISION-RECORD.md §3 that
-- the brief called a "state machine where a project cannot progress without a
-- validated digital sign-off from designated role IDs" is enforced here, in the
-- database, where the application cannot talk its way around it.
--
--   I-1  only advance_phase() writes project.current_phase_id   (0006 trigger)
--   I-2  it refuses unless the governing gate instance is PASSED
--   I-3  a signature is valid only if the signer held the required role, in
--        scope, AT THE MOMENT OF SIGNING
--   I-4  segregation of duties: the signer may not be an author of what is
--        being approved
--   I-5  four-eyes: two distinct humans, and delegation does not count as two
--   I-6  a waiver needs strictly higher authority, domain-scoped
-- ============================================================================

-- How fresh a criterion evaluation must be for an advance to honour it. The
-- point of a hard gate is defeated if a criterion that passed last week, and
-- has since gone red, still lets the project through.
alter table consulting.gate_def
  add column staleness_minutes integer not null default 1440;

create table consulting.gate_instance (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references consulting.firm(id) on delete cascade,
  project_id      uuid not null references consulting.project(id) on delete cascade,
  gate_def_id     uuid not null references consulting.gate_def(id) on delete restrict,
  gate_def_version integer not null,
  cycle           integer not null default 1,
  state           text not null default 'NOT_STARTED'
                    check (state in ('NOT_STARTED','IN_REVIEW','RETURNED',
                                     'PASSED','WAIVED_PASS','REJECTED')),
  opened_at       timestamptz,
  opened_by       uuid references consulting.app_user(id) on delete restrict,
  decided_at      timestamptz,
  decided_by      uuid references consulting.app_user(id) on delete restrict,
  return_reason   text,
  -- The primary artefact under review, for the segregation-of-duties check:
  -- the baseline at G1, the test plan at G3, the handover package at G4.
  subject_table   text,
  subject_id      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid, updated_by uuid,
  unique (project_id, gate_def_id, cycle)
);
alter table consulting.gate_instance enable row level security;
create index gate_instance_project_idx on consulting.gate_instance (project_id, state);

-- The DR-03 coupling, now that gate_instance exists: a milestone is not
-- billable, and not revenue, until its gate has passed.
alter table consulting.milestone_invoice
  add constraint milestone_invoice_gate_fk
  foreign key (gate_instance_id) references consulting.gate_instance(id) on delete restrict;

alter table consulting.baseline
  add constraint baseline_gate_fk
  foreign key (gate_instance_id) references consulting.gate_instance(id) on delete set null;

create or replace function consulting.guard_milestone_release()
returns trigger language plpgsql as $$
declare v_state text;
begin
  if new.state in ('RELEASABLE','INVOICED','PAID') then
    if new.gate_instance_id is null then
      raise exception 'a milestone may not be released without a gate instance'
        using errcode = '23514', hint = 'DR-03 / F-RV-04: governance gates revenue';
    end if;
    select state into v_state from consulting.gate_instance where id = new.gate_instance_id;
    if v_state not in ('PASSED','WAIVED_PASS') then
      raise exception 'milestone gate is %, not passed; the milestone is not revenue yet',
        coalesce(v_state,'missing') using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create trigger guard_milestone_release
  before insert or update on consulting.milestone_invoice
  for each row execute function consulting.guard_milestone_release();

create table consulting.gate_criterion_result (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references consulting.firm(id) on delete cascade,
  gate_instance_id   uuid not null references consulting.gate_instance(id) on delete cascade,
  criterion_id       uuid not null references consulting.gate_criterion(id) on delete restrict,
  evaluated_value    numeric(18,6),
  evaluated_text     text,
  threshold_value    numeric(18,6),
  passed             boolean not null,
  evaluated_at       timestamptz not null default now(),
  -- NOT NULL for FORMULA criteria, enforced by trigger: a gate decision must
  -- be reproducible from the formula version that produced the number.
  formula_version_id uuid references consulting.formula_version(id) on delete restrict,
  evidence_url       text,
  detail_json        jsonb,
  unique (gate_instance_id, criterion_id)
);
alter table consulting.gate_criterion_result enable row level security;

create or replace function consulting.guard_criterion_result_provenance()
returns trigger language plpgsql as $$
declare v_type text; v_evidence boolean;
begin
  select criterion_type, evidence_required into v_type, v_evidence
    from consulting.gate_criterion where id = new.criterion_id;

  if v_type = 'FORMULA' and new.formula_version_id is null then
    raise exception 'a FORMULA criterion result requires a formula_version_id'
      using errcode = '23514', hint = 'Invariant I-7';
  end if;

  if v_evidence and new.passed and coalesce(btrim(new.evidence_url), '') = '' then
    raise exception 'criterion requires evidence to be recorded as passed'
      using errcode = '23514';
  end if;
  return new;
end $$;

create trigger guard_criterion_result_provenance
  before insert or update on consulting.gate_criterion_result
  for each row execute function consulting.guard_criterion_result_provenance();

-- ============================================================================
-- Signoffs — I-3, I-4, I-5
-- ============================================================================

create table consulting.signoff (
  id                   uuid primary key default gen_random_uuid(),
  firm_id              uuid not null references consulting.firm(id) on delete cascade,
  gate_instance_id     uuid not null references consulting.gate_instance(id) on delete cascade,
  criterion_id         uuid not null references consulting.gate_criterion(id) on delete restrict,
  required_role_id     uuid not null references consulting.role_def(id) on delete restrict,
  signer_user_id       uuid not null references consulting.app_user(id) on delete restrict,
  -- Pins WHICH GRANT authorised this signature. Invariant I-3 is checked
  -- against this row's validity window, not against the signer's roles today.
  signer_role_grant_id uuid not null references consulting.user_role(id) on delete restrict,
  decision             text not null check (decision in ('APPROVE','REJECT','ABSTAIN')),
  signed_at            timestamptz not null default now(),
  comment              text,
  signature_hash       bytea not null,
  ip                   inet,
  user_agent           text,
  delegated_from       uuid references consulting.user_role(id) on delete restrict,
  -- Exposes rubber-stamping (F-GV-02). Reported, never blocked: a block would
  -- only teach people to wait 61 seconds.
  latency_seconds      integer,
  created_at           timestamptz not null default now(),
  unique (gate_instance_id, criterion_id, signer_user_id)
);
alter table consulting.signoff enable row level security;
create index signoff_gate_idx on consulting.signoff (gate_instance_id);
create index signoff_signer_idx on consulting.signoff (signer_user_id, signed_at desc);

-- Was this user an author of the artefact under review? Read from the ledger,
-- which is the only tamper-evident record of who created what.
create or replace function consulting.is_artefact_author(
  p_user_id uuid, p_table text, p_record_id uuid
) returns boolean
language sql stable security definer
set search_path = consulting, public, pg_temp
as $$
  select exists (
    select 1 from consulting.audit_ledger
     where table_name = p_table
       and record_id  = p_record_id
       and actor_user_id = p_user_id
       and action in ('CREATE','UPDATE','SUBMIT')
  );
$$;

create or replace function consulting.guard_signoff()
returns trigger
language plpgsql
as $$
declare
  g            record;
  c            record;
  gr           record;
  v_project    uuid;
  v_engagement uuid;
  v_client     uuid;
  v_scope_ok   boolean;
begin
  select gi.*, gd.four_eyes, gd.phase_from_id
    into g
    from consulting.gate_instance gi
    join consulting.gate_def gd on gd.id = gi.gate_def_id
   where gi.id = new.gate_instance_id;

  if g.id is null then
    raise exception 'gate_instance % not found', new.gate_instance_id;
  end if;

  if g.state not in ('IN_REVIEW','RETURNED') then
    raise exception 'gate instance is %; signatures are accepted only while IN_REVIEW',
      g.state using errcode = '42501';
  end if;

  select * into c from consulting.gate_criterion where id = new.criterion_id;
  if c.gate_def_id <> g.gate_def_id then
    raise exception 'criterion does not belong to this gate';
  end if;
  if c.criterion_type <> 'SIGNOFF' then
    raise exception 'criterion % is not a SIGNOFF criterion', c.code using errcode = '23514';
  end if;
  if c.required_role_id <> new.required_role_id then
    raise exception 'required_role_id does not match the criterion';
  end if;

  -- ---------------------------------------------------------------- I-3
  select ur.* into gr from consulting.user_role ur where ur.id = new.signer_role_grant_id;
  if gr.id is null then
    raise exception 'signer_role_grant_id % not found', new.signer_role_grant_id;
  end if;
  if gr.user_id <> new.signer_user_id then
    raise exception 'the cited role grant does not belong to the signer'
      using errcode = '42501', hint = 'Invariant I-3';
  end if;
  if gr.role_def_id <> new.required_role_id then
    raise exception 'the cited role grant is not the role this criterion requires'
      using errcode = '42501', hint = 'Invariant I-3';
  end if;
  -- The window is checked against signed_at, not now(). A grant that has since
  -- expired still validates a signature made while it was live, and a grant
  -- created after the fact does not.
  if new.signed_at < gr.valid_from
     or (gr.valid_to is not null and new.signed_at >= gr.valid_to)
     or (gr.delegation_expires_at is not null and new.signed_at >= gr.delegation_expires_at) then
    raise exception
      'the cited role grant was not live at signing time (signed % , grant % .. %)',
      new.signed_at, gr.valid_from, coalesce(gr.valid_to::text, 'open')
      using errcode = '42501', hint = 'Invariant I-3';
  end if;

  -- scope must actually cover this project
  select p.id, p.engagement_id, e.client_id
    into v_project, v_engagement, v_client
    from consulting.project p
    join consulting.engagement e on e.id = p.engagement_id
   where p.id = g.project_id;

  v_scope_ok := case gr.scope_kind
                  when 'FIRM'       then true
                  when 'CLIENT'     then gr.scope_id = v_client
                  when 'ENGAGEMENT' then gr.scope_id = v_engagement
                  when 'PROJECT'    then gr.scope_id = v_project
                end;
  if not coalesce(v_scope_ok, false) then
    raise exception 'the cited role grant is scoped to % %, which does not cover this project',
      gr.scope_kind, gr.scope_id using errcode = '42501', hint = 'Invariant I-3';
  end if;

  -- ---------------------------------------------------------------- I-4
  if new.decision = 'APPROVE' then
    if new.signer_user_id = g.opened_by then
      raise exception 'the person who opened this gate may not sign it'
        using errcode = '42501', hint = 'Invariant I-4: segregation of duties';
    end if;
    if g.subject_table is not null and g.subject_id is not null
       and consulting.is_artefact_author(new.signer_user_id, g.subject_table, g.subject_id) then
      raise exception 'the signer authored the artefact under review (%:%)',
        g.subject_table, g.subject_id
        using errcode = '42501', hint = 'Invariant I-4: segregation of duties';
    end if;
  end if;

  -- ---------------------------------------------------------------- I-5 (part)
  -- One person must not satisfy four-eyes by signing through their own
  -- delegate. The full count is checked at advance time; this blocks the
  -- specific loophole at insert.
  if g.four_eyes and new.delegated_from is not null then
    if exists (
      select 1
        from consulting.signoff s
        join consulting.user_role parent on parent.id = new.delegated_from
       where s.gate_instance_id = new.gate_instance_id
         and s.signer_user_id = parent.user_id
    ) then
      raise exception
        'the delegating principal has already signed this gate; a delegate does not add a second pair of eyes'
        using errcode = '42501', hint = 'Invariant I-5 / FMEA F-18';
    end if;
  end if;

  -- F-GV-02 telemetry
  new.latency_seconds := greatest(0,
    extract(epoch from (new.signed_at - coalesce(g.opened_at, new.signed_at)))::integer);

  return new;
end $$;

create trigger guard_signoff
  before insert or update on consulting.signoff
  for each row execute function consulting.guard_signoff();

-- ============================================================================
-- Waivers — I-6
-- ============================================================================

create table consulting.gate_waiver (
  id                   uuid primary key default gen_random_uuid(),
  firm_id              uuid not null references consulting.firm(id) on delete cascade,
  gate_instance_id     uuid not null references consulting.gate_instance(id) on delete cascade,
  criterion_id         uuid not null references consulting.gate_criterion(id) on delete restrict,
  waived_by            uuid not null references consulting.app_user(id) on delete restrict,
  waiver_role_id       uuid not null references consulting.role_def(id) on delete restrict,
  waiver_role_grant_id uuid not null references consulting.user_role(id) on delete restrict,
  justification        text not null,
  compensating_control text,
  valid_until          timestamptz,
  created_at           timestamptz not null default now(),
  unique (gate_instance_id, criterion_id)
);
alter table consulting.gate_waiver enable row level security;

create or replace function consulting.guard_gate_waiver()
returns trigger language plpgsql as $$
declare
  c            record;
  v_waiver_rank smallint;
  v_req_rank    smallint;
  v_can_waive   boolean;
  v_domain_ok   boolean;
  gr            record;
begin
  select * into c from consulting.gate_criterion where id = new.criterion_id;
  if c.id is null then raise exception 'criterion not found'; end if;

  if not c.waiver_allowed then
    raise exception 'criterion % may not be waived', c.code
      using errcode = '42501';
  end if;

  select rd.authority_rank, rd.can_waive into v_waiver_rank, v_can_waive
    from consulting.role_def rd where rd.id = new.waiver_role_id;

  if not coalesce(v_can_waive, false) then
    raise exception 'this role may not waive gate criteria' using errcode = '42501';
  end if;

  -- ---------------------------------------------------------------- I-6
  -- Strictly higher authority than the role the criterion requires. Equal rank
  -- is not enough: a peer waiving a peer's criterion is not an escalation.
  v_req_rank := coalesce(consulting.authority_rank_of(c.required_role_id), 0);
  if v_waiver_rank <= v_req_rank then
    raise exception
      'waiver requires strictly higher authority than the criterion (% vs %)',
      v_waiver_rank, v_req_rank
      using errcode = '42501', hint = 'Invariant I-6';
  end if;

  -- Domain-scoped: a Finance Controller must not be able to waive a QA
  -- criterion just because can_waive is true (FMEA F-02).
  select exists (
    select 1 from consulting.role_waiver_domain d
     where d.role_def_id = new.waiver_role_id
       and d.domain in (c.domain, 'ANY')
  ) into v_domain_ok;
  if not v_domain_ok then
    raise exception 'this role may not waive % criteria', c.domain
      using errcode = '42501', hint = 'Invariant I-6, domain-scoped';
  end if;

  -- The waiver grant must itself have been live, in scope, when used.
  select * into gr from consulting.user_role where id = new.waiver_role_grant_id;
  if gr.user_id <> new.waived_by or gr.role_def_id <> new.waiver_role_id then
    raise exception 'the cited waiver grant does not match the waiver' using errcode = '42501';
  end if;
  if now() < gr.valid_from or (gr.valid_to is not null and now() >= gr.valid_to) then
    raise exception 'the cited waiver grant is not live' using errcode = '42501';
  end if;

  return new;
end $$;

create trigger guard_gate_waiver
  before insert or update on consulting.gate_waiver
  for each row execute function consulting.guard_gate_waiver();

-- ============================================================================
-- advance_phase() — the sole writer of project.current_phase_id
-- ============================================================================

create or replace function consulting.advance_phase(
  p_project_id uuid,
  p_to_phase_code text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = consulting, public, pg_temp
as $$
declare
  p           record;
  gd          record;
  gi          record;
  v_to_phase  uuid;
  v_firm      uuid;
  v_bad       record;
  v_distinct  integer;
  v_missing   integer;
  v_stale     integer;
  v_me        uuid := consulting.current_app_user_unsafe();
begin
  select pr.*, e.id as eng_id into p
    from consulting.project pr
    join consulting.engagement e on e.id = pr.engagement_id
   where pr.id = p_project_id;
  if p.id is null then
    raise exception 'project % not found', p_project_id using errcode = 'P0002';
  end if;
  v_firm := p.firm_id;

  select id into v_to_phase from consulting.phase_def
   where firm_id = v_firm and code = p_to_phase_code and is_active;
  if v_to_phase is null then
    raise exception 'no active phase % for this firm', p_to_phase_code using errcode = 'P0002';
  end if;

  -- ---- step 1: the transition must be defined. No gate_def, no transition.
  select * into gd from consulting.gate_def
   where firm_id = v_firm
     and phase_from_id = p.current_phase_id
     and phase_to_id = v_to_phase
     and is_active;
  if gd.id is null then
    raise exception 'illegal transition: no active gate governs % -> %',
      (select code from consulting.phase_def where id = p.current_phase_id), p_to_phase_code
      using errcode = '42501', hint = 'Invariant I-2';
  end if;

  -- ---- step 2: the governing gate instance must have passed
  select * into gi from consulting.gate_instance
   where project_id = p_project_id and gate_def_id = gd.id
   order by cycle desc limit 1;
  if gi.id is null then
    raise exception 'gate % has never been opened for this project', gd.code
      using errcode = '42501', hint = 'Invariant I-2';
  end if;
  if gi.state not in ('PASSED','WAIVED_PASS') then
    raise exception 'gate % is %, not passed', gd.code, gi.state
      using errcode = '42501', hint = 'Invariant I-2';
  end if;

  -- ---- step 3: re-verify every blocking criterion AT THIS MOMENT.
  -- This is the step most tools skip. They evaluate once at review time and let
  -- the pass persist, so a gate that passed last week lets a project through
  -- even though its margin criterion has since gone red.
  select count(*) into v_missing
    from consulting.gate_criterion c
   where c.gate_def_id = gd.id
     and c.is_blocking
     and c.criterion_type <> 'SIGNOFF'
     and not exists (
       select 1 from consulting.gate_criterion_result r
        where r.gate_instance_id = gi.id and r.criterion_id = c.id)
     and not exists (
       select 1 from consulting.gate_waiver w
        where w.gate_instance_id = gi.id and w.criterion_id = c.id
          and (w.valid_until is null or w.valid_until > now()));
  if v_missing > 0 then
    raise exception '% blocking criteria have never been evaluated', v_missing
      using errcode = '42501';
  end if;

  select c.code, r.passed, r.evaluated_at into v_bad
    from consulting.gate_criterion c
    join consulting.gate_criterion_result r
      on r.criterion_id = c.id and r.gate_instance_id = gi.id
   where c.gate_def_id = gd.id
     and c.is_blocking
     and not r.passed
     and not exists (
       select 1 from consulting.gate_waiver w
        where w.gate_instance_id = gi.id and w.criterion_id = c.id
          and (w.valid_until is null or w.valid_until > now()))
   limit 1;
  if v_bad.code is not null then
    raise exception 'blocking criterion % is failing; the gate has gone stale', v_bad.code
      using errcode = '42501',
            hint = 'A gate that passed earlier does not carry a project past a criterion that has since gone red.';
  end if;

  select count(*) into v_stale
    from consulting.gate_criterion c
    join consulting.gate_criterion_result r
      on r.criterion_id = c.id and r.gate_instance_id = gi.id
   where c.gate_def_id = gd.id
     and c.is_blocking
     and r.evaluated_at < now() - make_interval(mins => gd.staleness_minutes);
  if v_stale > 0 then
    raise exception
      '% blocking criteria were last evaluated more than % minutes ago; re-evaluate before advancing',
      v_stale, gd.staleness_minutes using errcode = '42501';
  end if;

  -- ---- step 4: the signoff set
  select count(*) into v_missing
    from consulting.gate_criterion c
   where c.gate_def_id = gd.id
     and c.criterion_type = 'SIGNOFF'
     and c.is_blocking
     and not exists (
       select 1 from consulting.signoff s
        where s.gate_instance_id = gi.id
          and s.criterion_id = c.id
          and s.decision = 'APPROVE')
     and not exists (
       select 1 from consulting.gate_waiver w
        where w.gate_instance_id = gi.id and w.criterion_id = c.id
          and (w.valid_until is null or w.valid_until > now()));
  if v_missing > 0 then
    raise exception '% required signoffs are missing', v_missing
      using errcode = '42501', hint = 'Invariant I-2';
  end if;

  if exists (select 1 from consulting.signoff s
              where s.gate_instance_id = gi.id and s.decision = 'REJECT') then
    raise exception 'this gate carries a REJECT signature' using errcode = '42501';
  end if;

  -- ---- step 5: four-eyes (I-5), counting humans, not signatures
  if gd.four_eyes then
    select count(distinct s.signer_user_id) into v_distinct
      from consulting.signoff s
     where s.gate_instance_id = gi.id and s.decision = 'APPROVE';
    if v_distinct < 2 then
      raise exception 'gate % requires four-eyes; only % distinct signer(s) approved',
        gd.code, v_distinct using errcode = '42501', hint = 'Invariant I-5';
    end if;
  end if;

  -- ---- step 6: write the phase, then the ledger, in one transaction
  perform set_config('consulting.phase_advance', 'on', true);
  update consulting.project
     set current_phase_id = v_to_phase,
         updated_at = now(),
         updated_by = v_me
   where id = p_project_id;
  perform set_config('consulting.phase_advance', 'off', true);

  perform consulting.ledger_write(
    v_firm, 'PHASE_ADVANCE', 'project', p_project_id,
    jsonb_build_object('phase_id', p.current_phase_id),
    jsonb_build_object('phase_id', v_to_phase, 'gate_code', gd.code,
                       'gate_instance_id', gi.id, 'gate_state', gi.state),
    coalesce(p_reason, 'advance via gate ' || gd.code));

  -- open the next gate, if the lifecycle continues
  insert into consulting.gate_instance
    (firm_id, project_id, gate_def_id, gate_def_version, cycle, state, created_by)
  select v_firm, p_project_id, ngd.id, ngd.version, 1, 'NOT_STARTED', v_me
    from consulting.gate_def ngd
   where ngd.firm_id = v_firm
     and ngd.phase_from_id = v_to_phase
     and ngd.is_active
     and not ngd.is_rework
  on conflict (project_id, gate_def_id, cycle) do nothing;

  return v_to_phase;
end $$;

revoke all on function consulting.advance_phase(uuid, text, text) from public;
grant execute on function consulting.advance_phase(uuid, text, text) to authenticated;

comment on function consulting.advance_phase(uuid, text, text) is
  'The only legal path between phases. Six-step validation: transition defined, '
  'gate passed, blocking criteria still green and fresh, signoffs present, '
  'four-eyes satisfied, then phase written and ledger appended in one transaction.';

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
-- A signature and a waiver are historical facts. Correcting one means a new
-- gate cycle, not an edit.
revoke update, delete on consulting.signoff, consulting.gate_waiver from authenticated;

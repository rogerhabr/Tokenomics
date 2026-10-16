-- ============================================================================
-- 0004 — Formula registry + hash-chained audit ledger
--
-- These two come before every delivery table because every delivery table
-- references them: metric rows carry formula_version_id (invariant I-7) and
-- every governed mutation writes a ledger row (invariant I-15).
--
-- Layer H of docs/consulting/01-DOMAIN-MODEL.md.
-- ============================================================================

-- ============================================================================
-- Formula registry — the engine behind "do not hardwire any metrics"
--
-- The tension this resolves (00-DECISION-RECORD.md §DR, FMEA F-01b): if formulae
-- are freely editable data, whoever can edit them can edit the formula that
-- decides whether their own project clears a gate. So the registry has its own
-- approval gate, versions are immutable once ACTIVE, and every computed value
-- stores the version that produced it.
-- ============================================================================

create table consulting.formula (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references consulting.firm(id) on delete cascade,
  code         text not null,
  name         text not null,
  domain       text not null
                 check (domain in ('SCORING','SCHEDULE','EVM','REVENUE',
                                   'CAPACITY','RISK','QUALITY','GOVERNANCE')),
  description  text,
  unit         text,
  output_type  text not null default 'NUMERIC'
                 check (output_type in ('NUMERIC','BOOLEAN','DATE','DURATION_DAYS','JSON')),
  -- JSON Schema for the inputs the expression expects
  input_schema jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references consulting.app_user(id),
  updated_by   uuid,
  unique (firm_id, code)
);
alter table consulting.formula enable row level security;

create table consulting.formula_version (
  id             uuid primary key default gen_random_uuid(),
  firm_id        uuid not null references consulting.firm(id) on delete cascade,
  formula_id     uuid not null references consulting.formula(id) on delete cascade,
  version        integer not null,
  -- The evaluable form. expression_src is the human-readable source; the AST is
  -- what engine/formulaEval.ts walks (whitelisted operators only -- there is no
  -- eval() anywhere in the path).
  expression_ast jsonb not null,
  expression_src text not null,
  -- {"margin_floor": 0.18, "discount_rate_annual": 0.12} -- the configurable
  -- parameters of 02-FORMULA-CATALOGUE.md, stored as data.
  input_bindings jsonb not null default '{}'::jsonb,
  state          text not null default 'DRAFT'
                   check (state in ('DRAFT','PENDING_APPROVAL','ACTIVE','SUPERSEDED','RETIRED')),
  -- Where this version came from. A shipped default was never approved by
  -- anyone at this firm, and recording a human approver for it would put a
  -- falsehood in the audit trail -- so SEEDED is its own provenance rather
  -- than a fake signature. It also makes the FMEA F-01b staleness report
  -- trivial: anything still SEEDED is running on vendor defaults that nobody
  -- here has ever looked at.
  provenance     text not null default 'HUMAN'
                   check (provenance in ('SEEDED','HUMAN','AGENT_PROPOSED')),
  content_hash   bytea not null,
  notes          text,
  created_at     timestamptz not null default now(),
  created_by     uuid references consulting.app_user(id),
  approved_by    uuid references consulting.app_user(id),
  approved_at    timestamptz,
  unique (formula_id, version),
  -- Invariant I-8 part 1: ACTIVE implies approved, unless it is a shipped
  -- default. The test-case gate is enforced by the activation function below,
  -- which is the only legal path for a HUMAN or AGENT_PROPOSED version.
  constraint formula_version_active_approved check (
    state <> 'ACTIVE'
    or provenance = 'SEEDED'
    or (approved_by is not null and approved_at is not null)
  ),
  -- FMEA F-02 / segregation of duties: an author may not approve their own
  -- formula version.
  constraint formula_version_no_self_approval check (
    approved_by is null or approved_by <> created_by
  ),
  -- A SEEDED version carries no approver at all. Without this, seeding could
  -- quietly stamp someone's name against a threshold they never saw.
  constraint formula_version_seeded_unapproved check (
    provenance <> 'SEEDED' or (approved_by is null and created_by is null)
  )
);
alter table consulting.formula_version enable row level security;
create index formula_version_active_idx
  on consulting.formula_version (formula_id, state) where state = 'ACTIVE';

-- Invariant I-8 part 2: a version cannot reach ACTIVE until every test passes.
create table consulting.formula_test_case (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references consulting.firm(id) on delete cascade,
  formula_version_id uuid not null references consulting.formula_version(id) on delete cascade,
  name               text not null,
  inputs             jsonb not null,
  expected           jsonb not null,
  tolerance          numeric(18,9) not null default 0,
  last_result        jsonb,
  last_passed        boolean,
  last_run_at        timestamptz,
  created_at         timestamptz not null default now(),
  created_by         uuid references consulting.app_user(id),
  unique (formula_version_id, name)
);
alter table consulting.formula_test_case enable row level security;

-- Which version is in force, for whom, from when. Scope- and time-effective, so
-- activating a new version never touches an existing row (FMEA F-01b).
create table consulting.formula_binding (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references consulting.firm(id) on delete cascade,
  formula_id         uuid not null references consulting.formula(id) on delete cascade,
  formula_version_id uuid not null references consulting.formula_version(id) on delete restrict,
  scope_kind         text not null
                       check (scope_kind in ('FIRM','CLIENT','ENGAGEMENT','PROJECT')),
  scope_id           uuid,
  effective_from     timestamptz not null default now(),
  effective_to       timestamptz,
  created_at         timestamptz not null default now(),
  created_by         uuid references consulting.app_user(id),
  constraint formula_binding_scope check (
    (scope_kind = 'FIRM' and scope_id is null) or
    (scope_kind <> 'FIRM' and scope_id is not null)
  ),
  constraint formula_binding_window check (effective_to is null or effective_to > effective_from)
);
alter table consulting.formula_binding enable row level security;
create index formula_binding_resolve_idx
  on consulting.formula_binding (formula_id, scope_kind, scope_id, effective_from desc);

-- The registry's own gate.
create table consulting.formula_change_request (
  id                  uuid primary key default gen_random_uuid(),
  firm_id             uuid not null references consulting.firm(id) on delete cascade,
  formula_id          uuid not null references consulting.formula(id) on delete cascade,
  proposed_version_id uuid not null references consulting.formula_version(id) on delete cascade,
  rationale           text not null,
  -- Set when the request originates from PostMortemAgent (Loop 4). Such a
  -- request must carry out-of-sample evidence, never in-sample fit (FMEA F-20).
  originating_agent_id uuid,
  evidence_json       jsonb,
  requested_by        uuid references consulting.app_user(id),
  state               text not null default 'OPEN'
                        check (state in ('OPEN','APPROVED','REJECTED','WITHDRAWN')),
  approved_by         uuid references consulting.app_user(id),
  approved_at         timestamptz,
  reject_reason       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid,
  updated_by          uuid
);
alter table consulting.formula_change_request enable row level security;

-- FMEA F-01b, the ossification half: the risk is not only that someone edits a
-- formula, it is that NOBODY EVER DOES and the shipped defaults harden into
-- de-facto hardcoded constants. This view is what the monthly PMO report reads.
create or replace view consulting.formula_staleness as
select
  fo.firm_id,
  fo.code,
  fo.name,
  fo.domain,
  fv.version,
  fv.provenance,
  fv.input_bindings,
  fv.created_at as in_force_since,
  (now() - fv.created_at) as age,
  fv.provenance = 'SEEDED' as never_reviewed_here
from consulting.formula fo
join consulting.formula_version fv on fv.formula_id = fo.id and fv.state = 'ACTIVE';

comment on view consulting.formula_staleness is
  'Which thresholds are still running on shipped defaults nobody at this firm '
  'has reviewed. FMEA F-01b mitigation 4.';

-- ---------------------------------------------------------------- immutability
-- An ACTIVE or SUPERSEDED version is history. Its expression, bindings and hash
-- are what a historical metric row resolves through, so they must never change.
create or replace function consulting.guard_formula_version_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.state in ('ACTIVE','SUPERSEDED','RETIRED') then
    if new.expression_ast is distinct from old.expression_ast
       or new.expression_src is distinct from old.expression_src
       or new.input_bindings is distinct from old.input_bindings
       or new.content_hash   is distinct from old.content_hash
       or new.version        is distinct from old.version
       or new.formula_id     is distinct from old.formula_id then
      raise exception
        'formula_version % is % and therefore immutable; create a new version',
        old.id, old.state
        using errcode = '42501', hint = 'Invariant I-7 / FMEA F-01b';
    end if;
  end if;
  return new;
end $$;

create trigger guard_formula_version_immutable
  before update on consulting.formula_version
  for each row execute function consulting.guard_formula_version_immutable();

-- ============================================================================
-- Audit ledger — append-only, hash-chained per firm
--
-- FMEA F-10: a ledger the application can rewrite proves nothing. So:
--   * prev_hash / row_hash are computed in a BEFORE INSERT trigger, never by
--     application code
--   * UPDATE and DELETE are revoked AND blocked by trigger -- grants can be
--     restored by a superuser, a trigger shows up in the schema diff
--   * the chain is per firm, serialised by an advisory lock so two concurrent
--     inserts cannot both claim the same prev_hash
-- ============================================================================

create table consulting.audit_ledger (
  seq           bigserial primary key,
  firm_id       uuid not null references consulting.firm(id) on delete restrict,
  actor_user_id uuid references consulting.app_user(id),
  -- An agent-originated change records BOTH: the accepting human is the actor,
  -- the agent is the originator (03-AGENT-ARCHITECTURE.md §4.2).
  actor_agent_id uuid,
  actor_role_id uuid references consulting.role_def(id),
  action        text not null,
  table_name    text not null,
  record_id     uuid,
  before_json   jsonb,
  after_json    jsonb,
  reason        text,
  occurred_at   timestamptz not null default now(),
  txid          bigint not null default txid_current(),
  prev_hash     bytea not null,
  row_hash      bytea not null
);
alter table consulting.audit_ledger enable row level security;
create index audit_ledger_firm_seq_idx on consulting.audit_ledger (firm_id, seq desc);
create index audit_ledger_record_idx on consulting.audit_ledger (table_name, record_id);
create index audit_ledger_actor_idx on consulting.audit_ledger (actor_user_id, occurred_at desc);

create or replace function consulting.audit_ledger_chain()
returns trigger
language plpgsql
as $$
declare
  v_prev bytea;
  v_payload text;
begin
  -- Serialise the chain per firm. Without this, two concurrent inserts both read
  -- the same tail and the chain forks -- which verification would then report as
  -- tampering. The lock is transaction-scoped and keyed on the firm, so firms
  -- never block each other.
  perform pg_advisory_xact_lock(hashtextextended(new.firm_id::text, 0));

  select row_hash into v_prev
    from consulting.audit_ledger
   where firm_id = new.firm_id
   order by seq desc
   limit 1;

  new.prev_hash := coalesce(v_prev, sha256(('genesis:' || new.firm_id::text)::bytea));

  -- seq is a sequence default, already assigned by the time a BEFORE trigger
  -- runs, so it is safe to bind into the hash.
  v_payload :=
       encode(new.prev_hash, 'hex')
    || '|' || new.seq::text
    || '|' || new.firm_id::text
    || '|' || coalesce(new.actor_user_id::text, '-')
    || '|' || coalesce(new.actor_agent_id::text, '-')
    || '|' || coalesce(new.actor_role_id::text, '-')
    || '|' || new.action
    || '|' || new.table_name
    || '|' || coalesce(new.record_id::text, '-')
    || '|' || coalesce(new.before_json::text, '-')
    || '|' || coalesce(new.after_json::text, '-')
    || '|' || coalesce(new.reason, '-')
    || '|' || to_char(new.occurred_at, 'YYYY-MM-DD"T"HH24:MI:SS.US+00');

  new.row_hash := sha256(v_payload::bytea);
  return new;
end $$;

create trigger audit_ledger_chain
  before insert on consulting.audit_ledger
  for each row execute function consulting.audit_ledger_chain();

create or replace function consulting.audit_ledger_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'consulting.audit_ledger is append-only (% blocked)', tg_op
    using errcode = '42501', hint = 'Invariant I-9 / FMEA F-10';
end $$;

create trigger audit_ledger_no_update
  before update on consulting.audit_ledger
  for each row execute function consulting.audit_ledger_append_only();

create trigger audit_ledger_no_delete
  before delete on consulting.audit_ledger
  for each row execute function consulting.audit_ledger_append_only();

-- Belt as well as braces: revoke the privileges outright. `service_role` has
-- BYPASSRLS, so policies alone would not stop it -- but a revoked privilege does.
revoke update, delete, truncate on consulting.audit_ledger from authenticated;
revoke update, delete, truncate on consulting.audit_ledger from service_role;
revoke update, delete, truncate on consulting.audit_ledger from public;
grant  select, insert on consulting.audit_ledger to authenticated, service_role;

create table consulting.ledger_checkpoint (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references consulting.firm(id) on delete cascade,
  up_to_seq   bigint not null,
  root_hash   bytea not null,
  verified_at timestamptz not null default now(),
  -- Published outside the database (a scheduled commit to this repo, in the
  -- shape of .github/workflows/refresh-data.yml) so in-database tampering is
  -- detectable rather than merely discouraged. FMEA F-10 mitigation 4.
  exported_to text,
  created_at  timestamptz not null default now(),
  unique (firm_id, up_to_seq)
);
alter table consulting.ledger_checkpoint enable row level security;

-- F-GV-04: walk the chain and report the first break, if any.
create or replace function consulting.verify_audit_chain(p_firm_id uuid)
returns table (ok boolean, checked bigint, first_bad_seq bigint, root_hash bytea)
language plpgsql
stable
security definer
set search_path = consulting, public, pg_temp
as $$
declare
  r           record;
  v_expected  bytea := sha256(('genesis:' || p_firm_id::text)::bytea);
  v_payload   text;
  v_calc      bytea;
  v_count     bigint := 0;
  v_bad       bigint := null;
  v_last      bytea := null;
begin
  for r in
    select * from consulting.audit_ledger
     where firm_id = p_firm_id order by seq asc
  loop
    v_count := v_count + 1;

    if r.prev_hash is distinct from v_expected then
      v_bad := r.seq; exit;
    end if;

    v_payload :=
         encode(r.prev_hash, 'hex')
      || '|' || r.seq::text
      || '|' || r.firm_id::text
      || '|' || coalesce(r.actor_user_id::text, '-')
      || '|' || coalesce(r.actor_agent_id::text, '-')
      || '|' || coalesce(r.actor_role_id::text, '-')
      || '|' || r.action
      || '|' || r.table_name
      || '|' || coalesce(r.record_id::text, '-')
      || '|' || coalesce(r.before_json::text, '-')
      || '|' || coalesce(r.after_json::text, '-')
      || '|' || coalesce(r.reason, '-')
      || '|' || to_char(r.occurred_at, 'YYYY-MM-DD"T"HH24:MI:SS.US+00');

    v_calc := sha256(v_payload::bytea);

    if v_calc is distinct from r.row_hash then
      v_bad := r.seq; exit;
    end if;

    v_expected := r.row_hash;
    v_last     := r.row_hash;
  end loop;

  return query select (v_bad is null), v_count, v_bad, v_last;
end $$;

-- The single helper every governed mutation calls. SECURITY DEFINER so a caller
-- needs no direct INSERT grant beyond what is given above, and so the actor is
-- always resolved from the session rather than passed in and trusted.
create or replace function consulting.ledger_write(
  p_firm_id     uuid,
  p_action      text,
  p_table_name  text,
  p_record_id   uuid,
  p_before      jsonb default null,
  p_after       jsonb default null,
  p_reason      text  default null,
  p_role_id     uuid  default null,
  p_agent_id    uuid  default null
)
returns bigint
language plpgsql
security definer
set search_path = consulting, public, pg_temp
as $$
declare v_seq bigint;
begin
  insert into consulting.audit_ledger
    (firm_id, actor_user_id, actor_agent_id, actor_role_id,
     action, table_name, record_id, before_json, after_json, reason,
     prev_hash, row_hash)
  values
    (p_firm_id, consulting.current_app_user_unsafe(), p_agent_id, p_role_id,
     p_action, p_table_name, p_record_id, p_before, p_after, p_reason,
     '\x00'::bytea, '\x00'::bytea)   -- overwritten by the chain trigger
  returning seq into v_seq;
  return v_seq;
end $$;

do $$
declare t record;
begin
  for t in
    select c.relname from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'updated_at'
     where n.nspname = 'consulting' and c.relkind = 'r'
       and not exists (
         select 1 from pg_trigger g
          where g.tgrelid = c.oid and g.tgname = 'touch_updated_at')
  loop
    execute format(
      'create trigger touch_updated_at before update on consulting.%I
         for each row execute function consulting.touch_updated_at()', t.relname);
  end loop;
end $$;

grant select, insert, update, delete on consulting.formula, consulting.formula_version,
  consulting.formula_test_case, consulting.formula_binding,
  consulting.formula_change_request, consulting.ledger_checkpoint to authenticated;
revoke update, delete on consulting.audit_ledger from authenticated;

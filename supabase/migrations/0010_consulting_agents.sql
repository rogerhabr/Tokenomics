-- ============================================================================
-- 0010 — Agent layer: definitions, authority envelopes, runs, findings,
--        proposals, clashes, foresight runs, calibration
--
-- Layer I of 01-DOMAIN-MODEL.md; behaviour in 03-AGENT-ARCHITECTURE.md.
--
-- DR-04 caps authority at L2 (propose with diff). The schema is what makes L4
-- impossible rather than merely disabled: signoff.signer_user_id references
-- app_user, agents live in agent_def, and there is no bridge between them. An
-- agent cannot hold a user_role, therefore cannot satisfy I-3, therefore cannot
-- sign. Enabling L4 would take a migration plus an app_user row -- and that row
-- creation would itself appear on the ledger as a DIRECTOR-authorised identity
-- creation. There is no quiet path to it.
-- ============================================================================

create table consulting.agent_def (
  id                    uuid primary key default gen_random_uuid(),
  firm_id               uuid not null references consulting.firm(id) on delete cascade,
  code                  text not null,
  name                  text not null,
  domain                text not null
                          check (domain in ('SCORING','SCHEDULE','EVM','REVENUE',
                                            'CAPACITY','RISK','QUALITY','GOVERNANCE','AUDIT')),
  authority_level       text not null default 'L2'
                          check (authority_level in ('L0','L1','L2','L3')),
  is_enabled            boolean not null default true,
  schedule_cron         text,
  event_subscriptions   text[] not null default '{}',
  -- FMEA F-08: the hard cap that stops the inbox becoming unreadable. An agent
  -- over budget emits only the top-N by clash priority.
  daily_proposal_budget integer not null default 10 check (daily_proposal_budget >= 0),
  propose_severity_min  text not null default 'MEDIUM'
                          check (propose_severity_min in ('INFO','LOW','MEDIUM','HIGH','CRITICAL')),
  model_hint            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid, updated_by uuid,
  unique (firm_id, code)
);
alter table consulting.agent_def enable row level security;

-- L3 is built but flag-gated off at launch. Enabling autonomous action before
-- an agent's acceptance rate is known is how a team's trust is lost in one
-- afternoon; the gate to switch it on is in 05-BUILD-STAGES.md.
create or replace function consulting.guard_agent_authority_ceiling()
returns trigger language plpgsql as $$
begin
  if new.authority_level = 'L3'
     and coalesce(current_setting('consulting.allow_l3', true), 'off') <> 'on' then
    raise exception 'L3 (autonomous action) is not enabled for this deployment'
      using errcode = '42501',
            hint = 'DR-04: the ceiling is L2. Set consulting.allow_l3 deliberately to lift it.';
  end if;
  return new;
end $$;

create trigger guard_agent_authority_ceiling
  before insert or update on consulting.agent_def
  for each row execute function consulting.guard_agent_authority_ceiling();

create table consulting.agent_authority (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references consulting.firm(id) on delete cascade,
  agent_def_id       uuid not null references consulting.agent_def(id) on delete cascade,
  action_code        text not null,
  -- e.g. {"max_hours_per_week": 8, "non_critical_path_only": true}
  max_magnitude_json jsonb,
  requires_role_id   uuid not null references consulting.role_def(id) on delete restrict,
  is_enabled         boolean not null default true,
  created_at         timestamptz not null default now(),
  unique (agent_def_id, action_code)
);
alter table consulting.agent_authority enable row level security;

create table consulting.agent_run (
  id               uuid primary key default gen_random_uuid(),
  firm_id          uuid not null references consulting.firm(id) on delete cascade,
  agent_def_id     uuid not null references consulting.agent_def(id) on delete cascade,
  trigger_kind     text not null check (trigger_kind in ('SCHEDULE','EVENT','MANUAL','BACKFILL')),
  trigger_ref      text,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  status           text not null default 'RUNNING'
                     check (status in ('RUNNING','SUCCEEDED','FAILED','SKIPPED','BUDGET_CAPPED')),
  -- The reproducibility contract (03-AGENT-ARCHITECTURE.md §6). Given the same
  -- input_hash, engine_version, formula_versions and seed, the ENGINE portion
  -- reproduces byte-identically. The LLM portion does not, and is not claimed
  -- to -- which is exactly why no number comes from it.
  input_hash       bytea,
  output_hash      bytea,
  engine_version   text,
  formula_versions jsonb,
  seed             bigint,
  tokens_in        integer,
  tokens_out       integer,
  cost             numeric(12,6),
  error            text,
  created_at       timestamptz not null default now()
);
alter table consulting.agent_run enable row level security;
create index agent_run_def_idx on consulting.agent_run (agent_def_id, started_at desc);

create table consulting.agent_finding (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references consulting.firm(id) on delete cascade,
  agent_run_id    uuid not null references consulting.agent_run(id) on delete cascade,
  engagement_id   uuid references consulting.engagement(id) on delete cascade,
  project_id      uuid references consulting.project(id) on delete cascade,
  finding_type    text not null,
  severity        text not null check (severity in ('INFO','LOW','MEDIUM','HIGH','CRITICAL')),
  subject_table   text not null,
  subject_id      uuid,
  summary         text not null,
  evidence_json   jsonb not null default '{}'::jsonb,
  confidence      numeric(5,4) check (confidence between 0 and 1),
  state           text not null default 'OPEN'
                    check (state in ('OPEN','ACK','DISMISSED','RESOLVED','SUPERSEDED')),
  -- FMEA F-08: a recurring condition increments a counter on ONE row. It never
  -- creates a second row. Without this the feed is unreadable within a week.
  dedupe_key      text not null,
  occurrence_count integer not null default 1,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  acked_by        uuid references consulting.app_user(id) on delete set null,
  acked_at        timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid, updated_by uuid
);
alter table consulting.agent_finding enable row level security;
create unique index agent_finding_dedupe
  on consulting.agent_finding (firm_id, dedupe_key) where state in ('OPEN','ACK');
create index agent_finding_eng_idx on consulting.agent_finding (engagement_id, severity, state);

create table consulting.agent_proposal (
  id                   uuid primary key default gen_random_uuid(),
  firm_id              uuid not null references consulting.firm(id) on delete cascade,
  agent_run_id         uuid not null references consulting.agent_run(id) on delete cascade,
  finding_id           uuid references consulting.agent_finding(id) on delete set null,
  engagement_id        uuid references consulting.engagement(id) on delete cascade,
  target_table         text not null,
  target_id            uuid,
  -- The literal before/after. Not prose. A proposal a human cannot read as a
  -- diff is a suggestion, and suggestions do not get accepted.
  diff_json            jsonb not null,
  rationale            text not null,
  -- Computed BY THE ENGINE after the LLM drafts the diff, never by the LLM
  -- (FMEA F-09). The model proposes what to change; the engine computes what
  -- that would do.
  expected_effect_json jsonb not null,
  requires_role_id     uuid not null references consulting.role_def(id) on delete restrict,
  severity             text not null default 'MEDIUM'
                         check (severity in ('INFO','LOW','MEDIUM','HIGH','CRITICAL')),
  priority_score       numeric(12,6),
  state                text not null default 'PROPOSED'
                         check (state in ('PROPOSED','ACCEPTED','REJECTED','EXPIRED','ESCALATED')),
  decided_by           uuid references consulting.app_user(id) on delete restrict,
  decided_at           timestamptz,
  -- A rejection without a reason teaches the agent nothing, so it is required.
  reject_reason        text,
  escalated_from       uuid references consulting.agent_proposal(id) on delete set null,
  escalation_hops      smallint not null default 0 check (escalation_hops <= 2),
  expires_at           timestamptz not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by           uuid, updated_by uuid,
  constraint agent_proposal_decided_shape check (
    state not in ('ACCEPTED','REJECTED') or (decided_by is not null and decided_at is not null)
  ),
  constraint agent_proposal_reject_reason check (
    state <> 'REJECTED' or coalesce(btrim(reject_reason), '') <> ''
  ),
  -- Every proposal must carry all five required parts (§4.2). Enforced at
  -- insert so an under-specified proposal never reaches a human's inbox.
  constraint agent_proposal_complete check (
    jsonb_typeof(diff_json) = 'object'
    and diff_json ? 'before' and diff_json ? 'after'
    and coalesce(btrim(rationale), '') <> ''
    and jsonb_typeof(expected_effect_json) = 'object'
  )
);
alter table consulting.agent_proposal enable row level security;
create index agent_proposal_inbox_idx
  on consulting.agent_proposal (requires_role_id, state, priority_score desc)
  where state = 'PROPOSED';

create table consulting.agent_calibration (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references consulting.firm(id) on delete cascade,
  agent_def_id    uuid not null references consulting.agent_def(id) on delete cascade,
  window_start    date not null,
  window_end      date not null,
  proposed        integer not null default 0,
  accepted        integer not null default 0,
  rejected        integer not null default 0,
  expired         integer not null default 0,
  acceptance_rate numeric(9,6),
  -- FMEA F-08 mitigation 5: an agent below the floor auto-demotes to L1. It
  -- must earn the right to keep proposing.
  auto_demoted    boolean not null default false,
  demoted_at      timestamptz,
  created_at      timestamptz not null default now(),
  unique (agent_def_id, window_start, window_end)
);
alter table consulting.agent_calibration enable row level security;

create table consulting.clash (
  id                      uuid primary key default gen_random_uuid(),
  firm_id                 uuid not null references consulting.firm(id) on delete cascade,
  clash_type              text not null
                            check (clash_type in ('RESOURCE_OVERALLOCATION','SKILL_CAPACITY',
                                   'SCHEDULE_CYCLE','NEGATIVE_FLOAT','DEPENDENCY_VIOLATION',
                                   'FINANCIAL_BURN','MARGIN_BREACH','GATE_DATE_BREACH',
                                   'CONFLICT_OF_INTEREST','GOVERNANCE_VIOLATION','QUALITY_RESIDUAL')),
  severity                text not null check (severity in ('INFO','LOW','MEDIUM','HIGH','CRITICAL')),
  horizon                 text not null check (horizon in ('CURRENT','FORECAST')),
  detected_at             timestamptz not null default now(),
  window_start            date,
  window_end              date,
  entities_json           jsonb not null default '{}'::jsonb,
  magnitude               numeric(18,6),
  -- Populated for FORECAST clashes from the Monte Carlo iteration set. A
  -- 90%-likely clash in two weeks outranks a 30%-likely one in five months.
  probability             numeric(9,6) check (probability between 0 and 1),
  lead_days               integer,
  priority_score          numeric(12,6),
  resolution_options_json jsonb,
  owner_role_id           uuid references consulting.role_def(id) on delete set null,
  state                   text not null default 'OPEN'
                            check (state in ('OPEN','MITIGATING','RESOLVED','ACCEPTED','STALE')),
  resolved_at             timestamptz,
  agent_run_id            uuid references consulting.agent_run(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by              uuid, updated_by uuid,
  constraint clash_forecast_has_probability check (
    horizon <> 'FORECAST' or probability is not null
  )
);
alter table consulting.clash enable row level security;
create index clash_open_idx on consulting.clash (firm_id, horizon, priority_score desc)
  where state = 'OPEN';

create table consulting.foresight_run (
  id                 uuid primary key default gen_random_uuid(),
  firm_id            uuid not null references consulting.firm(id) on delete cascade,
  agent_run_id       uuid references consulting.agent_run(id) on delete set null,
  scope_kind         text not null check (scope_kind in ('FIRM','ENGAGEMENT','PROJECT')),
  scope_id           uuid,
  as_of              date not null,
  iterations         integer not null,
  -- Stored so ANY run is exactly reproducible. This is the determinism proof
  -- for the whole agent layer.
  seed               bigint not null,
  correlation_model  text not null default 'SINGLE_FACTOR',
  rho                numeric(9,6) not null,
  p50_finish         date,
  p80_finish         date,
  p50_cost           numeric(18,4),
  p80_cost           numeric(18,4),
  p_breach           numeric(9,6),
  -- Surfaced in the UI next to the number, not buried in documentation: even
  -- with rho > 0 the P80 is a floor, not a ceiling (FMEA F-07).
  caveat             text,
  formula_version_id uuid not null references consulting.formula_version(id) on delete restrict,
  created_at         timestamptz not null default now()
);
alter table consulting.foresight_run enable row level security;
create index foresight_run_scope_idx on consulting.foresight_run (scope_kind, scope_id, as_of desc);

-- Wire up the originating_agent_id columns declared earlier, now that
-- agent_def exists. An accepted proposal records BOTH the human who accepted it
-- and the agent that originated it.
alter table consulting.opportunity_score
  add constraint opportunity_score_agent_fk
  foreign key (originating_agent_id) references consulting.agent_def(id) on delete set null;
alter table consulting.resource_estimate
  add constraint resource_estimate_agent_fk
  foreign key (originating_agent_id) references consulting.agent_def(id) on delete set null;
alter table consulting.forecast_version
  add constraint forecast_version_agent_fk
  foreign key (originating_agent_id) references consulting.agent_def(id) on delete set null;
alter table consulting.formula_change_request
  add constraint formula_change_request_agent_fk
  foreign key (originating_agent_id) references consulting.agent_def(id) on delete set null;
alter table consulting.audit_ledger
  add constraint audit_ledger_agent_fk
  foreign key (actor_agent_id) references consulting.agent_def(id) on delete set null;

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
revoke update, delete on consulting.signoff, consulting.gate_waiver from authenticated;

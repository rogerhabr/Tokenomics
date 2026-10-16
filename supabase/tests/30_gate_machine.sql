-- ============================================================================
-- PROOF 30 — The hard gate. Attempt-to-cheat suite.
--
-- Stage 3 gate condition (docs/consulting/05-BUILD-STAGES.md): every attack
-- below must be REFUSED, with the correct specific error, not a generic 500.
--
-- These run as `postgres`, a superuser, deliberately. If a superuser cannot
-- talk their way past the logic, an application user certainly cannot. The RLS
-- barrier is proved separately (proof 40), because RLS is the one thing a
-- superuser legitimately bypasses.
-- ============================================================================
\set ON_ERROR_STOP off

create or replace function test.check(p_label text, p_ok boolean)
returns void language plpgsql as $$
begin
  if p_ok then raise notice 'PROOF PASS  %', p_label;
  else         raise notice 'PROOF FAIL  %', p_label;
  end if;
end $$;

-- Returns the SQLSTATE raised, or null on success. Each call is its own
-- subtransaction so a refusal does not abort the surrounding block.
create or replace function test.raises(p_sql text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate;
end $$;

-- Returns the error MESSAGE, so a proof can assert it was refused for the
-- right reason rather than merely refused.
create or replace function test.why(p_sql text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlerrm;
end $$;

-- ============================================================================
-- Fixture
-- ============================================================================
do $$
declare
  f uuid := 'f1000000-0000-0000-0000-000000000001';
  v_client uuid; v_eng uuid; v_proj uuid; v_cal uuid; v_intake uuid;
  v_u jsonb := '{}'::jsonb;  -- role code -> app_user id
  v_g jsonb := '{}'::jsonb;  -- role code -> user_role grant id
  r record; v_id uuid; v_auth uuid; v_role uuid;
begin
  insert into consulting.firm (id, name, base_currency, fiscal_year_start_month)
  values (f, 'Northgate Advisory', 'USD', 1);
  perform consulting.seed_firm_defaults(f);

  insert into consulting.client (firm_id, code, legal_name)
  values (f, 'MERIDIAN', 'Meridian Health Group') returning id into v_client;

  insert into consulting.engagement
    (firm_id, client_id, code, name, contract_type, contract_value, currency,
     signed_at, start_date, end_date)
  values (f, v_client, 'MER-001', 'Claims Platform Modernisation',
          'FIXED_PRICE', 2400000, 'USD', now(), current_date, current_date + 330)
  returning id into v_eng;

  select id into v_cal from consulting.calendar where firm_id = f and code = 'STD';
  select id into v_intake from consulting.phase_def where firm_id = f and code = 'INTAKE';

  insert into consulting.project
    (firm_id, engagement_id, code, name, current_phase_id, calendar_id,
     planned_start, planned_finish, contract_milestone_date)
  values (f, v_eng, 'PRJ-001', 'Claims Platform', v_intake, v_cal,
          current_date, current_date + 300, current_date + 330)
  returning id into v_proj;

  -- One user per role, each with a FIRM-scope grant (ENGAGEMENT scope for the
  -- client-side roles, as a real client user would have).
  for r in
    select * from (values
      ('DIRECTOR'),('PMO_LEAD'),('FINANCE_CONTROLLER'),('ENGAGEMENT_MANAGER'),
      ('DELIVERY_LEAD'),('QA_LEAD'),('CONSULTANT'),
      ('CLIENT_SPONSOR'),('CLIENT_UAT_APPROVER')
    ) as t(code)
  loop
    v_auth := gen_random_uuid();
    insert into auth.users (id, email) values (v_auth, lower(r.code) || '@test.local');

    select id into v_role from consulting.role_def where firm_id = f and code = r.code;

    insert into consulting.app_user
      (firm_id, auth_user_id, email, display_name, party, employment_type, client_id)
    values (f, v_auth, lower(r.code) || '@test.local', r.code,
            case when r.code like 'CLIENT%' then 'CLIENT' else 'FIRM' end,
            case when r.code like 'CLIENT%' then 'CLIENT' else 'EMPLOYEE' end,
            case when r.code like 'CLIENT%' then v_client end)
    returning id into v_id;
    v_u := v_u || jsonb_build_object(r.code, v_id);

    insert into consulting.user_role
      (firm_id, user_id, role_def_id, scope_kind, scope_id, valid_from)
    values (f, v_id, v_role,
            case when r.code like 'CLIENT%' then 'ENGAGEMENT' else 'FIRM' end,
            case when r.code like 'CLIENT%' then v_eng end,
            now() - interval '30 days')
    returning id into v_id;
    v_g := v_g || jsonb_build_object(r.code, v_id);
  end loop;

  -- A second holder of PMO_LEAD. Needed because I-4 bars the PMO_LEAD user
  -- (artefact author) and the Delivery Lead (gate opener) from signing, so the
  -- gate genuinely cannot be cleared without a third person.
  select id into v_role from consulting.role_def where firm_id = f and code = 'PMO_LEAD';
  insert into consulting.user_role (firm_id, user_id, role_def_id, scope_kind, valid_from)
  values (f, (v_u->>'ENGAGEMENT_MANAGER')::uuid, v_role, 'FIRM', now() - interval '20 days');

  perform set_config('t.firm',    f::text,        false);
  perform set_config('t.client',  v_client::text, false);
  perform set_config('t.eng',     v_eng::text,    false);
  perform set_config('t.proj',    v_proj::text,   false);
  perform set_config('t.users',   v_u::text,      false);
  perform set_config('t.grants',  v_g::text,      false);
end $$;

-- ============================================================================
-- 30.1 — Phase transitions
-- ============================================================================
do $$
declare
  f uuid := current_setting('t.firm')::uuid;
  p uuid := current_setting('t.proj')::uuid;
  u jsonb := current_setting('t.users')::jsonb;
  s text; m text; v_gi uuid; v_scoping uuid;
begin
  -- A bare UPDATE bypasses every gate. I-1 / F-15.
  select id into v_scoping from consulting.phase_def where firm_id = f and code = 'SCOPING';
  m := test.why(format(
    'update consulting.project set current_phase_id = %L where id = %L', v_scoping, p));
  perform test.check('30.1a direct UPDATE of current_phase_id refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%advance_phase%');

  -- No gate instance has ever been opened.
  m := test.why(format('select consulting.advance_phase(%L, %L)', p, 'SCOPING'));
  perform test.check('30.1b advance with no gate instance refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%never been opened%');

  -- An illegal jump: INTAKE straight to QA has no gate_def.
  m := test.why(format('select consulting.advance_phase(%L, %L)', p, 'QA'));
  perform test.check('30.1c illegal transition INTAKE->QA refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%illegal transition%');

  -- Gate opened but still IN_REVIEW.
  insert into consulting.gate_instance
    (firm_id, project_id, gate_def_id, gate_def_version, state, opened_at, opened_by,
     subject_table, subject_id)
  select f, p, gd.id, gd.version, 'IN_REVIEW', now() - interval '2 hours',
         (u->>'DELIVERY_LEAD')::uuid, 'opportunity', gen_random_uuid()
    from consulting.gate_def gd where gd.firm_id = f and gd.code = 'G0'
  returning id into v_gi;
  perform set_config('t.g0', v_gi::text, false);

  m := test.why(format('select consulting.advance_phase(%L, %L)', p, 'SCOPING'));
  perform test.check('30.1d advance while gate IN_REVIEW refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%is IN_REVIEW, not passed%');
end $$;

-- ============================================================================
-- 30.2 — Signoff validity (I-3)
-- ============================================================================
do $$
declare
  f uuid := current_setting('t.firm')::uuid;
  gi uuid := current_setting('t.g0')::uuid;
  u jsonb := current_setting('t.users')::jsonb;
  g jsonb := current_setting('t.grants')::jsonb;
  v_crit uuid; v_role uuid; v_bad_grant uuid; m text;
begin
  select gc.id, gc.required_role_id into v_crit, v_role
    from consulting.gate_criterion gc
    join consulting.gate_def gd on gd.id = gc.gate_def_id
   where gd.firm_id = f and gd.code = 'G0' and gc.code = 'SIGN_PMO';

  -- a grant that expired before the signature
  insert into consulting.user_role
    (firm_id, user_id, role_def_id, scope_kind, valid_from, valid_to)
  values (f, (u->>'PMO_LEAD')::uuid, v_role, 'FIRM',
          now() - interval '60 days', now() - interval '10 days')
  returning id into v_bad_grant;

  m := test.why(format($f$insert into consulting.signoff
      (firm_id, gate_instance_id, criterion_id, required_role_id, signer_user_id,
       signer_role_grant_id, decision, signature_hash)
      values (%L,%L,%L,%L,%L,%L,'APPROVE','\x01')$f$,
      f, gi, v_crit, v_role, (u->>'PMO_LEAD')::uuid, v_bad_grant));
  perform test.check('30.2a signing on an expired grant refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%not live at signing time%');

  -- right person, wrong role's grant
  m := test.why(format($f$insert into consulting.signoff
      (firm_id, gate_instance_id, criterion_id, required_role_id, signer_user_id,
       signer_role_grant_id, decision, signature_hash)
      values (%L,%L,%L,%L,%L,%L,'APPROVE','\x01')$f$,
      f, gi, v_crit, v_role, (u->>'QA_LEAD')::uuid, (g->>'QA_LEAD')::uuid));
  perform test.check('30.2b signing a PMO criterion with a QA grant refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%not the role this criterion requires%');

  -- someone else's grant
  m := test.why(format($f$insert into consulting.signoff
      (firm_id, gate_instance_id, criterion_id, required_role_id, signer_user_id,
       signer_role_grant_id, decision, signature_hash)
      values (%L,%L,%L,%L,%L,%L,'APPROVE','\x01')$f$,
      f, gi, v_crit, v_role, (u->>'DIRECTOR')::uuid, (g->>'PMO_LEAD')::uuid));
  perform test.check('30.2c signing with another user''s grant refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%does not belong to the signer%');

  -- a grant scoped to a different engagement
  insert into consulting.user_role
    (firm_id, user_id, role_def_id, scope_kind, scope_id, valid_from)
  values (f, (u->>'PMO_LEAD')::uuid, v_role, 'ENGAGEMENT', gen_random_uuid(),
          now() - interval '10 days')
  returning id into v_bad_grant;

  m := test.why(format($f$insert into consulting.signoff
      (firm_id, gate_instance_id, criterion_id, required_role_id, signer_user_id,
       signer_role_grant_id, decision, signature_hash)
      values (%L,%L,%L,%L,%L,%L,'APPROVE','\x01')$f$,
      f, gi, v_crit, v_role, (u->>'PMO_LEAD')::uuid, v_bad_grant));
  perform test.check('30.2d signing on an out-of-scope grant refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%does not cover this project%');
end $$;

-- ============================================================================
-- 30.3 — Segregation of duties and four-eyes (I-4, I-5)
-- ============================================================================
do $$
declare
  f uuid := current_setting('t.firm')::uuid;
  gi uuid := current_setting('t.g0')::uuid;
  u jsonb := current_setting('t.users')::jsonb;
  g jsonb := current_setting('t.grants')::jsonb;
  v_crit uuid; v_role uuid; v_dl_role uuid; v_dl_grant uuid;
  v_subj uuid; m text; s text;
begin
  -- The gate was opened by DELIVERY_LEAD. Give them a PMO grant so the only
  -- thing standing between them and signing is I-4.
  select id into v_dl_role from consulting.role_def where firm_id = f and code = 'PMO_LEAD';
  insert into consulting.user_role (firm_id, user_id, role_def_id, scope_kind, valid_from)
  values (f, (u->>'DELIVERY_LEAD')::uuid, v_dl_role, 'FIRM', now() - interval '10 days')
  returning id into v_dl_grant;

  select gc.id, gc.required_role_id into v_crit, v_role
    from consulting.gate_criterion gc
    join consulting.gate_def gd on gd.id = gc.gate_def_id
   where gd.firm_id = f and gd.code = 'G0' and gc.code = 'SIGN_PMO';

  m := test.why(format($f$insert into consulting.signoff
      (firm_id, gate_instance_id, criterion_id, required_role_id, signer_user_id,
       signer_role_grant_id, decision, signature_hash)
      values (%L,%L,%L,%L,%L,%L,'APPROVE','\x01')$f$,
      f, gi, v_crit, v_role, (u->>'DELIVERY_LEAD')::uuid, v_dl_grant));
  perform test.check('30.3a the person who opened the gate may not sign it ['||coalesce(m,'ALLOWED')||']',
                     m like '%opened this gate may not sign%');

  -- Author of the artefact under review. The ledger is the record of authorship.
  select subject_id into v_subj from consulting.gate_instance where id = gi;
  perform consulting.ledger_write(f, 'CREATE', 'opportunity', v_subj, null,
                                  '{"seeded":true}'::jsonb, 'fixture');
  -- ledger_write resolves the actor from the session, which is null under psql,
  -- so insert an authored row explicitly to make the SoD check meaningful.
  insert into consulting.audit_ledger
    (firm_id, actor_user_id, action, table_name, record_id, prev_hash, row_hash)
  values (f, (u->>'PMO_LEAD')::uuid, 'CREATE', 'opportunity', v_subj, '\x00','\x00');

  m := test.why(format($f$insert into consulting.signoff
      (firm_id, gate_instance_id, criterion_id, required_role_id, signer_user_id,
       signer_role_grant_id, decision, signature_hash)
      values (%L,%L,%L,%L,%L,%L,'APPROVE','\x01')$f$,
      f, gi, v_crit, v_role, (u->>'PMO_LEAD')::uuid, (g->>'PMO_LEAD')::uuid));
  perform test.check('30.3b the author of the artefact under review may not sign it ['
                     ||coalesce(m,'ALLOWED')||']',
                     m like '%authored the artefact under review%');
exception when others then
  raise notice 'PROOF FAIL  30.3 block errored: %', sqlerrm;
end $$;

-- ============================================================================
-- 30.4 — Delegation (F-18)
-- ============================================================================
do $$
declare
  f uuid := current_setting('t.firm')::uuid;
  u jsonb := current_setting('t.users')::jsonb;
  g jsonb := current_setting('t.grants')::jsonb;
  v_role uuid; v_d1 uuid; m text;
begin
  select id into v_role from consulting.role_def where firm_id = f and code = 'DIRECTOR';

  -- A Director delegates to the Engagement Manager: legal, depth 1.
  insert into consulting.user_role
    (firm_id, user_id, role_def_id, scope_kind, valid_from,
     delegated_from, delegation_expires_at)
  values (f, (u->>'ENGAGEMENT_MANAGER')::uuid, v_role, 'FIRM', now(),
          (g->>'DIRECTOR')::uuid, now() + interval '14 days')
  returning id into v_d1;
  perform test.check('30.4a CONTROL: a depth-1 delegation is accepted', v_d1 is not null);

  -- The delegate delegates onward: depth 2.
  m := test.why(format($f$insert into consulting.user_role
      (firm_id, user_id, role_def_id, scope_kind, valid_from, delegated_from,
       delegation_expires_at)
      values (%L,%L,%L,'FIRM', now(), %L, now() + interval '7 days')$f$,
      f, (u->>'CONSULTANT')::uuid, v_role, v_d1));
  perform test.check('30.4b onward delegation (depth 2) refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%depth is capped at 1%');

  -- A role that may not delegate.
  select id into v_role from consulting.role_def where firm_id = f and code = 'QA_LEAD';
  m := test.why(format($f$insert into consulting.user_role
      (firm_id, user_id, role_def_id, scope_kind, valid_from, delegated_from,
       delegation_expires_at)
      values (%L,%L,%L,'FIRM', now(), %L, now() + interval '7 days')$f$,
      f, (u->>'CONSULTANT')::uuid, v_role, (g->>'QA_LEAD')::uuid));
  perform test.check('30.4c delegation by a non-delegating role refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%may not delegate%');

  -- A delegation with no expiry.
  select id into v_role from consulting.role_def where firm_id = f and code = 'DIRECTOR';
  m := test.why(format($f$insert into consulting.user_role
      (firm_id, user_id, role_def_id, scope_kind, valid_from, delegated_from)
      values (%L,%L,%L,'FIRM', now(), %L)$f$,
      f, (u->>'CONSULTANT')::uuid, v_role, (g->>'DIRECTOR')::uuid));
  perform test.check('30.4d delegation without an expiry refused ['||coalesce(m,'ALLOWED')||']',
                     m is not null);
end $$;

-- ============================================================================
-- 30.5 — Waivers (I-6)
-- ============================================================================
do $$
declare
  f uuid := current_setting('t.firm')::uuid;
  gi uuid := current_setting('t.g0')::uuid;
  u jsonb := current_setting('t.users')::jsonb;
  g jsonb := current_setting('t.grants')::jsonb;
  v_crit uuid; v_nonwaivable uuid; v_role uuid; m text;
begin
  -- CAPACITY_FEASIBLE is waivable and requires no role, so required rank is 0.
  select gc.id into v_crit
    from consulting.gate_criterion gc
    join consulting.gate_def gd on gd.id = gc.gate_def_id
   where gd.firm_id = f and gd.code = 'G0' and gc.code = 'CAPACITY_FEASIBLE';

  -- QA_LEAD cannot waive at all (can_waive = false).
  select id into v_role from consulting.role_def where firm_id = f and code = 'QA_LEAD';
  m := test.why(format($f$insert into consulting.gate_waiver
      (firm_id, gate_instance_id, criterion_id, waived_by, waiver_role_id,
       waiver_role_grant_id, justification)
      values (%L,%L,%L,%L,%L,%L,'because')$f$,
      f, gi, v_crit, (u->>'QA_LEAD')::uuid, v_role, (g->>'QA_LEAD')::uuid));
  perform test.check('30.5a waiver by a role without can_waive refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%may not waive gate criteria%');

  -- FINANCE_CONTROLLER can waive, but only EVM and REVENUE domains.
  -- CAPACITY_FEASIBLE is domain CAPACITY.
  select id into v_role from consulting.role_def where firm_id = f and code = 'FINANCE_CONTROLLER';
  m := test.why(format($f$insert into consulting.gate_waiver
      (firm_id, gate_instance_id, criterion_id, waived_by, waiver_role_id,
       waiver_role_grant_id, justification)
      values (%L,%L,%L,%L,%L,%L,'because')$f$,
      f, gi, v_crit, (u->>'FINANCE_CONTROLLER')::uuid, v_role,
      (g->>'FINANCE_CONTROLLER')::uuid));
  perform test.check('30.5b Finance Controller waiving a CAPACITY criterion refused ['
                     ||coalesce(m,'ALLOWED')||']',
                     m like '%may not waive CAPACITY criteria%');

  -- A non-waivable criterion, even by a Director.
  select gc.id into v_nonwaivable
    from consulting.gate_criterion gc
    join consulting.gate_def gd on gd.id = gc.gate_def_id
   where gd.firm_id = f and gd.code = 'G0' and gc.code = 'SCORE_FLOOR';
  select id into v_role from consulting.role_def where firm_id = f and code = 'DIRECTOR';
  m := test.why(format($f$insert into consulting.gate_waiver
      (firm_id, gate_instance_id, criterion_id, waived_by, waiver_role_id,
       waiver_role_grant_id, justification)
      values (%L,%L,%L,%L,%L,%L,'because')$f$,
      f, gi, v_nonwaivable, (u->>'DIRECTOR')::uuid, v_role, (g->>'DIRECTOR')::uuid));
  perform test.check('30.5c a non-waivable criterion cannot be waived even by a Director ['
                     ||coalesce(m,'ALLOWED')||']',
                     m like '%may not be waived%');

  -- CONTROL: a Director (rank 100, domain ANY) CAN waive a waivable criterion.
  m := test.why(format($f$insert into consulting.gate_waiver
      (firm_id, gate_instance_id, criterion_id, waived_by, waiver_role_id,
       waiver_role_grant_id, justification)
      values (%L,%L,%L,%L,%L,%L,'documented exception, compensating control in place')$f$,
      f, gi, v_crit, (u->>'DIRECTOR')::uuid, v_role, (g->>'DIRECTOR')::uuid));
  perform test.check('30.5d CONTROL: a Director can waive a waivable criterion ['
                     ||coalesce(m,'ok')||']', m is null);
end $$;

-- ============================================================================
-- 30.6 — Baseline immutability and scope creep (I-10, F-16)
-- ============================================================================
do $$
declare
  f uuid := current_setting('t.firm')::uuid;
  p uuid := current_setting('t.proj')::uuid;
  u jsonb := current_setting('t.users')::jsonb;
  v_b uuid; v_cr uuid; m text;
begin
  insert into consulting.baseline
    (firm_id, project_id, version, taken_by, reason, bac, currency,
     planned_finish, is_original)
  values (f, p, 1, (u->>'ENGAGEMENT_MANAGER')::uuid, 'original baseline at G1',
          1900000, 'USD', current_date + 300, true)
  returning id into v_b;
  perform test.check('30.6a CONTROL: the original baseline is created', v_b is not null);

  m := test.why(format('update consulting.baseline set bac = 2200000 where id = %L', v_b));
  perform test.check('30.6b editing a taken baseline refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%immutable%');

  m := test.why(format('update consulting.baseline set is_original = false where id = %L', v_b));
  perform test.check('30.6c clearing is_original refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%set once at creation%');

  m := test.why(format('delete from consulting.baseline where id = %L', v_b));
  perform test.check('30.6d deleting a baseline refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%may not be deleted%');

  -- A second baseline with no change request: the "re-baseline button" that
  -- makes scope creep invisible.
  m := test.why(format($f$insert into consulting.baseline
      (firm_id, project_id, version, taken_by, reason, bac, currency, is_original)
      values (%L,%L,2,%L,'quietly re-baselined',2600000,'USD',false)$f$,
      f, p, (u->>'DELIVERY_LEAD')::uuid));
  perform test.check('30.6e re-baselining without an approved change request refused ['
                     ||coalesce(m,'ALLOWED')||']',
                     m like '%requires an approved change_request%');

  -- A change request the requester approved themselves.
  m := test.why(format($f$insert into consulting.change_request
      (firm_id, project_id, code, title, rationale, delta_cost, currency,
       requested_by, state, approved_by, approved_at)
      values (%L,%L,'CR-001','Add deliverable','client asked',700000,'USD',
              %L,'APPROVED',%L, now())$f$,
      f, p, (u->>'DELIVERY_LEAD')::uuid, (u->>'DELIVERY_LEAD')::uuid));
  perform test.check('30.6f self-approved change request refused ['||coalesce(m,'ALLOWED')||']',
                     m is not null);

  -- A properly approved CR, then a legal v2 baseline.
  insert into consulting.change_request
    (firm_id, project_id, code, title, rationale, delta_cost, currency,
     requested_by, state, approved_by, approved_at)
  values (f, p, 'CR-001', 'Add deliverable', 'client asked', 700000, 'USD',
          (u->>'DELIVERY_LEAD')::uuid, 'APPROVED',
          (u->>'ENGAGEMENT_MANAGER')::uuid, now())
  returning id into v_cr;

  insert into consulting.baseline
    (firm_id, project_id, version, parent_version, taken_by, reason, bac, currency,
     change_request_id, is_original)
  values (f, p, 2, 1, (u->>'ENGAGEMENT_MANAGER')::uuid, 'CR-001 approved',
          2600000, 'USD', v_cr, false)
  returning id into v_b;
  perform test.check('30.6g CONTROL: an approved CR permits a v2 baseline', v_b is not null);

  -- A second "original".
  m := test.why(format($f$insert into consulting.baseline
      (firm_id, project_id, version, taken_by, reason, bac, currency, is_original)
      values (%L,%L,3,%L,'new original',2600000,'USD',true)$f$,
      f, p, (u->>'ENGAGEMENT_MANAGER')::uuid));
  perform test.check('30.6h a second original baseline refused ['||coalesce(m,'ALLOWED')||']',
                     m is not null);

  -- The point of all of it: creep is still measured against v1, so a project
  -- that grew from 1.9m to 2.6m reports 36.8% creep rather than "on plan".
  perform test.check('30.6i scope creep is still measured against the ORIGINAL baseline',
    (select round(((select bac from consulting.baseline where project_id = p and version = 2)
                 - (select bac from consulting.baseline where project_id = p and is_original))
                 / (select bac from consulting.baseline where project_id = p and is_original), 4)
    ) = 0.3684);
end $$;

-- ============================================================================
-- 30.7 — Progress integrity: the defence against 90% syndrome (F-05)
-- ============================================================================
do $$
declare
  f uuid := current_setting('t.firm')::uuid;
  p uuid := current_setting('t.proj')::uuid;
  u jsonb := current_setting('t.users')::jsonb;
  v_w uuid; v_a uuid; v_ws uuid; v_as uuid; m text;
begin
  insert into consulting.wbs_node
    (firm_id, project_id, code, name, node_type, scope_class)
  values (f, p, '1', 'Build claims engine', 'WORK_PACKAGE', 'BUILD')
  returning id into v_w;
  insert into consulting.activity (firm_id, project_id, wbs_node_id, duration_days,
    effort_hours, pct_complete_method)
  values (f, p, v_w, 20, 320, 'ZERO_HUNDRED') returning id into v_a;

  insert into consulting.wbs_node
    (firm_id, project_id, code, name, node_type, scope_class)
  values (f, p, '2', 'Hypercare support', 'WORK_PACKAGE', 'SUPPORT')
  returning id into v_ws;
  insert into consulting.activity (firm_id, project_id, wbs_node_id, duration_days,
    effort_hours, pct_complete_method)
  values (f, p, v_ws, 60, 240, 'LOE') returning id into v_as;

  -- 72% on a ZERO_HUNDRED package: the classic fabricated progress number.
  m := test.why(format($f$insert into consulting.progress_update
      (firm_id, project_id, activity_id, as_of, pct_complete, method, reported_by)
      values (%L,%L,%L, current_date, 0.72, 'ZERO_HUNDRED', %L)$f$,
      f, p, v_a, (u->>'CONSULTANT')::uuid));
  perform test.check('30.7a 72%% on a ZERO_HUNDRED package refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%must be 0 or 1%');

  -- Reporting a different method than the activity declares.
  m := test.why(format($f$insert into consulting.progress_update
      (firm_id, project_id, activity_id, as_of, pct_complete, method, reported_by)
      values (%L,%L,%L, current_date, 0.9, 'PHYSICAL', %L)$f$,
      f, p, v_a, (u->>'CONSULTANT')::uuid));
  perform test.check('30.7b switching method at report time refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%does not match the activity%');

  -- LOE on BUILD scope: earns value automatically, so it is whitelisted away.
  update consulting.activity set pct_complete_method = 'LOE' where id = v_a;
  m := test.why(format($f$insert into consulting.progress_update
      (firm_id, project_id, activity_id, as_of, pct_complete, method, reported_by)
      values (%L,%L,%L, current_date, 0.5, 'LOE', %L)$f$,
      f, p, v_a, (u->>'CONSULTANT')::uuid));
  perform test.check('30.7c LOE progress on BUILD scope refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%not permitted on BUILD scope%');

  -- CONTROL: LOE is fine on SUPPORT scope.
  m := test.why(format($f$insert into consulting.progress_update
      (firm_id, project_id, activity_id, as_of, pct_complete, method, reported_by)
      values (%L,%L,%L, current_date, 0.5, 'LOE', %L)$f$,
      f, p, v_as, (u->>'CONSULTANT')::uuid));
  perform test.check('30.7d CONTROL: LOE on SUPPORT scope accepted ['||coalesce(m,'ok')||']',
                     m is null);

  -- PHYSICAL without evidence.
  update consulting.activity set pct_complete_method = 'PHYSICAL' where id = v_a;
  m := test.why(format($f$insert into consulting.progress_update
      (firm_id, project_id, activity_id, as_of, pct_complete, method, reported_by)
      values (%L,%L,%L, current_date, 0.9, 'PHYSICAL', %L)$f$,
      f, p, v_a, (u->>'CONSULTANT')::uuid));
  perform test.check('30.7e PHYSICAL progress without evidence refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%requires an evidence_note%');

  -- Silent regression. Tested on the LOE/SUPPORT activity, because PHYSICAL
  -- already demands an evidence_note for every report -- so a PHYSICAL
  -- regression can never be evidence-less and the rule would never fire there.
  m := test.why(format($f$insert into consulting.progress_update
      (firm_id, project_id, activity_id, as_of, pct_complete, method, reported_by)
      values (%L,%L,%L, current_date + 7, 0.3, 'LOE', %L)$f$,
      f, p, v_as, (u->>'CONSULTANT')::uuid));
  perform test.check('30.7f silent progress regression refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%regressed%');

  -- CONTROL: the same regression WITH a note is accepted. A correction must be
  -- possible; it just has to be explained.
  m := test.why(format($f$insert into consulting.progress_update
      (firm_id, project_id, activity_id, as_of, pct_complete, method, reported_by, evidence_note)
      values (%L,%L,%L, current_date + 14, 0.3, 'LOE', %L, 'scope moved to CR-001')$f$,
      f, p, v_as, (u->>'CONSULTANT')::uuid));
  perform test.check('30.7g CONTROL: an explained regression is accepted ['||coalesce(m,'ok')||']',
                     m is null);
end $$;

-- ============================================================================
-- 30.8 — Revenue is gated by governance (DR-03, F-14, F-RV-04)
-- ============================================================================
do $$
declare
  f uuid := current_setting('t.firm')::uuid;
  e uuid := current_setting('t.eng')::uuid;
  p uuid := current_setting('t.proj')::uuid;
  gi uuid := current_setting('t.g0')::uuid;
  u jsonb := current_setting('t.users')::jsonb;
  v_fv uuid; v_fc uuid; v_mi uuid; m text;
begin
  select fv.id into v_fv from consulting.formula_version fv
    join consulting.formula fo on fo.id = fv.formula_id
   where fo.firm_id = f and fo.code = 'REVENUE_RECONCILED' limit 1;

  -- A DRAFT forecast must not back a revenue figure.
  insert into consulting.forecast_version
    (firm_id, project_id, version, as_of, method, etc_amount, eac_amount,
     currency, state, formula_version_id, created_by)
  values (f, p, 1, current_date, 'COMPOSITE', 800000, 2000000, 'USD', 'DRAFT',
          v_fv, (u->>'DELIVERY_LEAD')::uuid)
  returning id into v_fc;

  m := test.why(format($f$insert into consulting.revenue_recognition
      (firm_id, engagement_id, fiscal_period, method, poc, revenue_cum, currency,
       forecast_version_id, formula_version_id)
      values (%L,%L,'2026-01','PERCENT_COMPLETE',0.4,960000,'USD',%L,%L)$f$,
      f, e, v_fc, v_fv));
  perform test.check('30.8a revenue from a DRAFT forecast refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%not APPROVED%');

  -- Percent-complete revenue with no forecast at all.
  m := test.why(format($f$insert into consulting.revenue_recognition
      (firm_id, engagement_id, fiscal_period, method, poc, revenue_cum, currency,
       formula_version_id)
      values (%L,%L,'2026-02','PERCENT_COMPLETE',0.4,960000,'USD',%L)$f$, f, e, v_fv));
  perform test.check('30.8b percent-complete revenue with no forecast refused ['
                     ||coalesce(m,'ALLOWED')||']',
                     m like '%requires an approved forecast%');

  -- A forecast its own author approved.
  m := test.why(format($f$update consulting.forecast_version
      set state='APPROVED', approved_by=%L, approved_at=now() where id=%L$f$,
      (u->>'DELIVERY_LEAD')::uuid, v_fc));
  perform test.check('30.8c self-approved forecast refused ['||coalesce(m,'ALLOWED')||']',
                     m is not null);

  -- Properly approved, then revenue is accepted.
  update consulting.forecast_version
     set state='APPROVED', approved_by=(u->>'FINANCE_CONTROLLER')::uuid, approved_at=now()
   where id = v_fc;
  m := test.why(format($f$insert into consulting.revenue_recognition
      (firm_id, engagement_id, fiscal_period, method, poc, revenue_cum, currency,
       forecast_version_id, formula_version_id)
      values (%L,%L,'2026-03','PERCENT_COMPLETE',0.4,960000,'USD',%L,%L)$f$,
      f, e, v_fc, v_fv));
  perform test.check('30.8d CONTROL: revenue from an APPROVED forecast accepted ['
                     ||coalesce(m,'ok')||']', m is null);

  -- THE coupling: a milestone is not revenue until its gate passes.
  insert into consulting.milestone_invoice
    (firm_id, engagement_id, code, amount, currency, due_condition)
  values (f, e, 'MS-1', 600000, 'USD', 'on G3 UAT sign-off')
  returning id into v_mi;

  m := test.why(format($f$update consulting.milestone_invoice
      set state='RELEASABLE' where id=%L$f$, v_mi));
  perform test.check('30.8e releasing a milestone with no gate refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%without a gate instance%');

  m := test.why(format($f$update consulting.milestone_invoice
      set gate_instance_id=%L, state='RELEASABLE' where id=%L$f$, gi, v_mi));
  perform test.check('30.8f releasing a milestone whose gate is IN_REVIEW refused ['
                     ||coalesce(m,'ALLOWED')||']',
                     m like '%not passed%');

  -- An onerous flag with no loss.
  m := test.why(format($f$insert into consulting.revenue_recognition
      (firm_id, engagement_id, fiscal_period, method, revenue_cum, currency,
       formula_version_id, onerous, expected_loss)
      values (%L,%L,'2026-04','MILESTONE',0,'USD',%L,true,0)$f$, f, e, v_fv));
  perform test.check('30.8g onerous flag with zero expected loss refused ['
                     ||coalesce(m,'ALLOWED')||']',
                     m like '%positive expected_loss%');
end $$;

-- ============================================================================
-- 30.9 — Timesheets (F-04)
-- ============================================================================
do $$
declare
  f uuid := current_setting('t.firm')::uuid;
  p uuid := current_setting('t.proj')::uuid;
  u jsonb := current_setting('t.users')::jsonb;
  v_per uuid; v_a uuid; v_te uuid; m text;
begin
  select id into v_a from consulting.activity where project_id = p limit 1;

  insert into consulting.timesheet_period
    (firm_id, fiscal_period, period_start, period_end, state)
  values (f, '2026-01', date '2026-01-01', date '2026-01-31', 'OPEN')
  returning id into v_per;

  insert into consulting.timesheet_entry
    (firm_id, project_id, activity_id, user_id, period_id, entry_date, hours)
  values (f, p, v_a, (u->>'CONSULTANT')::uuid, v_per, date '2026-01-15', 8)
  returning id into v_te;
  perform test.check('30.9a CONTROL: hours book into an OPEN period', v_te is not null);

  -- Self-approval.
  m := test.why(format($f$update consulting.timesheet_entry
      set state='APPROVED', approved_by=%L, approved_at=now() where id=%L$f$,
      (u->>'CONSULTANT')::uuid, v_te));
  perform test.check('30.9b self-approved timesheet refused ['||coalesce(m,'ALLOWED')||']',
                     m is not null);

  -- entry_date outside its period.
  m := test.why(format($f$insert into consulting.timesheet_entry
      (firm_id, project_id, activity_id, user_id, period_id, entry_date, hours)
      values (%L,%L,%L,%L,%L, date '2026-02-10', 8)$f$,
      f, p, v_a, (u->>'CONSULTANT')::uuid, v_per));
  perform test.check('30.9c entry_date outside its period refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%outside its period%');

  -- Lock the period, then try to book into it.
  update consulting.timesheet_period
     set state='LOCKED', locked_at=now(), locked_by=(u->>'FINANCE_CONTROLLER')::uuid
   where id = v_per;
  m := test.why(format($f$insert into consulting.timesheet_entry
      (firm_id, project_id, activity_id, user_id, period_id, entry_date, hours)
      values (%L,%L,%L,%L,%L, date '2026-01-20', 8)$f$,
      f, p, v_a, (u->>'CONSULTANT')::uuid, v_per));
  perform test.check('30.9d booking into a LOCKED period refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%LOCKED%');

  -- And an edit to what is already in it.
  m := test.why(format($f$update consulting.timesheet_entry set hours=12 where id=%L$f$, v_te));
  perform test.check('30.9e editing hours in a LOCKED period refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%LOCKED%');

  -- F-04 telemetry is recorded, not inferred.
  perform test.check('30.9f lateness of entry is stored for the backdate detector',
    (select entered_days_late from consulting.timesheet_entry where id = v_te) > 0);
end $$;

-- ============================================================================
-- 30.10 — Formula registry (I-7, I-8, F-01b)
-- ============================================================================
do $$
declare
  f uuid := current_setting('t.firm')::uuid;
  u jsonb := current_setting('t.users')::jsonb;
  v_fo uuid; v_fv uuid; m text;
begin
  select id into v_fo from consulting.formula where firm_id = f and code = 'PLANNED_MARGIN';
  select id into v_fv from consulting.formula_version
   where formula_id = v_fo and version = 1;

  -- An ACTIVE version is history: a historical metric row resolves through it.
  m := test.why(format($f$update consulting.formula_version
      set input_bindings = '{"margin_floor":0.02}'::jsonb where id = %L$f$, v_fv));
  perform test.check('30.10a editing an ACTIVE formula version refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%immutable%');

  -- An author approving their own version.
  m := test.why(format($f$insert into consulting.formula_version
      (firm_id, formula_id, version, expression_ast, expression_src, state,
       content_hash, created_by, approved_by, approved_at)
      values (%L,%L,2,'{}'::jsonb,'tampered','ACTIVE','\x01',%L,%L, now())$f$,
      f, v_fo, (u->>'DELIVERY_LEAD')::uuid, (u->>'DELIVERY_LEAD')::uuid));
  perform test.check('30.10b self-approved formula version refused ['||coalesce(m,'ALLOWED')||']',
                     m is not null);

  -- ACTIVE without approval at all.
  m := test.why(format($f$insert into consulting.formula_version
      (firm_id, formula_id, version, expression_ast, expression_src, state, content_hash)
      values (%L,%L,3,'{}'::jsonb,'unapproved','ACTIVE','\x01')$f$, f, v_fo));
  perform test.check('30.10c ACTIVE without an approver refused ['||coalesce(m,'ALLOWED')||']',
                     m is not null);

  -- A FORMULA criterion result with no provenance.
  m := test.why(format($f$insert into consulting.gate_criterion_result
      (firm_id, gate_instance_id, criterion_id, evaluated_value, passed)
      select %L, %L, gc.id, 0.25, true
        from consulting.gate_criterion gc
        join consulting.gate_def gd on gd.id = gc.gate_def_id
       where gd.firm_id = %L and gd.code='G0' and gc.code='SCORE_FLOOR'$f$,
      f, current_setting('t.g0')::uuid, f));
  perform test.check('30.10d a FORMULA result without a formula_version_id refused ['
                     ||coalesce(m,'ALLOWED')||']',
                     m like '%requires a formula_version_id%');

  -- The whole point: a threshold is DATA. Changing margin_floor changes
  -- whether G1 passes, with no code change.
  perform test.check('30.10e thresholds live in the registry, not in code',
    (select input_bindings->>'margin_floor' from consulting.formula_version where id = v_fv)
      = '0.18');
end $$;

-- ============================================================================
-- 30.11 — L4 is architecturally impossible (DR-04)
-- ============================================================================
do $$
declare
  f uuid := current_setting('t.firm')::uuid;
  m text; v_agent uuid; v_cols int; v_run uuid; v_role_dl uuid;
begin
  select id into v_agent from consulting.agent_def where firm_id = f and code = 'GATEKEEPER';

  -- No foreign key from signoff to agent_def anywhere. (Asserting on column
  -- NAMES was wrong: `user_agent` matches '%agent%' and has nothing to do with
  -- agents. The property that matters is referential, not lexical.)
  select count(*) into v_cols
    from pg_constraint c
    join pg_class src on src.oid = c.conrelid
    join pg_class tgt on tgt.oid = c.confrelid
   where c.contype = 'f'
     and src.relname = 'signoff'
     and tgt.relname = 'agent_def';
  perform test.check('30.11a no foreign key from signoff to agent_def exists', v_cols = 0);

  -- An agent id is not an app_user id, so it cannot be forced into the FK.
  m := test.why(format($f$insert into consulting.signoff
      (firm_id, gate_instance_id, criterion_id, required_role_id, signer_user_id,
       signer_role_grant_id, decision, signature_hash)
      select %L, %L, gc.id, gc.required_role_id, %L,
             (select id from consulting.user_role limit 1), 'APPROVE','\x01'
        from consulting.gate_criterion gc
        join consulting.gate_def gd on gd.id = gc.gate_def_id
       where gd.firm_id=%L and gd.code='G0' and gc.code='SIGN_PMO'$f$,
      f, current_setting('t.g0')::uuid, v_agent, f));
  perform test.check('30.11b an agent id cannot be used as a signer ['||coalesce(m,'ALLOWED')||']',
                     m is not null);

  -- GateKeeper and AuditSentinel are L1 by design, not by accident.
  perform test.check('30.11c the gate-evaluating agent is capped at L1',
    (select authority_level from consulting.agent_def where firm_id=f and code='GATEKEEPER') = 'L1');

  -- L3 is built but refused unless deliberately enabled.
  m := test.why(format($f$update consulting.agent_def set authority_level='L3'
      where firm_id=%L and code='SCHEDULE'$f$, f));
  perform test.check('30.11d promoting an agent to L3 refused by default ['||coalesce(m,'ALLOWED')||']',
                     m like '%not enabled for this deployment%');

  -- A proposal missing its diff, rationale or engine-computed effect never
  -- reaches a human's inbox (03-AGENT-ARCHITECTURE.md §4.2).
  --
  -- The agent_run is created in its own statement first. An earlier version of
  -- this test tried to create it inline with `left join lateral (insert ...)`,
  -- which is not valid SQL -- so the proposal was "refused" with a syntax error
  -- and the test passed without ever exercising the constraint. Hence the
  -- explicit assertion on the message below: a refusal for the wrong reason is
  -- worse than a failure, because it reads as proof.
  insert into consulting.agent_run (firm_id, agent_def_id, trigger_kind)
  select f, id, 'MANUAL' from consulting.agent_def
   where firm_id = f and code = 'SCHEDULE'
  returning id into v_run;

  select id into v_role_dl from consulting.role_def where firm_id=f and code='DELIVERY_LEAD';

  -- no before/after in the diff
  m := test.why(format($f$insert into consulting.agent_proposal
      (firm_id, agent_run_id, target_table, diff_json, rationale,
       expected_effect_json, requires_role_id, expires_at)
      values (%L,%L,'activity','{"note":"trust me"}'::jsonb,'looks wrong',
              '{"delta_finish_days":3}'::jsonb,%L, now() + interval '72 hours')$f$,
      f, v_run, v_role_dl));
  perform test.check('30.11e a proposal whose diff has no before/after refused ['
                     ||coalesce(m,'ALLOWED')||']',
                     m like '%agent_proposal_complete%');

  -- no rationale
  m := test.why(format($f$insert into consulting.agent_proposal
      (firm_id, agent_run_id, target_table, diff_json, rationale,
       expected_effect_json, requires_role_id, expires_at)
      values (%L,%L,'activity','{"before":{"es":"2026-01-01"},"after":{"es":"2026-01-04"}}'::jsonb,
              '   ','{"delta_finish_days":3}'::jsonb,%L, now() + interval '72 hours')$f$,
      f, v_run, v_role_dl));
  perform test.check('30.11f a proposal with no rationale refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%agent_proposal_complete%');

  -- CONTROL: a complete proposal is accepted. The constraint must not be so
  -- strict that nothing legitimate gets through.
  m := test.why(format($f$insert into consulting.agent_proposal
      (firm_id, agent_run_id, target_table, diff_json, rationale,
       expected_effect_json, requires_role_id, expires_at)
      values (%L,%L,'activity','{"before":{"es":"2026-01-01"},"after":{"es":"2026-01-04"}}'::jsonb,
              'Shifting 3 days clears the W14 architect collision; 5 days of float absorb it.',
              '{"delta_finish_days":0,"delta_eac":0,"p_breach_before":0.58,"p_breach_after":0.19}'::jsonb,
              %L, now() + interval '72 hours')$f$,
      f, v_run, v_role_dl));
  perform test.check('30.11g CONTROL: a complete proposal is accepted ['||coalesce(m,'ok')||']',
                     m is null);

  -- A rejection with no reason teaches the agent nothing, so it is refused.
  m := test.why(format($f$update consulting.agent_proposal
      set state='REJECTED', decided_by=(select id from consulting.app_user
                                         where firm_id=%L and display_name='DELIVERY_LEAD'),
          decided_at=now()
      where agent_run_id=%L and state='PROPOSED'$f$, f, v_run));
  perform test.check('30.11h rejecting a proposal without a reason refused ['
                     ||coalesce(m,'ALLOWED')||']',
                     m like '%agent_proposal_reject_reason%');
end $$;

-- ============================================================================
-- 30.12 — A gate that passed does not stay passed, and the legal path works
-- ============================================================================
do $$
declare
  f  uuid := current_setting('t.firm')::uuid;
  p  uuid := current_setting('t.proj')::uuid;
  gi uuid := current_setting('t.g0')::uuid;
  u  jsonb := current_setting('t.users')::jsonb;
  g  jsonb := current_setting('t.grants')::jsonb;
  c  record; v_fv uuid; m text; v_phase text; v_next int;
begin
  select fv.id into v_fv from consulting.formula_version fv limit 1;

  -- Satisfy every blocking non-signoff criterion on G0.
  for c in
    select gc.* from consulting.gate_criterion gc
      join consulting.gate_def gd on gd.id = gc.gate_def_id
     where gd.firm_id = f and gd.code = 'G0'
       and gc.is_blocking and gc.criterion_type <> 'SIGNOFF'
  loop
    insert into consulting.gate_criterion_result
      (firm_id, gate_instance_id, criterion_id, evaluated_value, passed,
       formula_version_id, evidence_url)
    values (f, gi, c.id, 1, true,
            case when c.criterion_type = 'FORMULA' then v_fv end,
            case when c.evidence_required then 'https://evidence.local/x' end)
    on conflict (gate_instance_id, criterion_id) do update
      set passed = true, evaluated_at = now();
  end loop;

  -- Two distinct signers, neither the opener (DELIVERY_LEAD) nor the artefact
  -- author (PMO_LEAD, per 30.3b). So: DIRECTOR signs both criteria -> should
  -- fail four-eyes. Then add ENGAGEMENT_MANAGER on the PMO criterion via the
  -- delegation created in 30.4a.
  insert into consulting.signoff
    (firm_id, gate_instance_id, criterion_id, required_role_id, signer_user_id,
     signer_role_grant_id, decision, signature_hash)
  select f, gi, gc.id, gc.required_role_id, (u->>'DIRECTOR')::uuid,
         (g->>'DIRECTOR')::uuid, 'APPROVE', '\x01'
    from consulting.gate_criterion gc
    join consulting.gate_def gd on gd.id = gc.gate_def_id
   where gd.firm_id=f and gd.code='G0' and gc.code='SIGN_DIRECTOR';

  update consulting.gate_instance set state='PASSED', decided_at=now(),
         decided_by=(u->>'DIRECTOR')::uuid where id = gi;

  m := test.why(format('select consulting.advance_phase(%L,%L)', p, 'SCOPING'));
  perform test.check('30.12a advance with a missing signoff refused ['||coalesce(m,'ALLOWED')||']',
                     m like '%required signoffs are missing%');

  -- Sign the PMO criterion as the Engagement Manager, who holds their own
  -- PMO_LEAD grant. Neither the gate opener nor the artefact author can do it,
  -- so clearing this gate structurally requires a third human.
  update consulting.gate_instance set state='IN_REVIEW' where id = gi;
  insert into consulting.signoff
    (firm_id, gate_instance_id, criterion_id, required_role_id, signer_user_id,
     signer_role_grant_id, decision, signature_hash)
  select f, gi, gc.id, gc.required_role_id, (u->>'ENGAGEMENT_MANAGER')::uuid,
         (select ur.id from consulting.user_role ur
           where ur.user_id = (u->>'ENGAGEMENT_MANAGER')::uuid
             and ur.role_def_id = gc.required_role_id
             and ur.delegated_from is null
           order by ur.valid_from limit 1),
         'APPROVE', '\x02'
    from consulting.gate_criterion gc
    join consulting.gate_def gd on gd.id = gc.gate_def_id
   where gd.firm_id=f and gd.code='G0' and gc.code='SIGN_PMO';

  update consulting.gate_instance set state='PASSED', decided_at=now(),
         decided_by=(u->>'DIRECTOR')::uuid where id = gi;

  -- Now turn one criterion red AFTER the gate passed. This is the step most
  -- tools skip: they evaluate once at review time and let the pass persist.
  update consulting.gate_criterion_result r
     set passed = false
   where r.gate_instance_id = gi
     and r.criterion_id = (select gc.id from consulting.gate_criterion gc
                             join consulting.gate_def gd on gd.id=gc.gate_def_id
                            where gd.firm_id=f and gd.code='G0' and gc.code='SCORE_FLOOR');

  m := test.why(format('select consulting.advance_phase(%L,%L)', p, 'SCOPING'));
  perform test.check('30.12b a gate that has gone red since passing does not advance ['
                     ||coalesce(m,'ALLOWED')||']',
                     m like '%gone stale%');

  -- Restore it, then age every evaluation past the staleness window.
  update consulting.gate_criterion_result set passed = true where gate_instance_id = gi;
  update consulting.gate_criterion_result
     set evaluated_at = now() - interval '40 hours' where gate_instance_id = gi;

  m := test.why(format('select consulting.advance_phase(%L,%L)', p, 'SCOPING'));
  perform test.check('30.12c a stale evaluation does not advance ['||coalesce(m,'ALLOWED')||']',
                     m like '%more than % minutes ago%');

  -- Re-evaluate, then the legal path must work.
  update consulting.gate_criterion_result set evaluated_at = now() where gate_instance_id = gi;

  m := test.why(format('select consulting.advance_phase(%L,%L,%L)', p, 'SCOPING',
                       'all G0 criteria green, PMO + Director signed'));
  perform test.check('30.12d CONTROL: the legal path advances the phase ['||coalesce(m,'ok')||']',
                     m is null);

  select pd.code into v_phase from consulting.project pr
    join consulting.phase_def pd on pd.id = pr.current_phase_id where pr.id = p;
  perform test.check('30.12e the project is now in SCOPING', v_phase = 'SCOPING');

  perform test.check('30.12f the advance wrote a ledger row in the same transaction',
    exists (select 1 from consulting.audit_ledger
             where table_name='project' and record_id=p and action='PHASE_ADVANCE'));

  select count(*) into v_next from consulting.gate_instance gi2
    join consulting.gate_def gd on gd.id = gi2.gate_def_id
   where gi2.project_id = p and gd.code = 'G1';
  perform test.check('30.12g the next gate (G1) was opened automatically', v_next = 1);

  perform test.check('30.12h the ledger chain is still intact after the advance',
    (select ok from consulting.verify_audit_chain(f)));
end $$;

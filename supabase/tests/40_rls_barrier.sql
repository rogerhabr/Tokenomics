-- ============================================================================
-- PROOF 40 — Row-level security and the conflict wall
--
-- Stage 1 gate conditions (docs/consulting/05-BUILD-STAGES.md):
--   * every table has RLS enabled and at least one policy
--   * a non-member gets ZERO ROWS: direct select, barrier views, nested tables
--   * the aggregate barrier holds -- a walled user's query result does not
--     change when the walled client's data changes (FMEA F-11)
--   * nobody is exempt from the conflict wall, including a Director
--     (the user's decision, recorded as the stricter reading)
-- ============================================================================
\set ON_ERROR_STOP off

create or replace function test.check(p_label text, p_ok boolean)
returns void language plpgsql as $$
begin
  if p_ok then raise notice 'PROOF PASS  %', p_label;
  else         raise notice 'PROOF FAIL  %', p_label;
  end if;
end $$;

-- Run a scalar query as a given authenticated user, with RLS in force.
-- `set local role authenticated` makes current_user a non-owner without
-- BYPASSRLS, so policies apply exactly as they would to a cookie-bound
-- Supabase client.
create or replace function test.scalar_as(p_auth_uid uuid, p_sql text)
returns numeric language plpgsql as $$
declare v numeric;
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_auth_uid::text,''), true);
  execute 'set local role authenticated';
  execute p_sql into v;
  execute 'reset role';
  return v;
exception when others then
  execute 'reset role';
  raise notice '    (query errored as %: %)', p_auth_uid, sqlerrm;
  return -1;
end $$;

-- ============================================================================
-- Fixture: two clients inside ONE conflict group, plus one outside it.
-- ============================================================================
do $$
declare
  f uuid := 'f2000000-0000-0000-0000-000000000001';
  v_grp uuid; v_cal uuid; v_intake uuid; v_fv uuid;
  v_mer uuid; v_zen uuid; v_acm uuid;
  v_emer uuid; v_ezen uuid; v_eacm uuid;
  v_pmer uuid; v_pzen uuid; v_pacm uuid;
  v_dl uuid; v_dir uuid;
  v_auth jsonb := '{}'::jsonb; v_user jsonb := '{}'::jsonb;
  r record; a uuid; uid uuid;
begin
  insert into consulting.firm (id, name) values (f, 'Barrier Test Firm');
  perform consulting.seed_firm_defaults(f);

  select id into v_cal    from consulting.calendar   where firm_id=f and code='STD';
  select id into v_intake from consulting.phase_def  where firm_id=f and code='INTAKE';
  select id into v_dl     from consulting.role_def   where firm_id=f and code='DELIVERY_LEAD';
  select id into v_dir    from consulting.role_def   where firm_id=f and code='DIRECTOR';
  select fv.id into v_fv  from consulting.formula_version fv
    join consulting.formula fo on fo.id=fv.formula_id where fo.firm_id=f limit 1;

  insert into consulting.conflict_group (firm_id, code, name, rationale)
  values (f, 'PAYER', 'Health payer sector', 'competing payers must not share staff')
  returning id into v_grp;

  insert into consulting.client (firm_id, code, legal_name, conflict_group_id)
  values (f,'MERIDIAN','Meridian Health', v_grp) returning id into v_mer;
  insert into consulting.client (firm_id, code, legal_name, conflict_group_id)
  values (f,'ZENITH','Zenith Health', v_grp) returning id into v_zen;
  insert into consulting.client (firm_id, code, legal_name)
  values (f,'ACME','Acme Logistics') returning id into v_acm;

  insert into consulting.engagement (firm_id, client_id, code, name, contract_type,
    contract_value, currency, start_date, end_date)
  values (f,v_mer,'MER-1','Meridian claims','FIXED_PRICE',1000000,'USD',current_date,current_date+200)
  returning id into v_emer;
  insert into consulting.engagement (firm_id, client_id, code, name, contract_type,
    contract_value, currency, start_date, end_date)
  values (f,v_zen,'ZEN-1','Zenith claims','FIXED_PRICE',900000,'USD',current_date,current_date+200)
  returning id into v_ezen;
  insert into consulting.engagement (firm_id, client_id, code, name, contract_type,
    contract_value, currency, start_date, end_date)
  values (f,v_acm,'ACM-1','Acme freight','MILESTONE',500000,'USD',current_date,current_date+200)
  returning id into v_eacm;

  insert into consulting.project (firm_id, engagement_id, code, name, current_phase_id,
    calendar_id, planned_start)
  values (f,v_emer,'P-MER','Meridian build',v_intake,v_cal,current_date) returning id into v_pmer;
  insert into consulting.project (firm_id, engagement_id, code, name, current_phase_id,
    calendar_id, planned_start)
  values (f,v_ezen,'P-ZEN','Zenith build',v_intake,v_cal,current_date) returning id into v_pzen;
  insert into consulting.project (firm_id, engagement_id, code, name, current_phase_id,
    calendar_id, planned_start)
  values (f,v_eacm,'P-ACM','Acme build',v_intake,v_cal,current_date) returning id into v_pacm;

  -- a baseline + nested snapshot rows on the ZENITH project, to prove the
  -- nested tables are covered and not just their parents
  declare v_b uuid; v_w uuid; v_a uuid; v_tp uuid;
  begin
    insert into consulting.wbs_node (firm_id, project_id, code, name, node_type)
    values (f, v_pzen, '1', 'Zenith deliverable', 'DELIVERABLE') returning id into v_w;
    insert into consulting.activity (firm_id, project_id, wbs_node_id, duration_days, effort_hours)
    values (f, v_pzen, v_w, 10, 80) returning id into v_a;
    insert into consulting.baseline (firm_id, project_id, version, reason, bac, currency, is_original)
    values (f, v_pzen, 1, 'original', 800000, 'USD', true) returning id into v_b;
    insert into consulting.baseline_activity (firm_id, baseline_id, activity_id,
      duration_days, effort_hours)
    values (f, v_b, v_a, 10, 80);
    insert into consulting.baseline_scope (firm_id, baseline_id, wbs_node_id, name, scope_hash)
    values (f, v_b, v_w, 'Zenith deliverable', sha256('z'::bytea));
    -- state DRAFT, not APPROVED: test_plan_approved_shape requires an approver
    -- and a timestamp for APPROVED, and this fixture has no business inventing
    -- one. The row only needs to exist for the nested-RLS assertions.
    insert into consulting.test_plan (firm_id, project_id, version, name, scope_baseline_id, state)
    values (f, v_pzen, 1, 'Zenith UAT', v_b, 'DRAFT') returning id into v_tp;
    insert into consulting.test_case (firm_id, test_plan_id, code, wbs_node_id, title,
      expected_result, is_uat)
    values (f, v_tp, 'TC-1', v_w, 'Zenith case', 'passes', true);
    insert into consulting.evm_snapshot (firm_id, project_id, as_of, fiscal_period,
      baseline_id, currency, bac, ev, ac, cpi, margin_pct, formula_version_id)
    values (f, v_pzen, current_date, '2026-01', v_b, 'USD', 800000, 400000, 450000,
            0.8889, 0.1111, v_fv);
  end;

  -- users
  for r in select * from (values
      ('alice','MER member only'), ('bob','ZEN member only'),
      ('dora','Director + MER member'), ('eve','Director, no engagement'),
      ('frank','in firm, nothing'), ('gail','expired MER member')
    ) as t(nm, note)
  loop
    a := gen_random_uuid();
    insert into auth.users (id, email) values (a, r.nm || '@barrier.test');
    insert into consulting.app_user (firm_id, auth_user_id, email, display_name)
    values (f, a, r.nm || '@barrier.test', r.nm) returning id into uid;
    v_auth := v_auth || jsonb_build_object(r.nm, a);
    v_user := v_user || jsonb_build_object(r.nm, uid);
  end loop;

  insert into consulting.engagement_member (firm_id, engagement_id, user_id, role_def_id)
  values (f, v_emer, (v_user->>'alice')::uuid, v_dl),
         (f, v_ezen, (v_user->>'bob')::uuid,   v_dl),
         (f, v_emer, (v_user->>'dora')::uuid,  v_dl);

  -- gail's membership lapsed last month
  insert into consulting.engagement_member
    (firm_id, engagement_id, user_id, role_def_id, from_date, to_date)
  values (f, v_emer, (v_user->>'gail')::uuid, v_dl,
          current_date - 120, current_date - 30);

  insert into consulting.user_role (firm_id, user_id, role_def_id, scope_kind, valid_from)
  values (f, (v_user->>'dora')::uuid, v_dir, 'FIRM', now() - interval '1 day'),
         (f, (v_user->>'eve')::uuid,  v_dir, 'FIRM', now() - interval '1 day');

  -- capacity rows: alice and bob each committed, to prove person-level rows
  -- are not colleague-readable
  insert into consulting.capacity_snapshot (firm_id, user_id, fiscal_period,
    period_start, period_end, available_hours, committed_hours, utilization_pct,
    formula_version_id)
  values (f,(v_user->>'alice')::uuid,'2026-03',date '2026-03-01',date '2026-03-31',160,200,1.25,v_fv),
         (f,(v_user->>'bob')::uuid,  '2026-03',date '2026-03-01',date '2026-03-31',160,180,1.125,v_fv);

  perform set_config('t4.firm', f::text, false);
  perform set_config('t4.auth', v_auth::text, false);
  perform set_config('t4.user', v_user::text, false);
  perform set_config('t4.pmer', v_pmer::text, false);
  perform set_config('t4.pzen', v_pzen::text, false);
  perform set_config('t4.pacm', v_pacm::text, false);
  perform set_config('t4.ezen', v_ezen::text, false);
  perform set_config('t4.zen',  v_zen::text,  false);
  perform set_config('t4.mer',  v_mer::text,  false);
end $$;

-- ============================================================================
-- 40.1 — Meta: coverage. A table added later with no policy is a hole that no
-- table-specific test would catch.
-- ============================================================================
do $$
declare v_norls text; v_nopol text;
begin
  select string_agg(table_name, ', ') into v_norls
    from consulting.rls_coverage() where not rls_enabled;
  perform test.check('40.1a every consulting table has RLS enabled'
                     || coalesce(' [missing: '||v_norls||']',''), v_norls is null);

  select string_agg(table_name, ', ') into v_nopol
    from consulting.rls_coverage() where policy_count = 0;
  perform test.check('40.1b every consulting table has at least one policy'
                     || coalesce(' [bare: '||v_nopol||']',''), v_nopol is null);

  -- RLS with a SELECT policy but no INSERT policy is the classic half-done
  -- pass: reads are scoped and writes are not.
  perform test.check('40.1c no table has fewer than 2 policies (read + write)',
    not exists (select 1 from consulting.rls_coverage()
                 where policy_count between 1 and 1));
end $$;

-- ============================================================================
-- 40.2 — Zero rows for a non-member
-- ============================================================================
do $$
declare
  au jsonb := current_setting('t4.auth')::jsonb;
  n numeric;
begin
  n := test.scalar_as((au->>'frank')::uuid, 'select count(*) from consulting.project');
  perform test.check('40.2a a firm member with no engagement sees 0 projects ['||n||']', n = 0);

  n := test.scalar_as((au->>'frank')::uuid, 'select count(*) from consulting.engagement');
  perform test.check('40.2b ... 0 engagements ['||n||']', n = 0);

  n := test.scalar_as((au->>'frank')::uuid, 'select count(*) from consulting.client');
  perform test.check('40.2c ... 0 clients ['||n||']', n = 0);

  n := test.scalar_as((au->>'frank')::uuid, 'select count(*) from consulting.evm_snapshot');
  perform test.check('40.2d ... 0 EVM snapshots ['||n||']', n = 0);

  n := test.scalar_as((au->>'gail')::uuid, 'select count(*) from consulting.project');
  perform test.check('40.2e a LAPSED engagement member sees 0 projects ['||n||']', n = 0);

  n := test.scalar_as(null, 'select count(*) from consulting.project');
  perform test.check('40.2f an unauthenticated caller sees 0 projects ['||n||']', n = 0);
end $$;

-- ============================================================================
-- 40.3 — The conflict wall, including for a Director
-- ============================================================================
do $$
declare
  au jsonb := current_setting('t4.auth')::jsonb;
  pz uuid := current_setting('t4.pzen')::uuid;
  pm uuid := current_setting('t4.pmer')::uuid;
  pa uuid := current_setting('t4.pacm')::uuid;
  n numeric;
begin
  n := test.scalar_as((au->>'alice')::uuid,
        format('select count(*) from consulting.project where id = %L', pm));
  perform test.check('40.3a CONTROL: alice sees her own Meridian project ['||n||']', n = 1);

  n := test.scalar_as((au->>'alice')::uuid,
        format('select count(*) from consulting.project where id = %L', pz));
  perform test.check('40.3b alice cannot see the competitor''s project ['||n||']', n = 0);

  n := test.scalar_as((au->>'bob')::uuid,
        format('select count(*) from consulting.project where id = %L', pm));
  perform test.check('40.3c bob cannot see Meridian ['||n||']', n = 0);

  -- The decision under test: a Director staffed on Meridian is WALLED from
  -- Zenith, even though a firm role otherwise widens their reach.
  n := test.scalar_as((au->>'dora')::uuid,
        format('select count(*) from consulting.project where id = %L', pz));
  perform test.check('40.3d a DIRECTOR staffed on Meridian is walled from Zenith ['||n||']', n = 0);

  n := test.scalar_as((au->>'dora')::uuid,
        format('select count(*) from consulting.project where id = %L', pa));
  perform test.check('40.3e ... but still sees Acme, which is in no conflict group ['||n||']', n = 1);

  -- A Director with no engagement membership triggers no wall at all.
  -- Counted WITHOUT a firm filter on purpose. Scoping the query to this firm
  -- would have hidden the cross-tenant leak that this assertion caught: a
  -- Director's firm role satisfied the role branch for another firm's
  -- engagement. The predicate must do the tenant scoping, not the query.
  n := test.scalar_as((au->>'eve')::uuid, 'select count(*) from consulting.project');
  perform test.check('40.3f a Director with no engagement membership sees all 3 of THIS '
                     ||'firm''s projects and no other firm''s ['||n||']', n = 3);

  -- The wall is symmetric and applies to the client row itself, not just
  -- projects: otherwise the client list leaks the relationship.
  n := test.scalar_as((au->>'dora')::uuid,
        format('select count(*) from consulting.client where id = %L',
               current_setting('t4.zen')::uuid));
  perform test.check('40.3g the walled CLIENT row is invisible too ['||n||']', n = 0);
end $$;

-- ============================================================================
-- 40.4 — Nested tables: where a careless RLS pass leaves the door open
-- ============================================================================
do $$
declare
  au jsonb := current_setting('t4.auth')::jsonb;
  n numeric;
begin
  n := test.scalar_as((au->>'alice')::uuid, 'select count(*) from consulting.baseline');
  perform test.check('40.4a alice sees 0 baselines (the only one is Zenith''s) ['||n||']', n = 0);

  -- baseline_activity has no project_id of its own.
  n := test.scalar_as((au->>'alice')::uuid, 'select count(*) from consulting.baseline_activity');
  perform test.check('40.4b baseline_activity, which has no project_id, is covered ['||n||']', n = 0);

  n := test.scalar_as((au->>'alice')::uuid, 'select count(*) from consulting.baseline_scope');
  perform test.check('40.4c baseline_scope is covered ['||n||']', n = 0);

  -- test_case reaches project only via test_plan.
  n := test.scalar_as((au->>'alice')::uuid, 'select count(*) from consulting.test_case');
  perform test.check('40.4d test_case, nested two levels deep, is covered ['||n||']', n = 0);

  n := test.scalar_as((au->>'bob')::uuid, 'select count(*) from consulting.baseline_activity');
  perform test.check('40.4e CONTROL: bob DOES see his own nested rows ['||n||']', n = 1);
end $$;

-- ============================================================================
-- 40.5 — The aggregate barrier (FMEA F-11)
--
-- Row policies can be flawless while an aggregate still leaks. The test is not
-- "does the aggregate exclude the row" but "does the walled user's RESULT
-- CHANGE when the walled client's data changes". If it moves, it is an oracle.
-- ============================================================================
do $$
declare
  au jsonb := current_setting('t4.auth')::jsonb;
  pz uuid := current_setting('t4.pzen')::uuid;
  before_sum numeric; after_sum numeric;
  before_cnt numeric; after_cnt numeric;
begin
  before_sum := test.scalar_as((au->>'alice')::uuid,
    'select coalesce(sum(eac),0) from consulting.evm_snapshot');
  before_cnt := test.scalar_as((au->>'alice')::uuid,
    'select coalesce(sum(contract_value),0) from consulting.v_engagement_margin');

  -- Move the walled client's numbers substantially.
  update consulting.evm_snapshot
     set eac = 7777777, ac = 999999, margin_pct = -0.5
   where project_id = pz;

  after_sum := test.scalar_as((au->>'alice')::uuid,
    'select coalesce(sum(eac),0) from consulting.evm_snapshot');
  after_cnt := test.scalar_as((au->>'alice')::uuid,
    'select coalesce(sum(contract_value),0) from consulting.v_engagement_margin');

  perform test.check('40.5a a walled user''s EVM aggregate does not move when the '
                     ||'walled client''s data changes ['||before_sum||' -> '||after_sum||']',
                     before_sum = after_sum);
  perform test.check('40.5b the margin BARRIER VIEW does not move either ['
                     ||before_cnt||' -> '||after_cnt||']', before_cnt = after_cnt);

  -- And the data really did change, so the test above is not vacuous.
  perform test.check('40.5c (the walled data genuinely changed, so 40.5a is not vacuous)',
    (select eac from consulting.evm_snapshot where project_id = pz) = 7777777);
end $$;

-- ============================================================================
-- 40.6 — Person-level capacity is not colleague-readable
-- ============================================================================
do $$
declare
  au jsonb := current_setting('t4.auth')::jsonb;
  n numeric;
begin
  -- alice may see her own row and role-level rows, not bob's.
  n := test.scalar_as((au->>'alice')::uuid,
    'select count(*) from consulting.capacity_snapshot where user_id is not null');
  perform test.check('40.6a alice sees only her OWN person-level capacity row ['||n||']', n = 1);

  n := test.scalar_as((au->>'eve')::uuid,
    'select count(*) from consulting.capacity_snapshot where user_id is not null');
  perform test.check('40.6b a firm-role holder sees person-level capacity ['||n||']', n = 2);

  -- The "committed elsewhere" shape: the clash is visible, the source is not.
  n := test.scalar_as((au->>'alice')::uuid,
    'select coalesce(max(committed_elsewhere),0) from consulting.v_person_commitment');
  perform test.check('40.6c alice can see that she is over-committed elsewhere ['||n||']', n > 0);

  n := test.scalar_as((au->>'alice')::uuid,
    'select count(*) from consulting.v_person_commitment where user_id <> '
    ||'(select id from consulting.app_user where auth_user_id = auth.uid())');
  perform test.check('40.6d ... without any row for a colleague she does not work with ['||n||']',
                     n = 0);

  -- k-anonymity: a role cell drawn from fewer than 3 engagements is suppressed.
  n := test.scalar_as((au->>'eve')::uuid,
    'select count(*) from consulting.v_capacity_role where suppressed');
  perform test.check('40.6e thin role-capacity cells are suppressed, not shown ['||n||']', n > 0);

  n := test.scalar_as((au->>'eve')::uuid,
    'select count(*) from consulting.v_capacity_role '
    ||'where suppressed and (available_hours is not null or utilization_pct is not null)');
  perform test.check('40.6f a suppressed cell leaks no values ['||n||']', n = 0);
end $$;

-- ============================================================================
-- 40.7 — Writes are scoped too, not just reads
-- ============================================================================
do $$
declare
  au jsonb := current_setting('t4.auth')::jsonb;
  pz uuid := current_setting('t4.pzen')::uuid;
  n numeric;
begin
  -- An INSERT into a walled project must be refused by WITH CHECK, not merely
  -- invisible afterwards.
  n := test.scalar_as((au->>'alice')::uuid, format(
    $q$with ins as (
         insert into consulting.wbs_node (firm_id, project_id, code, name, node_type)
         values (%L, %L, 'X', 'injected', 'DELIVERABLE') returning 1)
       select count(*) from ins$q$,
    current_setting('t4.firm')::uuid, pz));
  perform test.check('40.7a inserting into a walled project is refused ['||n||']', n = -1);

  -- An UPDATE targeting a walled row affects nothing.
  n := test.scalar_as((au->>'alice')::uuid, format(
    $q$with upd as (
         update consulting.project set name = 'renamed' where id = %L returning 1)
       select count(*) from upd$q$, pz));
  perform test.check('40.7b updating a walled project affects 0 rows ['||n||']', n = 0);

  n := test.scalar_as((au->>'alice')::uuid, format(
    $q$with del as (delete from consulting.project where id = %L returning 1)
       select count(*) from del$q$, pz));
  perform test.check('40.7c deleting a walled project affects 0 rows ['||n||']', n = 0);

  perform test.check('40.7d the walled project still exists',
    exists (select 1 from consulting.project where id = pz and name = 'Zenith build'));
end $$;

-- ============================================================================
-- 40.8 — A waiver is the only way through the wall
-- ============================================================================
do $$
declare
  au jsonb := current_setting('t4.auth')::jsonb;
  us jsonb := current_setting('t4.user')::jsonb;
  f  uuid := current_setting('t4.firm')::uuid;
  pz uuid := current_setting('t4.pzen')::uuid;
  n numeric;
begin
  n := test.scalar_as((au->>'dora')::uuid,
        format('select count(*) from consulting.project where id = %L', pz));
  perform test.check('40.8a before the waiver, dora is walled ['||n||']', n = 0);

  insert into consulting.conflict_waiver
    (firm_id, user_id, client_a_id, client_b_id, granted_by, justification, valid_to)
  values (f, (us->>'dora')::uuid,
          current_setting('t4.zen')::uuid, current_setting('t4.mer')::uuid,
          (us->>'eve')::uuid, 'Chinese wall review completed; no overlapping scope',
          now() + interval '30 days');

  n := test.scalar_as((au->>'dora')::uuid,
        format('select count(*) from consulting.project where id = %L', pz));
  perform test.check('40.8b a live, logged waiver lifts the wall ['||n||']', n = 1);

  -- alice has no waiver, so hers must be unaffected: a waiver is per person.
  n := test.scalar_as((au->>'alice')::uuid,
        format('select count(*) from consulting.project where id = %L', pz));
  perform test.check('40.8c the waiver is per-person; alice is still walled ['||n||']', n = 0);

  -- An expired waiver stops working. Both ends move: conflict_waiver_window
  -- requires valid_to > valid_from, so backdating only the end is rejected --
  -- correctly, since a waiver that ended before it began is nonsense.
  update consulting.conflict_waiver
     set valid_from = now() - interval '10 days',
         valid_to   = now() - interval '1 day'
   where user_id = (us->>'dora')::uuid;
  n := test.scalar_as((au->>'dora')::uuid,
        format('select count(*) from consulting.project where id = %L', pz));
  perform test.check('40.8d an expired waiver no longer lifts the wall ['||n||']', n = 0);
end $$;

-- ============================================================================
-- 40.9 — The ledger is role-gated, firm-scoped, and insert-only
-- ============================================================================
do $$
declare
  au jsonb := current_setting('t4.auth')::jsonb;
  f  uuid := current_setting('t4.firm')::uuid;
  n numeric;
begin
  perform consulting.ledger_write(f, 'TEST', 'project', gen_random_uuid(),
                                  null, '{"x":1}'::jsonb, 'proof 40');

  n := test.scalar_as((au->>'alice')::uuid, 'select count(*) from consulting.audit_ledger');
  perform test.check('40.9a a delivery-role user cannot read the ledger ['||n||']', n = 0);

  n := test.scalar_as((au->>'eve')::uuid, 'select count(*) from consulting.audit_ledger');
  perform test.check('40.9b a Director can read the ledger ['||n||']', n > 0);

  -- Other firms' ledger rows stay invisible even to a Director.
  n := test.scalar_as((au->>'eve')::uuid, format(
    'select count(*) from consulting.audit_ledger where firm_id <> %L', f));
  perform test.check('40.9c another firm''s ledger rows are invisible ['||n||']', n = 0);
end $$;

-- ============================================================================
-- 40.10 — Rate cards are not colleague-readable
-- ============================================================================
do $$
declare
  au jsonb := current_setting('t4.auth')::jsonb;
  us jsonb := current_setting('t4.user')::jsonb;
  f  uuid := current_setting('t4.firm')::uuid;
  v_role uuid; n numeric;
begin
  select id into v_role from consulting.role_def where firm_id=f and code='DELIVERY_LEAD';
  insert into consulting.rate_card (firm_id, user_id, cost_rate, currency, effective_from)
  values (f, (us->>'bob')::uuid, 185.00, 'USD', current_date - 30);

  n := test.scalar_as((au->>'alice')::uuid,
    'select count(*) from consulting.rate_card where user_id is not null');
  perform test.check('40.10a a colleague''s cost rate is invisible ['||n||']', n = 0);

  n := test.scalar_as((au->>'eve')::uuid,
    'select count(*) from consulting.rate_card where user_id is not null');
  perform test.check('40.10b a Finance/Director role can read cost rates ['||n||']', n = 1);

  n := test.scalar_as((au->>'bob')::uuid,
    'select count(*) from consulting.rate_card where user_id is not null');
  perform test.check('40.10c you can read your own cost rate ['||n||']', n = 1);
end $$;

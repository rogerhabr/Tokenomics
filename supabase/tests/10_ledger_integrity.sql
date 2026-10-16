-- ============================================================================
-- PROOF 10 — Audit ledger is append-only and the hash chain detects tampering
--
-- Gate condition, Stage 1 (docs/consulting/05-BUILD-STAGES.md):
--   "Ledger is append-only (F-10): UPDATE and DELETE attempts raise, as
--    postgres AND as service_role"
--   "Hash chain computed in-DB: insert rows via raw SQL bypassing the app;
--    chain still verifies"
-- ============================================================================
\set ON_ERROR_STOP off

create or replace function test.check(p_label text, p_ok boolean)
returns void language plpgsql as $$
begin
  if p_ok then raise notice 'PROOF PASS  %', p_label;
  else         raise notice 'PROOF FAIL  %', p_label;
  end if;
end $$;

-- Did a statement raise? Returns the SQLSTATE, or null if it succeeded.
create or replace function test.raises(p_sql text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate;
end $$;

-- ---------------------------------------------------------------- fixture
do $$
declare v_firm uuid;
begin
  insert into consulting.firm (name, base_currency)
  values ('Proof Firm', 'USD') returning id into v_firm;
  perform set_config('test.firm', v_firm::text, false);

  -- written directly, with no application involved: the chain must still form
  for i in 1..25 loop
    insert into consulting.audit_ledger
      (firm_id, action, table_name, record_id, after_json, prev_hash, row_hash)
    values (v_firm, 'TEST_WRITE', 'proof', gen_random_uuid(),
            jsonb_build_object('i', i), '\x00', '\x00');
  end loop;
end $$;

-- ---------------------------------------------------------------- 10.1 chain forms
do $$
declare r record;
begin
  select * into r from consulting.verify_audit_chain(current_setting('test.firm')::uuid);
  perform test.check('10.1 chain verifies after 25 raw-SQL inserts (checked='||r.checked||')',
                     r.ok and r.checked = 25);
end $$;

-- ---------------------------------------------------------------- 10.2 genesis
do $$
declare v_prev bytea; v_expect bytea;
begin
  select prev_hash into v_prev from consulting.audit_ledger
   where firm_id = current_setting('test.firm')::uuid order by seq asc limit 1;
  v_expect := sha256(('genesis:' || current_setting('test.firm'))::bytea);
  perform test.check('10.2 first row anchors to the per-firm genesis hash', v_prev = v_expect);
end $$;

-- ---------------------------------------------------------------- 10.3 hashes not app-supplied
-- Every insert above passed '\x00' for both hashes. If the app's value had been
-- honoured the chain would be all zeroes.
do $$
declare v_zero int;
begin
  select count(*) into v_zero from consulting.audit_ledger
   where firm_id = current_setting('test.firm')::uuid
     and (row_hash = '\x00'::bytea or prev_hash = '\x00'::bytea);
  perform test.check('10.3 app-supplied hashes are overwritten by the DB trigger', v_zero = 0);
end $$;

-- ---------------------------------------------------------------- 10.4 append-only, as owner
do $$
declare s text;
begin
  s := test.raises($q$update consulting.audit_ledger set reason = 'tampered' where seq = 3$q$);
  perform test.check('10.4a UPDATE blocked as table owner (sqlstate '||coalesce(s,'NONE')||')', s = '42501');
  s := test.raises($q$delete from consulting.audit_ledger where seq = 3$q$);
  perform test.check('10.4b DELETE blocked as table owner (sqlstate '||coalesce(s,'NONE')||')', s = '42501');
end $$;

-- ---------------------------------------------------------------- 10.5 append-only, as service_role
-- service_role has BYPASSRLS, so RLS policies are irrelevant against it. Two
-- defences remain, and they are not equivalent:
--
--   * the REVOKE in 0004 -- first line, but any future
--     `grant all on all tables in schema consulting to service_role`
--     (an entirely plausible convenience) silently undoes it
--   * the trigger -- durable, and visible in a schema diff
--
-- So the proof is: revoke holds now, AND the trigger still blocks after the
-- privilege is handed back. A test that only checked the revoke would pass
-- while the system was one `grant` away from a rewritable ledger.
do $$
declare v_has boolean;
begin
  select has_table_privilege('service_role','consulting.audit_ledger','UPDATE') into v_has;
  perform test.check('10.5a service_role has no UPDATE privilege (revoke holds)', not v_has);
  select has_table_privilege('service_role','consulting.audit_ledger','DELETE') into v_has;
  perform test.check('10.5b service_role has no DELETE privilege (revoke holds)', not v_has);
  select has_table_privilege('authenticated','consulting.audit_ledger','UPDATE') into v_has;
  perform test.check('10.5c authenticated has no UPDATE privilege (revoke holds)', not v_has);
end $$;

-- Now hand the privilege back, the way a careless blanket grant would, and
-- confirm the trigger is what actually stops the write.
grant all on consulting.audit_ledger to service_role;

do $$
declare s text; v_has boolean;
begin
  select has_table_privilege('service_role','consulting.audit_ledger','UPDATE') into v_has;
  perform test.check('10.5d setup: blanket grant restored UPDATE to service_role', v_has);

  s := test.raises($q$set local role service_role$q$);
  perform test.check('10.5e setup: can assume service_role', s is null);

  s := test.raises($q$update consulting.audit_ledger set reason='svc' where seq=5$q$);
  perform test.check('10.5f UPDATE as service_role, WITH privilege, still blocked by trigger '
                     ||'(sqlstate '||coalesce(s,'NONE')||')', s = '42501');

  s := test.raises($q$delete from consulting.audit_ledger where seq=5$q$);
  perform test.check('10.5g DELETE as service_role, WITH privilege, still blocked by trigger',
                     s = '42501');
  execute 'reset role';
exception when others then
  execute 'reset role';
  raise;
end $$;

revoke update, delete, truncate on consulting.audit_ledger from service_role;

-- ---------------------------------------------------------------- 10.6 the real test
-- A revoked grant and a trigger both stop the application. Neither stops a
-- superuser who disables the trigger. The hash chain is what makes THAT
-- detectable. If this proof fails, the ledger is theatre (FMEA F-10).
do $$
declare r record; s text;
begin
  -- simulate a privileged, out-of-band tamper
  alter table consulting.audit_ledger disable trigger audit_ledger_no_update;
  update consulting.audit_ledger set reason = 'quietly altered' where seq = 12;
  alter table consulting.audit_ledger enable trigger audit_ledger_no_update;

  select * into r from consulting.verify_audit_chain(current_setting('test.firm')::uuid);
  perform test.check(
    '10.6a tamper at seq=12 is DETECTED by chain verification (first_bad='
      ||coalesce(r.first_bad_seq::text,'none')||')',
    (not r.ok) and r.first_bad_seq = 12);
  perform test.check(
    '10.6b verification stops at the break rather than reporting a clean chain',
    r.checked = 12);
end $$;

-- ---------------------------------------------------------------- 10.7 chains are per firm
do $$
declare v_firm2 uuid; r record;
begin
  insert into consulting.firm (name) values ('Second Firm') returning id into v_firm2;
  for i in 1..5 loop
    insert into consulting.audit_ledger
      (firm_id, action, table_name, record_id, prev_hash, row_hash)
    values (v_firm2, 'TEST_WRITE', 'proof', gen_random_uuid(), '\x00', '\x00');
  end loop;
  select * into r from consulting.verify_audit_chain(v_firm2);
  perform test.check('10.7 a tampered firm does not invalidate another firm''s chain',
                     r.ok and r.checked = 5);
end $$;

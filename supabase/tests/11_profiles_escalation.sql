-- ============================================================================
-- PROOF 11 — FMEA F-17: profiles.role privilege escalation is closed
--
-- The original defect, reproduced on Postgres 16 before 0002 was written:
--
--   select test.become('<any authenticated user>');
--   update public.profiles set role = 'admin' where id = auth.uid();
--   -- UPDATE 1     <- RLS permitted it
--
-- Cause: 0001's update policy supplies only USING. For UPDATE, Postgres uses
-- USING as the row check when WITH CHECK is absent, and USING pins only `id`.
-- ============================================================================
\set ON_ERROR_STOP off

create or replace function test.check(p_label text, p_ok boolean)
returns void language plpgsql as $$
begin
  if p_ok then raise notice 'PROOF PASS  %', p_label;
  else         raise notice 'PROOF FAIL  %', p_label;
  end if;
end $$;

-- Runs p_sql as the given authenticated user and reports the SQLSTATE raised,
-- or null on success. Isolated in its own function so a failed statement does
-- not abort the surrounding test block.
create or replace function test.as_user_raises(p_auth_uid uuid, p_sql text)
returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_auth_uid::text, true);
  execute 'set local role authenticated';
  begin
    execute p_sql;
    execute 'reset role';
    return null;
  exception when others then
    execute 'reset role';
    return sqlstate;
  end;
end $$;

do $$
declare
  v_attacker uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  v_other    uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  s text;
  v_role text;
begin
  insert into auth.users (id, email) values
    (v_attacker, 'attacker@example.com'),
    (v_other,    'other@example.com');

  -- 11.1 — the original exploit
  s := test.as_user_raises(v_attacker,
         $q$update public.profiles set role='admin' where id = auth.uid()$q$);
  perform test.check('11.1 direct role UPDATE is refused (sqlstate '||coalesce(s,'NONE')||')',
                     s is not null);

  -- 11.2 — the sneaky variant: hide the role write behind a legitimate one
  s := test.as_user_raises(v_attacker,
         $q$update public.profiles set display_name='x', role='admin' where id = auth.uid()$q$);
  perform test.check('11.2 role smuggled alongside a permitted column is refused',
                     s is not null);

  -- 11.3 — the permitted write must still work, or the fix is just a regression
  s := test.as_user_raises(v_attacker,
         $q$update public.profiles set display_name='Legit' where id = auth.uid()$q$);
  perform test.check('11.3 CONTROL: display_name write still succeeds', s is null);

  -- 11.4 — the privileged function refuses a non-admin caller
  s := test.as_user_raises(v_attacker,
         format($q$select public.set_profile_role(%L,'admin')$q$, v_attacker));
  perform test.check('11.4 set_profile_role() refuses a non-admin caller', s = '42501');

  -- 11.5 — cannot touch someone else's profile at all
  s := test.as_user_raises(v_attacker,
         format($q$update public.profiles set display_name='pwned' where id=%L$q$, v_other));
  perform test.check('11.5 another user''s row is invisible to the attacker''s UPDATE',
                     s is not null or not exists (
                       select 1 from public.profiles where id=v_other and display_name='pwned'));

  -- 11.6 — even an admin may not promote themselves (segregation of duties)
  perform set_config('app.profiles_privileged_write','on',true);
  update public.profiles set role='admin' where id = v_other;   -- seed an admin out of band
  perform set_config('app.profiles_privileged_write','off',true);

  s := test.as_user_raises(v_other, format($q$select public.set_profile_role(%L,'user')$q$, v_other));
  perform test.check('11.6 an admin may not change their own role', s = '42501');

  -- 11.7 — an admin CAN promote someone else: the function is usable, not just locked
  s := test.as_user_raises(v_other, format($q$select public.set_profile_role(%L,'admin')$q$, v_attacker));
  select role into v_role from public.profiles where id = v_attacker;
  perform test.check('11.7 CONTROL: an admin can promote another user', s is null and v_role='admin');

  -- 11.8 — id is immutable
  s := test.as_user_raises(v_attacker,
         format($q$update public.profiles set id=%L where id=auth.uid()$q$, gen_random_uuid()));
  perform test.check('11.8 profiles.id is immutable', s is not null);
end $$;

-- ============================================================================
-- 0002 — Close the privilege-escalation hole on public.profiles
--
-- FMEA F-17 (docs/consulting/04-FMEA.md). Reproduced against Postgres 16:
--
--   select test.become('<any authenticated user>');
--   update public.profiles set role = 'admin' where id = auth.uid();   -- UPDATE 1
--
-- Root cause: the policy created in 0001_init.sql is
--
--   create policy "Users can update their own profile"
--     on public.profiles for update using (auth.uid() = id);
--
-- For UPDATE, Postgres uses the USING expression as the row check when no
-- WITH CHECK is given. USING only pins `id`, so the new row may carry any
-- `role` value and still satisfy the policy.
--
-- Defence in depth, because a single mechanism is one `grant` away from being
-- undone:
--   1. column-level UPDATE privilege  — authenticated may only write display_name
--   2. explicit WITH CHECK on the policy
--   3. a BEFORE UPDATE trigger that rejects role/id/email changes outright
--   4. a SECURITY DEFINER function as the single legal path to a role change
-- ============================================================================

-- ---------------------------------------------------------------- 1. privileges
revoke update on public.profiles from authenticated;
grant  update (display_name) on public.profiles to authenticated;

-- ---------------------------------------------------------------- 2. policies
drop policy if exists "Users can update their own profile" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using      (auth.uid() = id)
  with check (auth.uid() = id);

-- 0001 created no INSERT or DELETE policy, which is correct: rows are created by
-- the handle_new_user() SECURITY DEFINER trigger and removed by the cascade from
-- auth.users. Stated explicitly so a future reader does not read the absence as
-- an oversight and "fix" it.
revoke insert, delete on public.profiles from authenticated;

-- ---------------------------------------------------------------- 3. trigger
create or replace function public.guard_profiles_immutable_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_privileged boolean :=
    coalesce(current_setting('app.profiles_privileged_write', true), 'off') = 'on';
begin
  if new.id is distinct from old.id then
    raise exception 'profiles.id is immutable'
      using errcode = '42501';
  end if;

  if new.role is distinct from old.role and not v_privileged then
    raise exception
      'profiles.role may only be changed via public.set_profile_role()'
      using errcode = '42501',
            hint    = 'Direct UPDATE of profiles.role is blocked (FMEA F-17).';
  end if;

  if new.email is distinct from old.email and not v_privileged then
    raise exception 'profiles.email is managed by auth.users'
      using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists guard_profiles_immutable_columns on public.profiles;
create trigger guard_profiles_immutable_columns
  before update on public.profiles
  for each row execute function public.guard_profiles_immutable_columns();

-- ---------------------------------------------------------------- 4. legal path
-- The only supported way to change a role. The caller must already hold 'admin'.
-- Bootstrapping the first admin is therefore a deliberate out-of-band act in the
-- Supabase SQL editor (as the table owner), not something a user can do to
-- themselves -- which is the whole point.
create or replace function public.set_profile_role(
  p_target_user_id uuid,
  p_role           text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_role text;
begin
  if p_role not in ('user', 'admin') then
    raise exception 'unsupported role %', p_role using errcode = '22023';
  end if;

  select role into v_caller_role
    from public.profiles
   where id = auth.uid();

  if coalesce(v_caller_role, 'user') <> 'admin' then
    raise exception 'only an admin may change a profile role'
      using errcode = '42501';
  end if;

  if p_target_user_id = auth.uid() and p_role <> v_caller_role then
    raise exception 'an admin may not change their own role'
      using errcode = '42501',
            hint    = 'Segregation of duties: ask another admin.';
  end if;

  perform set_config('app.profiles_privileged_write', 'on', true);
  update public.profiles set role = p_role where id = p_target_user_id;
  perform set_config('app.profiles_privileged_write', 'off', true);

  if not found then
    raise exception 'no profile for user %', p_target_user_id
      using errcode = 'P0002';
  end if;
end $$;

revoke all on function public.set_profile_role(uuid, text) from public;
grant execute on function public.set_profile_role(uuid, text) to authenticated;

comment on function public.set_profile_role(uuid, text) is
  'Sole legal path to change profiles.role. Admin-only, no self-promotion. FMEA F-17.';

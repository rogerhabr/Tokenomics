-- ============================================================================
-- LOCAL TEST SHIM — emulates the parts of Supabase the migrations depend on.
--
-- This file is NEVER applied to a real Supabase project; Supabase provides all
-- of it natively. It exists so `scripts/db-test.sh` can execute the real
-- migrations against a throwaway Postgres 16 cluster and run the acceptance
-- proofs in docs/consulting/05-BUILD-STAGES.md.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- roles
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin nologin noinherit;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase's bootstrap grants table/sequence/function privileges on `public` to
-- anon, authenticated and service_role by default, for every object created
-- afterwards. Reproducing that here is what makes the REVOKE statements in
-- 0002_fix_profiles_role_escalation.sql load-bearing instead of no-ops: without
-- these defaults the test would "pass" because the privilege was never there.
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- ---------------------------------------------------------------- auth schema
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- auth.uid() reads the JWT claim. Locally we drive it with a GUC so a test can
-- impersonate a user: select set_config('request.jwt.claim.sub', <uuid>, false);
create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated');
$$;

-- ---------------------------------------------------------------- test helper
-- Become a given app user in the `authenticated` role, the way a cookie-bound
-- Supabase client does. Used throughout the negative-RLS suite.
create schema if not exists test;

create or replace function test.become(p_auth_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_auth_user_id::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  execute 'set role authenticated';
end $$;

create or replace function test.become_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', 'anon', false);
  execute 'set role anon';
end $$;

create or replace function test.reset()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;

grant usage on schema test to anon, authenticated, service_role;
grant execute on all functions in schema test to anon, authenticated, service_role;

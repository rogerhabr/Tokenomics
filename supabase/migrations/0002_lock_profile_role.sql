-- Run once in the Supabase SQL Editor after 0001_init.sql.
--
-- 0001's update policy ("auth.uid() = id") has no column restriction, so any
-- signed-in user could set their own `role` straight from the browser with the
-- public anon key. `role` now gates licensed data (Ornn compute prices), so
-- users may update only display_name; role changes go through the SQL Editor
-- (service role), e.g.:
--   update public.profiles set role = 'owner' where email = 'you@example.com';

revoke update on public.profiles from authenticated, anon;
grant update (display_name) on public.profiles to authenticated;

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Certificate storage for the lot register, and the admin's ability to retire
-- a lot row.
--
-- Run in the Supabase SQL Editor (or via `supabase db push`) AFTER 0004_lots.sql.
--
-- 0004 gave `lots` a `coa_path` column and a comment promising the file would
-- be "served through a first-party route". This migration creates the bucket
-- that column points into, and the access rules that make the promise true.

-- ---------------------------------------------------------------------------
-- The bucket
--
-- PRIVATE. A public bucket would serve any object to anyone holding the path,
-- which would leak the certificate of a lot that has not been published yet —
-- including a rejection still under investigation. Publication is an explicit
-- decision on the `lots` row and the certificate must inherit it.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Read: exactly as public as the lot it belongs to
--
-- This policy joins back to `lots`, so the certificate becomes readable at the
-- moment the lot is published and stops being readable if it is unpublished.
-- There is no second switch to forget: the row's `published` flag is the only
-- control, which is the whole point.
-- ---------------------------------------------------------------------------
create policy "Published lot certificates are readable"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'certificates'
    and exists (
      select 1 from public.lots
      where lots.coa_path = storage.objects.name
        and lots.published = true
    )
  );

-- Admins may read every certificate, published or not — that is how a record
-- gets checked before it is published.
create policy "Admins can read all certificates"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'certificates'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Writes are admin-only, matching every other write path in this schema.
create policy "Admins can upload certificates"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'certificates'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can replace certificates"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'certificates'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can delete certificates"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'certificates'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- Deleting a lot
--
-- 0004 granted admins select, insert and update but not delete, so a row
-- entered in error could only ever be unpublished, never removed. Correcting a
-- typo in a lot code before publication should not leave a permanent ghost in
-- the register.
--
-- Note this is a genuine delete, not a soft one: a lot that was ever published
-- should be unpublished rather than deleted, so that a buyer holding a vial can
-- still be told what happened to its record.
-- ---------------------------------------------------------------------------
create policy "Admins can delete lots"
  on public.lots for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

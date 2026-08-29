-- Vial sizes and prices, moved out of source and into the database so an
-- administrator can change them without a deploy.
--
-- Run in the Supabase SQL Editor (or via `supabase db push`) AFTER 0001–0004.
--
-- WHY THE PRIMARY KEY IS THE VARIANT ID, NOT A UUID
-- The variant id is already the public identifier: it is what a visitor's
-- saved order holds in localStorage, and what /api/orders re-prices against.
-- Seeding these rows with the ids the site already uses means every cart saved
-- before this migration keeps resolving. Note the ids are not uniformly
-- `<slug>-<size>` — the blend uses `dual-pathway-15mg` — so they are carried
-- across verbatim rather than derived.
--
-- `size_mg` is the TOTAL milligrams in the item, so a 10 x 5 mg kit is 50. It
-- exists to sort the dropdown and to derive $/mg, and is nullable for any
-- future item whose mass is not a single number.
--
-- Prices remain integer cents. Never store money as a float.

create table if not exists public.product_variants (
  id text primary key,
  product_slug text not null,
  label text not null,
  size_mg numeric(8, 2),
  price_cents integer not null check (price_cents >= 0),

  -- Retiring a size keeps its row, so historical order_items still resolve to
  -- a label. Deleting would orphan them.
  active boolean not null default true,
  sort_order integer not null default 0,

  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create index if not exists product_variants_slug_idx
  on public.product_variants (product_slug, sort_order);

alter table public.product_variants enable row level security;

-- Anyone may read the active price list: it is a public shop front.
create policy "Anyone can read active variants"
  on public.product_variants for select
  to anon, authenticated
  using (active = true);

-- Admins see everything, including retired sizes.
create policy "Admins can read all variants"
  on public.product_variants for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Only an admin can change a price. This is the security boundary for the
-- whole pricing feature: the admin API runs through the session-bound client,
-- so a non-admin session simply writes nothing.
create policy "Admins can insert variants"
  on public.product_variants for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can update variants"
  on public.product_variants for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can delete variants"
  on public.product_variants for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Seed from the catalogue as it stands in src/lib/products.ts. These prices are
-- the placeholder figures that file documents as invented — they are carried
-- over so the shop is not empty on the day of the migration, and they are the
-- first thing an administrator should replace at /admin/pricing.
insert into public.product_variants
  (id, product_slug, label, size_mg, price_cents, sort_order)
values
  ('tirzepatide-10mg', 'tirzepatide', '10 mg vial', 10, 8900, 0),
  ('tirzepatide-30mg', 'tirzepatide', '30 mg vial', 30, 21900, 1),
  ('tirzepatide-60mg', 'tirzepatide', '60 mg vial', 60, 38900, 2),
  ('retatrutide-5mg', 'retatrutide', '5 mg vial', 5, 9900, 0),
  ('retatrutide-10mg', 'retatrutide', '10 mg vial', 10, 17900, 1),
  ('retatrutide-20mg', 'retatrutide', '20 mg vial', 20, 32900, 2),
  ('cagrilintide-5mg', 'cagrilintide', '5 mg vial', 5, 10900, 0),
  ('cagrilintide-10mg', 'cagrilintide', '10 mg vial', 10, 19900, 1),
  ('semax-10mg', 'semax', '10 mg vial', 10, 4900, 0),
  ('semax-30mg', 'semax', '30 mg vial', 30, 11900, 1),
  ('selank-10mg', 'selank', '10 mg vial', 10, 4900, 0),
  ('selank-30mg', 'selank', '30 mg vial', 30, 11900, 1),
  ('bpc-157-5mg', 'bpc-157', '5 mg vial', 5, 3900, 0),
  ('bpc-157-10mg', 'bpc-157', '10 mg vial', 10, 6900, 1),
  ('bpc-157-10x5mg', 'bpc-157', '10 x 5 mg kit', 50, 32900, 2),
  ('tb-500-5mg', 'tb-500', '5 mg vial', 5, 5900, 0),
  ('tb-500-10mg', 'tb-500', '10 mg vial', 10, 9900, 1),
  ('tesamorelin-5mg', 'tesamorelin', '5 mg vial', 5, 7900, 0),
  ('tesamorelin-10mg', 'tesamorelin', '10 mg vial', 10, 13900, 1),
  ('ipamorelin-5mg', 'ipamorelin', '5 mg vial', 5, 3900, 0),
  ('ipamorelin-10mg', 'ipamorelin', '10 mg vial', 10, 6900, 1),
  ('dual-pathway-15mg', 'dual-pathway-research-blend', '15 mg vial', 15, 15900, 0),
  ('dual-pathway-10x15mg', 'dual-pathway-research-blend', '10 x 15 mg kit', 150, 139900, 1),
  ('pt-141-10mg', 'pt-141', '10 mg vial', 10, 5900, 0),
  ('pt-141-30mg', 'pt-141', '30 mg vial', 30, 14900, 1),
  ('oxytocin-2mg', 'oxytocin', '2 mg vial', 2, 3900, 0),
  ('oxytocin-10mg', 'oxytocin', '10 mg vial', 10, 9900, 1),
  ('kisspeptin-10-5mg', 'kisspeptin-10', '5 mg vial', 5, 5900, 0),
  ('kisspeptin-10-10mg', 'kisspeptin-10', '10 mg vial', 10, 9900, 1),
  ('ghk-cu-50mg', 'ghk-cu', '50 mg vial', 50, 4900, 0),
  ('ghk-cu-100mg', 'ghk-cu', '100 mg vial', 100, 8900, 1),
  ('melanotan-i-10mg', 'melanotan-i', '10 mg vial', 10, 5900, 0),
  ('melanotan-i-30mg', 'melanotan-i', '30 mg vial', 30, 14900, 1),
  ('ss-31-10mg', 'ss-31', '10 mg vial', 10, 8900, 0),
  ('ss-31-10x10mg', 'ss-31', '10-vial kit', 100, 79900, 1),
  ('methylcobalamin-5mg', 'methylcobalamin', '5 mg vial', 5, 2900, 0),
  ('methylcobalamin-30mg', 'methylcobalamin', '30 mg vial', 30, 7900, 1)
on conflict (id) do nothing;

-- The lot register: every batch AXIS LABS has assayed, including the ones that
-- failed specification.
--
-- Run in the Supabase SQL Editor (or via `supabase db push`).
--
-- This table is the site's whole credibility argument. The storefront claims
-- purity is verified by an independent laboratory against a published release
-- specification; this is where that claim becomes checkable. A competitor can
-- copy the typography in an afternoon and cannot copy a public record of their
-- own rejections.
--
-- NOTHING IS SEEDED. There are no fixture rows, no sample lots and no example
-- certificates anywhere in this repo — a fabricated assay figure on a research
-- chemical supplier's site is exactly the behaviour that makes a research-use
-- claim read as pretextual. Every public surface renders an honest empty state
-- until real records are loaded here.

create table if not exists public.lots (
  id uuid primary key default gen_random_uuid(),

  -- Human-facing lot code, as printed on the vial. This is the string a buyer
  -- matches against the certificate in their hand.
  lot_code text not null unique,
  product_slug text not null,

  vial_size text,
  receipt_date date,
  assay_date date,

  -- Purity as assayed, to one decimal. Constrained to a real percentage so a
  -- transposed figure fails at write time rather than rendering as a plot mark
  -- somewhere off the canvas.
  hplc_purity_pct numeric(5, 2) check (hplc_purity_pct >= 0 and hplc_purity_pct <= 100),
  method text,
  ms_result text,

  -- The testing laboratory. Nullable on purpose: most contract analytical labs
  -- prohibit use of their name in advertising, and this site is advertising.
  -- Without written name-use consent the row still publishes — it simply
  -- renders as withheld rather than inventing an attribution.
  lab_legal_name text,
  lab_accreditation_body text,
  lab_accreditation_number text,
  report_number text,
  verify_url text,

  -- Path within the certificates Storage bucket. Served through a first-party
  -- route so no third-party origin appears on the page.
  coa_path text,

  -- released: met the release specification and shipped.
  -- retained: held, not released — under investigation or re-assay.
  -- rejected: failed the release specification and was destroyed, not sold.
  status text not null check (status in ('released', 'retained', 'rejected')),

  -- Publication is explicit. A row can exist in the register for internal
  -- purposes without being visible to the public.
  published boolean not null default false,

  created_at timestamptz not null default now()
);

alter table public.lots enable row level security;

-- Anonymous visitors may read published rows and nothing else. This is the
-- inverse of the orders table, where anon may insert and never select: here the
-- record is the product, so reading it is the point.
create policy "Anyone can read published lots"
  on public.lots for select
  to anon, authenticated
  using (published = true);

-- Writes are admin-only, identified by profiles.role — the same pattern as
-- 0002_contact_messages.sql and 0003_orders.sql.
create policy "Admins can read all lots"
  on public.lots for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can insert lots"
  on public.lots for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can update lots"
  on public.lots for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create index if not exists lots_product_slug_idx on public.lots (product_slug);
create index if not exists lots_published_assay_date_idx on public.lots (published, assay_date desc);

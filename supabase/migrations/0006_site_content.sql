-- Editable page copy.
--
-- Run in the Supabase SQL Editor (or via `supabase db push`) AFTER 0001–0005.
--
-- A key/value store rather than a page-shaped schema, because the thing being
-- edited is individual strings, not documents: a headline, a compound summary,
-- one FAQ answer. Keys are namespaced (`home.title`, `product.bpc-157.summary`,
-- `ordering.faq.3.a`) and every one is declared in src/lib/content.ts with the
-- text currently in source as its fallback.
--
-- NOTHING IS SEEDED, deliberately. An empty table means every string resolves
-- to the copy compiled into the repository, so this migration changes nothing
-- until somebody edits something. A row appears only when it is overridden,
-- which also makes "what has been changed from the original?" a `select *`.
--
-- The legal and policy pages are NOT editable here. /terms, /privacy,
-- /prohibited-use, /shipping-returns and the research-use notice stay in source
-- where they are reviewed in a diff — those are disclosures, and a disclosure
-- one typo away from being wrong is exactly where it should not be.

create table if not exists public.site_content (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.site_content enable row level security;

-- The copy is on public pages, so reading it is public.
create policy "Anyone can read site content"
  on public.site_content for select
  to anon, authenticated
  using (true);

create policy "Admins can insert site content"
  on public.site_content for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can update site content"
  on public.site_content for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Deleting a row is how a string is reverted to the text in source.
create policy "Admins can delete site content"
  on public.site_content for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

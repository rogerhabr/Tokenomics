-- Orders placed through the AXIS LABS storefront.
-- Run in the Supabase SQL Editor (or via `supabase db push`).

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  email text not null,
  name text not null,
  organization text,
  phone text,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  region text,
  postal_code text not null,
  country text not null,
  notes text,
  -- Money is stored in integer cents; never floats.
  subtotal_cents integer not null check (subtotal_cents >= 0),
  -- The buyer must affirm research use before an order can be placed. Enforced
  -- in the API and again here so a row cannot exist without it.
  research_use_ack boolean not null check (research_use_ack = true),
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id text not null,
  product_slug text not null,
  product_name text not null,
  variant_label text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity > 0 and quantity <= 99),
  line_total_cents integer not null check (line_total_cents >= 0)
);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- The storefront is public, so anonymous visitors must be able to place an
-- order. Insert is the ONLY grant: there is deliberately no select policy for
-- anon/authenticated, so nobody can enumerate orders or read back another
-- buyer's address. The confirmation page is served from the API's own response,
-- not from a read of this table.
create policy "Anyone can place an order"
  on public.orders for insert
  to anon, authenticated
  with check (true);

create policy "Anyone can add items to an order"
  on public.order_items for insert
  to anon, authenticated
  with check (true);

-- Reading orders is limited to admins, identified by profiles.role.
create policy "Admins can read orders"
  on public.orders for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can read order items"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

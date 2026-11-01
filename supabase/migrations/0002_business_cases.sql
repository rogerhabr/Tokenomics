-- Business Case Agent: saved cases per user.
-- Run in the Supabase SQL Editor (or `supabase db push`) after 0001_init.sql.

create table if not exists public.business_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  inputs jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_cases_user_id_idx on public.business_cases (user_id, updated_at desc);

alter table public.business_cases enable row level security;

create policy "Users can view their own business cases"
  on public.business_cases for select
  using (auth.uid() = user_id);

create policy "Users can insert their own business cases"
  on public.business_cases for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own business cases"
  on public.business_cases for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own business cases"
  on public.business_cases for delete
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists business_cases_set_updated_at on public.business_cases;
create trigger business_cases_set_updated_at
  before update on public.business_cases
  for each row execute procedure public.set_updated_at();

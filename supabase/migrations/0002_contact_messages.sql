-- Contact form submissions from the public AXIS LABS marketing site.
-- Run in the Supabase SQL Editor (or via `supabase db push`).

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  organization text,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

-- The marketing site is public, so anonymous visitors must be able to submit.
-- Insert is the ONLY grant they get: there is deliberately no select policy for
-- anon/authenticated, so a submitter cannot read back this table (their own row
-- included).
create policy "Anyone can submit a contact message"
  on public.contact_messages for insert
  to anon, authenticated
  with check (true);

-- Reading submissions is limited to admins, identified by profiles.role.
create policy "Admins can read contact messages"
  on public.contact_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

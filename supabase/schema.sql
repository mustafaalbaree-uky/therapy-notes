-- Therapy Notes database schema.
-- Run this once in the Supabase SQL editor for your project.
--
-- Row Level Security is what keeps the transcripts private even though the web
-- app is publicly hosted: without a logged-in session, the anon key can read
-- nothing. The shortcut writes rows using the service_role key, which bypasses
-- RLS, and tags each row with an explicit user_id.

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  recorded_at timestamptz not null default now(),
  title text,
  transcript_raw text not null,
  transcript_labeled text,
  summary text,
  takeaways text,
  next_steps text,
  reflections text,
  notes text,
  source text not null default 'shortcut',
  status text not null default 'transcribed',
  duration_seconds int,
  created_at timestamptz not null default now()
);

-- Newest-first listing is the common query; index recorded_at per user.
create index if not exists sessions_user_recorded_at_idx
  on public.sessions (user_id, recorded_at desc);

alter table public.sessions enable row level security;

-- Policies are idempotent-friendly: drop then recreate so re-running is safe.
drop policy if exists "owner reads own" on public.sessions;
drop policy if exists "owner inserts own" on public.sessions;
drop policy if exists "owner updates own" on public.sessions;
drop policy if exists "owner deletes own" on public.sessions;

create policy "owner reads own" on public.sessions
  for select using (auth.uid() = user_id);
create policy "owner inserts own" on public.sessions
  for insert with check (auth.uid() = user_id);
create policy "owner updates own" on public.sessions
  for update using (auth.uid() = user_id);
create policy "owner deletes own" on public.sessions
  for delete using (auth.uid() = user_id);

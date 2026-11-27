-- COIN RUSH: server-authoritative Ranked 1v1 foundation
-- Run this migration in the Supabase SQL Editor.
-- Queue and match writes are intentionally server-only; clients receive read access
-- only to matches they participate in and their match event stream.

alter table public.profiles
  add column if not exists combat_power integer not null default 0
  check (combat_power >= 0);

create index if not exists profiles_matchmaking_idx
  on public.profiles (rating, combat_power);

create table if not exists public.ranked_queue (
  player_id uuid primary key references public.profiles (id) on delete cascade,
  rating_snapshot integer not null check (rating_snapshot >= 0),
  combat_power_snapshot integer not null check (combat_power_snapshot >= 0),
  queued_at timestamptz not null default now()
);

create index if not exists ranked_queue_search_idx
  on public.ranked_queue (rating_snapshot, combat_power_snapshot, queued_at);

create table if not exists public.ranked_matches (
  id uuid primary key default gen_random_uuid(),
  player_one_id uuid not null references public.profiles (id),
  player_two_id uuid not null references public.profiles (id),
  status text not null default 'matched'
    check (status in ('matched', 'active', 'completed', 'cancelled')),
  winner_id uuid references public.profiles (id),
  player_one_power integer not null check (player_one_power >= 0),
  player_two_power integer not null check (player_two_power >= 0),
  duration_seconds integer not null default 300 check (duration_seconds = 300),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  constraint ranked_matches_distinct_players check (player_one_id <> player_two_id),
  constraint ranked_matches_winner_is_player check (
    winner_id is null or winner_id in (player_one_id, player_two_id)
  )
);

create index if not exists ranked_matches_player_one_idx
  on public.ranked_matches (player_one_id, created_at desc);

create index if not exists ranked_matches_player_two_idx
  on public.ranked_matches (player_two_id, created_at desc);

create table if not exists public.ranked_match_events (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.ranked_matches (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ranked_match_events_timeline_idx
  on public.ranked_match_events (match_id, created_at, id);

alter table public.ranked_queue enable row level security;
alter table public.ranked_matches enable row level security;
alter table public.ranked_match_events enable row level security;

drop policy if exists "Players can read their ranked matches" on public.ranked_matches;
create policy "Players can read their ranked matches"
  on public.ranked_matches
  for select
  to authenticated
  using (auth.uid() in (player_one_id, player_two_id));

drop policy if exists "Players can read events from their ranked matches" on public.ranked_match_events;
create policy "Players can read events from their ranked matches"
  on public.ranked_match_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.ranked_matches m
      where m.id = ranked_match_events.match_id
        and auth.uid() in (m.player_one_id, m.player_two_id)
    )
  );

-- No client INSERT, UPDATE, or DELETE policies are created for ranked_queue,
-- ranked_matches, or ranked_match_events. Trusted server functions will own writes.

grant select on public.ranked_matches to authenticated;
grant select on public.ranked_match_events to authenticated;

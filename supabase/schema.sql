-- COIN RUSH: initial player profile and leaderboard schema
-- Run this file in Supabase SQL Editor.
-- Client apps can read public leaderboard fields, but cannot write ratings or stats.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  rating integer not null default 1000 check (rating >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  created_at timestamptz not null default now()
);

create index if not exists profiles_leaderboard_idx
  on public.profiles (rating desc, wins desc, created_at asc);

alter table public.profiles enable row level security;

-- Public leaderboard: only the non-sensitive profile fields are stored here.
drop policy if exists "Anyone can read leaderboard profiles" on public.profiles;
create policy "Anyone can read leaderboard profiles"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

-- Intentionally no client INSERT, UPDATE, or DELETE policies.
-- Profile creation and competitive-stat changes are reserved for trusted server code.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_username text;
begin
  chosen_username := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    'Rusher_' || left(replace(new.id::text, '-', ''), 8)
  );

  insert into public.profiles (id, username)
  values (new.id, chosen_username)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

grant select on public.profiles to anon, authenticated;

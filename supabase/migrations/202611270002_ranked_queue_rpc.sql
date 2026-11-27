-- COIN RUSH: authenticated Ranked queue matchmaking RPC
-- Run after 202611270001_ranked_matchmaking_foundation.sql.
-- This creates matches server-side; clients cannot choose opponents or write queue rows.

create or replace function public.queue_ranked_match()
returns table (
  match_found boolean,
  match_id uuid,
  opponent_id uuid,
  opponent_rating integer,
  opponent_combat_power integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rating integer;
  v_power integer;
  v_queued_at timestamptz;
  v_wait_seconds integer;
  v_rating_window integer;
  v_power_window integer;
  v_opponent record;
  v_match_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  -- Serialize queue matching so two simultaneous requests cannot pair the same player twice.
  perform pg_advisory_xact_lock(hashtext('coin_rush_ranked_queue'));

  select p.rating, p.combat_power
    into v_rating, v_power
  from public.profiles p
  where p.id = v_uid;

  if not found then
    raise exception 'Player profile not found';
  end if;

  insert into public.ranked_queue (
    player_id, rating_snapshot, combat_power_snapshot
  )
  values (v_uid, v_rating, v_power)
  on conflict (player_id) do nothing;

  select q.queued_at
    into v_queued_at
  from public.ranked_queue q
  where q.player_id = v_uid;

  v_wait_seconds := greatest(0, floor(extract(epoch from (now() - v_queued_at)))::integer);
  v_rating_window := least(400, 100 + (v_wait_seconds / 15) * 75);
  v_power_window := least(30, 10 + (v_wait_seconds / 15) * 5);

  select
    q.player_id,
    q.rating_snapshot,
    q.combat_power_snapshot
  into v_opponent
  from public.ranked_queue q
  where q.player_id <> v_uid
    and abs(q.rating_snapshot - v_rating) <= v_rating_window
    and abs(q.combat_power_snapshot - v_power) <= v_power_window
  order by
    abs(q.rating_snapshot - v_rating) + (abs(q.combat_power_snapshot - v_power) * 10),
    q.queued_at asc
  limit 1
  for update skip locked;

  if not found then
    return query select false, null::uuid, null::uuid, null::integer, null::integer;
    return;
  end if;

  insert into public.ranked_matches (
    player_one_id,
    player_two_id,
    player_one_power,
    player_two_power,
    status
  )
  values (
    v_uid,
    v_opponent.player_id,
    v_power,
    v_opponent.combat_power_snapshot,
    'matched'
  )
  returning id into v_match_id;

  delete from public.ranked_queue q
  where q.player_id in (v_uid, v_opponent.player_id);

  return query
  select
    true,
    v_match_id,
    v_opponent.player_id,
    v_opponent.rating_snapshot,
    v_opponent.combat_power_snapshot;
end;
$$;

revoke all on function public.queue_ranked_match() from public;
grant execute on function public.queue_ranked_match() to authenticated;

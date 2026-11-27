-- COIN RUSH: return an already-created match to both participants.
-- Fixes the second player's polling path: it must receive the same match,
-- not enqueue again after the first player has paired them.

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
  v_existing record;
  v_match_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtext('coin_rush_ranked_queue'));

  select p.rating, p.combat_power
    into v_rating, v_power
  from public.profiles p
  where p.id = v_uid;

  if not found then
    raise exception 'Player profile not found';
  end if;

  -- If this player was already paired, return that exact match to either client.
  select
    m.id as existing_match_id,
    case when m.player_one_id = v_uid then m.player_two_id else m.player_one_id end as existing_opponent_id,
    opponent.rating as existing_opponent_rating,
    case
      when m.player_one_id = v_uid then m.player_two_power
      else m.player_one_power
    end as existing_opponent_combat_power
  into v_existing
  from public.ranked_matches m
  join public.profiles opponent
    on opponent.id = case
      when m.player_one_id = v_uid then m.player_two_id
      else m.player_one_id
    end
  where v_uid in (m.player_one_id, m.player_two_id)
    and m.status in ('matched', 'active')
  order by m.created_at desc
  limit 1;

  if found then
    return query select true, v_existing.existing_match_id, v_existing.existing_opponent_id,
      v_existing.existing_opponent_rating, v_existing.existing_opponent_combat_power;
    return;
  end if;

  insert into public.ranked_queue (
    player_id, rating_snapshot, combat_power_snapshot
  )
  values (v_uid, v_rating, v_power)
  on conflict (player_id) do update
    set rating_snapshot = excluded.rating_snapshot,
        combat_power_snapshot = excluded.combat_power_snapshot;

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

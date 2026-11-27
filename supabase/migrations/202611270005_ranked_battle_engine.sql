-- COIN RUSH: authoritative Ranked battle loop.
-- Run after 202611270004_ranked_match_readiness.sql.
-- Clients can request actions, but all costs, regeneration, damage and results are server-calculated.

create or replace function public.perform_ranked_action(
  p_match_id uuid,
  p_action text
)
returns table (
  match_status text,
  remaining_seconds integer,
  own_state jsonb,
  opponent_state jsonb,
  state_version integer,
  winner_id uuid,
  last_event text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.ranked_matches%rowtype;
  v_is_one boolean;
  v_own jsonb;
  v_opponent jsonb;
  v_elapsed numeric;
  v_now_epoch numeric;
  v_remaining integer;
  v_event text := 'state_sync';
  v_damage integer := 0;
  v_winner uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if p_action not in ('sync', 'mine', 'emp_strike') then
    raise exception 'Unsupported battle action';
  end if;

  select *
    into v_match
  from public.ranked_matches
  where id = p_match_id
    and v_uid in (player_one_id, player_two_id)
  for update;

  if not found then
    raise exception 'Match not found or access denied';
  end if;

  v_is_one := v_uid = v_match.player_one_id;
  v_own := case when v_is_one then v_match.player_one_state else v_match.player_two_state end;
  v_opponent := case when v_is_one then v_match.player_two_state else v_match.player_one_state end;

  if v_match.status <> 'active' then
    return query select v_match.status, 0, v_own, v_opponent,
      v_match.state_version, v_match.winner_id, 'match_not_active'::text;
    return;
  end if;

  v_now_epoch := extract(epoch from clock_timestamp());
  v_elapsed := greatest(0, extract(epoch from (clock_timestamp() - coalesce(v_match.last_state_at, v_match.started_at))));

  -- Passive server-side regeneration. Clients never supply elapsed time or resource values.
  v_own := jsonb_set(v_own, '{energy}',
    to_jsonb(least(100::numeric, coalesce((v_own->>'energy')::numeric, 100) + v_elapsed)), true);
  v_own := jsonb_set(v_own, '{ultimate}',
    to_jsonb(least(100::numeric, coalesce((v_own->>'ultimate')::numeric, 0) + (v_elapsed * 0.2))), true);
  v_opponent := jsonb_set(v_opponent, '{energy}',
    to_jsonb(least(100::numeric, coalesce((v_opponent->>'energy')::numeric, 100) + v_elapsed)), true);
  v_opponent := jsonb_set(v_opponent, '{ultimate}',
    to_jsonb(least(100::numeric, coalesce((v_opponent->>'ultimate')::numeric, 0) + (v_elapsed * 0.2))), true);

  v_remaining := greatest(0, 300 - floor(extract(epoch from (clock_timestamp() - v_match.started_at)))::integer);

  if p_action = 'mine' then
    if coalesce((v_own->>'energy')::numeric, 0) < 10 then
      raise exception 'Not enough energy to mine';
    end if;
    v_own := jsonb_set(v_own, '{energy}', to_jsonb((v_own->>'energy')::numeric - 10), true);
    v_own := jsonb_set(v_own, '{gold}', to_jsonb(coalesce((v_own->>'gold')::integer, 0) + 15), true);
    v_own := jsonb_set(v_own, '{ultimate}', to_jsonb(least(100, coalesce((v_own->>'ultimate')::numeric, 0) + 5)), true);
    v_event := 'mine';
  elsif p_action = 'emp_strike' then
    if coalesce((v_own->>'energy')::numeric, 0) < 35 then
      raise exception 'Not enough energy for EMP Strike';
    end if;
    if coalesce((v_own->>'emp_ready_at')::numeric, 0) > v_now_epoch then
      raise exception 'EMP Strike is on cooldown';
    end if;
    if coalesce((v_own->>'ultimate')::numeric, 0) < 25 then
      raise exception 'Not enough Ultimate charge for EMP Strike';
    end if;
    v_own := jsonb_set(v_own, '{energy}', to_jsonb((v_own->>'energy')::numeric - 35), true);
    v_own := jsonb_set(v_own, '{ultimate}', to_jsonb((v_own->>'ultimate')::numeric - 25), true);
    v_own := jsonb_set(v_own, '{emp_ready_at}', to_jsonb(v_now_epoch + 25), true);
    v_damage := 120;
    v_opponent := jsonb_set(v_opponent, '{base_health}',
      to_jsonb(greatest(0, coalesce((v_opponent->>'base_health')::integer, 1000) - v_damage)), true);
    v_event := 'emp_strike';
  end if;

  if v_is_one then
    update public.ranked_matches
    set player_one_state = v_own,
        player_two_state = v_opponent,
        last_state_at = clock_timestamp(),
        state_version = state_version + case when p_action = 'sync' then 0 else 1 end
    where id = p_match_id
    returning * into v_match;
  else
    update public.ranked_matches
    set player_one_state = v_opponent,
        player_two_state = v_own,
        last_state_at = clock_timestamp(),
        state_version = state_version + case when p_action = 'sync' then 0 else 1 end
    where id = p_match_id
    returning * into v_match;
  end if;

  if p_action <> 'sync' then
    insert into public.ranked_match_events (match_id, actor_id, event_type, payload)
    values (p_match_id, v_uid, v_event,
      jsonb_build_object('damage', v_damage, 'state_version', v_match.state_version));
  end if;

  -- Resolve a destroyed base immediately, or settle the match at the five-minute limit.
  if (v_is_one and coalesce((v_match.player_two_state->>'base_health')::integer, 1000) <= 0)
     or (not v_is_one and coalesce((v_match.player_one_state->>'base_health')::integer, 1000) <= 0)
     or v_remaining <= 0 then
    if coalesce((v_match.player_one_state->>'base_health')::integer, 1000)
       > coalesce((v_match.player_two_state->>'base_health')::integer, 1000) then
      v_winner := v_match.player_one_id;
    elsif coalesce((v_match.player_two_state->>'base_health')::integer, 1000)
       > coalesce((v_match.player_one_state->>'base_health')::integer, 1000) then
      v_winner := v_match.player_two_id;
    elsif coalesce((v_match.player_one_state->>'gold')::integer, 0)
       > coalesce((v_match.player_two_state->>'gold')::integer, 0) then
      v_winner := v_match.player_one_id;
    elsif coalesce((v_match.player_two_state->>'gold')::integer, 0)
       > coalesce((v_match.player_one_state->>'gold')::integer, 0) then
      v_winner := v_match.player_two_id;
    end if;

    update public.ranked_matches
    set status = 'completed', winner_id = v_winner, ended_at = clock_timestamp(),
        state_version = state_version + 1
    where id = p_match_id
    returning * into v_match;

    insert into public.ranked_match_events (match_id, actor_id, event_type, payload)
    values (p_match_id, null, 'match_completed',
      jsonb_build_object('winner_id', v_winner, 'reason',
        case when v_remaining <= 0 then 'time_limit' else 'base_destroyed' end));
    v_event := 'match_completed';
  end if;

  v_remaining := case when v_match.status = 'completed' then 0
    else greatest(0, 300 - floor(extract(epoch from (clock_timestamp() - v_match.started_at)))::integer)
    end;

  v_own := case when v_is_one then v_match.player_one_state else v_match.player_two_state end;
  v_opponent := case when v_is_one then v_match.player_two_state else v_match.player_one_state end;

  return query select v_match.status, v_remaining, v_own, v_opponent,
    v_match.state_version, v_match.winner_id, v_event;
end;
$$;

revoke all on function public.perform_ranked_action(uuid, text) from public;
grant execute on function public.perform_ranked_action(uuid, text) to authenticated;

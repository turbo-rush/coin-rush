-- COIN RUSH: server-owned match readiness and initial battle state.
-- Run after 202611270003_ranked_matchmaking_pair_delivery.sql.

alter table public.ranked_matches
  add column if not exists player_one_ready boolean not null default false,
  add column if not exists player_two_ready boolean not null default false,
  add column if not exists player_one_state jsonb not null default '{}'::jsonb,
  add column if not exists player_two_state jsonb not null default '{}'::jsonb,
  add column if not exists state_version integer not null default 0
    check (state_version >= 0),
  add column if not exists last_state_at timestamptz;

create or replace function public.ready_ranked_match(p_match_id uuid)
returns table (
  match_status text,
  player_one_ready boolean,
  player_two_ready boolean,
  started_at timestamptz,
  state_version integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.ranked_matches%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
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

  if v_match.status = 'completed' or v_match.status = 'cancelled' then
    return query select v_match.status, v_match.player_one_ready,
      v_match.player_two_ready, v_match.started_at, v_match.state_version;
    return;
  end if;

  if v_match.status = 'matched' then
    if v_uid = v_match.player_one_id then
      update public.ranked_matches
      set player_one_ready = true
      where id = p_match_id;
    else
      update public.ranked_matches
      set player_two_ready = true
      where id = p_match_id;
    end if;

    select *
      into v_match
    from public.ranked_matches
    where id = p_match_id
    for update;

    if v_match.player_one_ready and v_match.player_two_ready then
      update public.ranked_matches
      set status = 'active',
          started_at = now(),
          last_state_at = now(),
          state_version = 1,
          player_one_state = jsonb_build_object(
            'health', 100, 'energy', 100, 'ultimate', 0, 'base_health', 1000
          ),
          player_two_state = jsonb_build_object(
            'health', 100, 'energy', 100, 'ultimate', 0, 'base_health', 1000
          )
      where id = p_match_id
      returning * into v_match;

      insert into public.ranked_match_events (match_id, actor_id, event_type, payload)
      values (p_match_id, null, 'match_started',
        jsonb_build_object('duration_seconds', 300, 'state_version', 1));
    end if;
  end if;

  return query select v_match.status, v_match.player_one_ready,
    v_match.player_two_ready, v_match.started_at, v_match.state_version;
end;
$$;

revoke all on function public.ready_ranked_match(uuid) from public;
grant execute on function public.ready_ranked_match(uuid) to authenticated;

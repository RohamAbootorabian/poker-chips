-- Online poker: cards are dealt on the server.
-- `private` holds the deck, everyone's hole cards and the players' secrets.
-- It is only ever read by the `poker` edge function (service role).

alter table public.poker_tables add column if not exists private jsonb;

-- Online tables may only be created and changed by the edge function, so the
-- open RPCs refuse them. (poker_get stays as is: it returns public state only.)

create or replace function public.poker_create(p_code text, p_state jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(p_code) < 4 or pg_column_size(p_state) > 200000
     or coalesce(p_state->>'mode', 'chips') <> 'chips' then
    return false;
  end if;
  insert into poker_tables (code, state) values (p_code, p_state)
  on conflict (code) do nothing;
  return found;
end;
$$;

create or replace function public.poker_update(p_code text, p_version integer, p_state jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_column_size(p_state) > 200000 or coalesce(p_state->>'mode', 'chips') <> 'chips' then
    return false;
  end if;
  update poker_tables
     set state = p_state, version = version + 1, updated_at = now()
   where code = p_code and version = p_version
     and coalesce(state->>'mode', 'chips') = 'chips';
  return found;
end;
$$;

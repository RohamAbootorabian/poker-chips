-- Poker Chips: one row per table, the whole game state as JSON.
-- Run this once in the Supabase SQL editor.
--
-- Clients never touch the table directly (RLS is on with no policies).
-- They go through the three functions below, so a table can only be read or
-- changed by someone who knows its room code.

create table if not exists public.poker_tables (
  code text primary key,
  state jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.poker_tables enable row level security;

create or replace function public.poker_create(p_code text, p_state jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(p_code) < 4 or pg_column_size(p_state) > 200000 then
    return false;
  end if;
  insert into poker_tables (code, state) values (p_code, p_state)
  on conflict (code) do nothing;
  return found;
end;
$$;

create or replace function public.poker_get(p_code text)
returns table (state jsonb, version integer)
language sql
stable
security definer
set search_path = public
as $$
  select t.state, t.version from poker_tables t where t.code = p_code;
$$;

-- Optimistic concurrency: the write only succeeds if the caller saw the
-- latest version. Returns false on a conflict; the client refetches and retries.
create or replace function public.poker_update(p_code text, p_version integer, p_state jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_column_size(p_state) > 200000 then
    return false;
  end if;
  update poker_tables
     set state = p_state, version = version + 1, updated_at = now()
   where code = p_code and version = p_version;
  return found;
end;
$$;

grant execute on function public.poker_create(text, jsonb) to anon, authenticated;
grant execute on function public.poker_get(text) to anon, authenticated;
grant execute on function public.poker_update(text, integer, jsonb) to anon, authenticated;

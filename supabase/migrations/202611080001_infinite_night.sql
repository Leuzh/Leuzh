create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  username_normalized text generated always as (lower(username)) stored,
  created_at timestamptz not null default now(),
  constraint profiles_username_length check (char_length(username) between 3 and 18),
  constraint profiles_username_chars check (username ~ '^[A-Za-z0-9_]+$'),
  constraint profiles_username_unique unique (username_normalized)
);

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  client_run_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  username_snapshot text not null,
  score bigint not null check (score >= 0),
  survival_seconds integer not null check (survival_seconds >= 0),
  kills integer not null check (kills >= 0),
  level integer not null check (level >= 1),
  created_at timestamptz not null default now(),
  constraint runs_user_client_unique unique (user_id, client_run_id)
);

create index if not exists runs_score_idx on public.runs (score desc, created_at asc);
create index if not exists runs_user_history_idx on public.runs (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.runs enable row level security;
create policy "Profiles are publicly readable" on public.profiles for select using (true);
create policy "Users create their own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users update their own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users read their own run history" on public.runs for select using (auth.uid() = user_id);
revoke insert, update, delete on public.runs from anon, authenticated;
grant select on public.profiles, public.runs to anon, authenticated;
grant insert, update on public.profiles to authenticated;

create or replace function public.submit_run(
  p_client_run_id uuid,
  p_survival_seconds integer,
  p_kills integer,
  p_level integer
) returns public.runs
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
  v_run public.runs;
  v_score bigint;
begin
  if v_user is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_client_run_id is null or p_survival_seconds is null or p_kills is null or p_level is null
     or p_survival_seconds not between 1 and 86400
     or p_kills not between 0 and least(200000, p_survival_seconds * 12)
     or p_level not between 1 and least(300, 1 + p_survival_seconds / 8) then
    raise exception 'run statistics are implausible' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  select * into v_profile from public.profiles where id = v_user;
  if not found then raise exception 'profile required' using errcode = '23503'; end if;
  if exists (select 1 from public.runs where user_id = v_user and client_run_id = p_client_run_id) then
    raise exception 'run already submitted' using errcode = '23505';
  end if;
  if exists (select 1 from public.runs where user_id = v_user and created_at > now() - interval '5 seconds') then
    raise exception 'submission rate limited' using errcode = 'P0001';
  end if;

  v_score := p_survival_seconds * 10 + p_kills * 5 + p_level * 100;
  insert into public.runs (client_run_id, user_id, username_snapshot, score, survival_seconds, kills, level)
  values (p_client_run_id, v_user, v_profile.username, v_score, p_survival_seconds, p_kills, p_level)
  returning * into v_run;
  return v_run;
end;
$$;
revoke all on function public.submit_run(uuid, integer, integer, integer) from public, anon;
grant execute on function public.submit_run(uuid, integer, integer, integer) to authenticated;

create or replace view public.leaderboard as
select row_number() over (order by score desc, created_at asc) as rank,
       username_snapshot as username, score, survival_seconds, kills, level, created_at
from public.runs;
grant select on public.leaderboard to anon, authenticated;

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  v_name := coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), 'Night_' || substr(new.id::text, 1, 8));
  v_name := regexp_replace(v_name, '[^A-Za-z0-9_]', '', 'g');
  v_name := substr(v_name, 1, 18);
  if char_length(v_name) < 3 then v_name := 'Night_' || substr(new.id::text, 1, 8); end if;
  insert into public.profiles (id, username) values (new.id, v_name);
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_infinite_night on auth.users;
create trigger on_auth_user_created_infinite_night after insert on auth.users
for each row execute function public.create_profile_for_new_user();

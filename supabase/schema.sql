-- =====================================================================
--  SnackTask - database setup
--  Run this ONCE in Supabase: SQL Editor -> New query -> paste -> Run.
--  Before running, change the email on the LAST line to your own email
--  (that makes you the admin).
-- =====================================================================


-- ---------------------------------------------------------------------
-- Time helpers (everything runs on Slovenian time)
-- ---------------------------------------------------------------------
create or replace function public.local_now() returns timestamp
language sql stable as $$ select (now() at time zone 'Europe/Ljubljana') $$;

create or replace function public.local_today() returns date
language sql stable as $$ select (now() at time zone 'Europe/Ljubljana')::date $$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  id                   int primary key default 1 check (id = 1),
  max_tasks            int  not null default 5   check (max_tasks between 1 and 20),
  min_estimate         int  not null default 15  check (min_estimate >= 1),
  max_estimate         int  not null default 480 check (max_estimate >= 1),
  lock_time            time not null default '10:00',
  close_time           time not null default '17:00',
  points_done          int  not null default 5,
  points_on_time_bonus int  not null default 5,
  points_failed        int  not null default -5,
  stake_presets        text[] not null default array['Prigrizek za pisarno','Runda kave','Torta','Košara sadja','Pomijem skodelice'],
  updated_at           timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict do nothing;

create table if not exists public.invites (
  email      text primary key check (email = lower(email) and position('@' in email) > 1),
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null unique,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_color text not null default 'sage' check (avatar_color in ('sage','peach','lavender','sky','butter','coral')),
  avatar_emoji text not null default '' check (char_length(avatar_emoji) <= 8),
  role         text not null default 'member' check (role in ('member','admin')),
  language     text not null default 'sl' check (language in ('sl','en')),
  theme        text not null default 'light' check (theme in ('light','dark')),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  task_date    date not null,
  title        text not null check (char_length(title) between 1 and 120),
  estimate_min int  not null check (estimate_min > 0),
  stake        text not null check (char_length(stake) between 1 and 80),
  is_private   boolean not null default false,
  status       text not null default 'planned' check (status in ('planned','running','paused','done')),
  started_at   timestamptz,
  elapsed_sec  int not null default 0,
  used_timer   boolean not null default false,
  on_time      boolean not null default false,
  finished_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists tasks_user_date on public.tasks (user_id, task_date);
create index if not exists tasks_date on public.tasks (task_date);

create table if not exists public.reactions (
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null check (emoji in ('clap','fire','muscle','rocket','laugh','donut')),
  created_at timestamptz not null default now(),
  primary key (task_id, user_id, emoji)
);

create table if not exists public.look_requests (
  task_id    uuid not null references public.tasks(id) on delete cascade,
  from_user  uuid not null references public.profiles(id) on delete cascade,
  seen       boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (task_id, from_user)
);

create table if not exists public.settlements (
  task_id    uuid primary key references public.tasks(id) on delete cascade,
  settled_by uuid not null references public.profiles(id) on delete cascade,
  note       text not null default '' check (char_length(note) <= 200),
  settled_at timestamptz not null default now()
);

create table if not exists public.away_days (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);

create table if not exists public.holidays (
  day  date primary key,
  name text not null default '' check (char_length(name) <= 60)
);

create table if not exists public.adjustments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  day        date not null,
  points     int  not null check (points between -1000 and 1000),
  reason     text not null check (char_length(reason) between 1 and 200),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.week_prizes (
  week_start date primary key,
  prize      text not null check (char_length(prize) <= 120)
);

-- A small "something changed" feed. Every action writes one row, which
-- lets every open screen refresh instantly. It never contains task titles.
create table if not exists public.activity (
  id         bigint generated always as identity primary key,
  kind       text not null,
  user_id    uuid references public.profiles(id) on delete cascade,
  task_id    uuid,
  on_time    boolean,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Who is who
-- ---------------------------------------------------------------------
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active and role = 'admin')
$$;

create or replace function public.is_working_day(d date) returns boolean
language sql stable security definer set search_path = public as $$
  select extract(isodow from d) < 6 and not exists (select 1 from holidays where day = d)
$$;

create or replace function public.server_now() returns double precision
language sql stable as $$ select extract(epoch from now()) * 1000 $$;

create or replace function public.log_activity(p_kind text, p_task uuid default null, p_on_time boolean default null)
returns void language sql security definer set search_path = public as $$
  insert into activity (kind, user_id, task_id, on_time) values (p_kind, auth.uid(), p_task, p_on_time);
  delete from activity where created_at < now() - interval '14 days';
$$;
revoke execute on function public.log_activity(text, uuid, boolean) from public, anon, authenticated;

-- Called by the app right after login. Creates the profile the first time,
-- but only for emails on the invite list. Returns null if not invited.
create or replace function public.ensure_profile() returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  p   profiles;
  e   text := lower(coalesce(auth.jwt() ->> 'email', ''));
  inv invites;
  n   int;
begin
  if auth.uid() is null then return null; end if;
  select * into p from profiles where id = auth.uid();
  if found then return p; end if;
  select * into inv from invites where email = e;
  if not found then return null; end if;
  select count(*) into n from profiles;
  insert into profiles (id, email, display_name, avatar_color, role)
  values (auth.uid(), e,
          left(initcap(replace(replace(split_part(e, '@', 1), '.', ' '), '_', ' ')), 40),
          (array['sage','peach','lavender','sky','butter','coral'])[1 + (n % 6)],
          case when inv.is_admin then 'admin' else 'member' end)
  returning * into p;
  perform log_activity('join');
  return p;
end $$;

-- ---------------------------------------------------------------------
-- Board view: everyone's tasks with the live status and points.
-- Private titles (and stakes, until a task is failed) are hidden from
-- everyone except the owner, right here on the server.
-- ---------------------------------------------------------------------
create or replace view public.board_tasks as
select t.id,
       t.user_id,
       t.task_date,
       case when t.is_private and t.user_id is distinct from auth.uid() then null else t.title end as title,
       t.estimate_min,
       case when t.is_private and t.user_id is distinct from auth.uid() and e.eff_status <> 'failed'
            then null else t.stake end as stake,
       t.is_private,
       t.status,
       e.eff_status,
       t.started_at,
       t.elapsed_sec,
       t.used_timer,
       t.on_time,
       t.finished_at,
       t.created_at,
       case e.eff_status
         when 'done'   then s.points_done + case when t.on_time then s.points_on_time_bonus else 0 end
         when 'failed' then s.points_failed
         else 0 end as points
from tasks t
cross join settings s
cross join lateral (
  select case
           when t.status = 'done' then 'done'
           when t.task_date < local_today()
             or (t.task_date = local_today() and local_now()::time >= s.close_time) then 'failed'
           else t.status
         end as eff_status
) e
where is_member();

-- One row per person per day: the numbers behind leaderboards, streaks,
-- badges and stats.
create or replace view public.day_results as
select user_id,
       task_date,
       count(*)::int                                                         as planned,
       count(*) filter (where eff_status = 'done')::int                      as done,
       count(*) filter (where eff_status = 'failed')::int                    as failed,
       count(*) filter (where eff_status = 'done' and on_time)::int          as on_time,
       coalesce(sum(points), 0)::int                                         as points,
       coalesce(sum(elapsed_sec) filter (where eff_status = 'done' and used_timer), 0)::int        as timed_sec,
       coalesce(sum(estimate_min * 60) filter (where eff_status = 'done' and used_timer), 0)::int as timed_est_sec,
       max(finished_at)                                                      as last_done_at
from board_tasks
group by user_id, task_date;

-- The snack ledger: every failed task, with its stake and settlement.
create or replace view public.ledger as
select b.id as task_id, b.user_id, b.task_date, b.title, b.is_private, b.stake,
       st.settled_by, st.note, st.settled_at
from board_tasks b
left join settlements st on st.task_id = b.id
where b.eff_status = 'failed';

create or replace view public.reactions_given as
select user_id, count(*)::int as n from reactions where is_member() group by user_id;

-- ---------------------------------------------------------------------
-- Actions (the app can only change tasks through these, so the rules
-- cannot be skipped)
-- ---------------------------------------------------------------------
create or replace function public._assert_planning_open() returns void
language plpgsql security definer set search_path = public as $$
declare s settings;
begin
  if not is_member() then raise exception 'not_member'; end if;
  select * into s from settings where id = 1;
  if not is_working_day(local_today()) then raise exception 'not_working_day'; end if;
  if exists (select 1 from away_days where user_id = auth.uid() and day = local_today()) then
    raise exception 'away_today';
  end if;
  if local_now()::time >= s.lock_time then raise exception 'locked'; end if;
end $$;
revoke execute on function public._assert_planning_open() from public, anon, authenticated;

create or replace function public._check_task_fields(p_title text, p_estimate int, p_stake text) returns void
language plpgsql security definer set search_path = public as $$
declare s settings;
begin
  select * into s from settings where id = 1;
  if p_title is null or char_length(trim(p_title)) = 0 or char_length(trim(p_title)) > 120 then raise exception 'bad_title'; end if;
  if p_stake is null or char_length(trim(p_stake)) = 0 or char_length(trim(p_stake)) > 80 then raise exception 'bad_stake'; end if;
  if p_estimate is null or p_estimate < s.min_estimate or p_estimate > s.max_estimate then raise exception 'bad_estimate'; end if;
end $$;
revoke execute on function public._check_task_fields(text, int, text) from public, anon, authenticated;

create or replace function public.add_task(p_title text, p_estimate int, p_stake text, p_private boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare s settings; n int; new_id uuid;
begin
  perform _assert_planning_open();
  perform _check_task_fields(p_title, p_estimate, p_stake);
  select * into s from settings where id = 1;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select count(*) into n from tasks where user_id = auth.uid() and task_date = local_today();
  if n >= s.max_tasks then raise exception 'too_many_tasks'; end if;
  insert into tasks (user_id, task_date, title, estimate_min, stake, is_private)
  values (auth.uid(), local_today(), trim(p_title), p_estimate, trim(p_stake), coalesce(p_private, false))
  returning id into new_id;
  perform log_activity('plan', new_id);
  return new_id;
end $$;

create or replace function public.edit_task(p_id uuid, p_title text, p_estimate int, p_stake text, p_private boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _assert_planning_open();
  perform _check_task_fields(p_title, p_estimate, p_stake);
  update tasks set title = trim(p_title), estimate_min = p_estimate, stake = trim(p_stake), is_private = coalesce(p_private, false)
  where id = p_id and user_id = auth.uid() and task_date = local_today() and status <> 'done';
  if not found then raise exception 'not_found'; end if;
  perform log_activity('edit', p_id);
end $$;

create or replace function public.delete_task(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _assert_planning_open();
  delete from tasks where id = p_id and user_id = auth.uid() and task_date = local_today() and status <> 'done';
  if not found then raise exception 'not_found'; end if;
  perform log_activity('delete', p_id);
end $$;

create or replace function public._assert_day_open(t tasks) returns void
language plpgsql security definer set search_path = public as $$
declare s settings;
begin
  select * into s from settings where id = 1;
  if t.task_date <> local_today() or local_now()::time >= s.close_time then raise exception 'closed'; end if;
end $$;
revoke execute on function public._assert_day_open(tasks) from public, anon, authenticated;

create or replace function public.start_task(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t tasks;
begin
  if not is_member() then raise exception 'not_member'; end if;
  select * into t from tasks where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  perform _assert_day_open(t);
  if t.status not in ('planned','paused') then raise exception 'bad_state'; end if;
  -- only one timer at a time: pause any other running task
  update tasks set elapsed_sec = elapsed_sec + greatest(0, extract(epoch from now() - started_at))::int,
                   status = 'paused', started_at = null
  where user_id = auth.uid() and status = 'running' and id <> p_id;
  update tasks set status = 'running', started_at = now(), used_timer = true where id = p_id;
  perform log_activity('start', p_id);
end $$;

create or replace function public.pause_task(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t tasks;
begin
  if not is_member() then raise exception 'not_member'; end if;
  select * into t from tasks where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  perform _assert_day_open(t);
  if t.status <> 'running' then raise exception 'bad_state'; end if;
  update tasks set elapsed_sec = elapsed_sec + greatest(0, extract(epoch from now() - started_at))::int,
                   status = 'paused', started_at = null
  where id = p_id;
  perform log_activity('pause', p_id);
end $$;

-- Returns true when the task was finished within its estimate.
create or replace function public.finish_task(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare t tasks; total int; ontime boolean;
begin
  if not is_member() then raise exception 'not_member'; end if;
  select * into t from tasks where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  perform _assert_day_open(t);
  if t.status = 'done' then raise exception 'bad_state'; end if;
  total := t.elapsed_sec + case when t.status = 'running'
                                then greatest(0, extract(epoch from now() - t.started_at))::int else 0 end;
  ontime := t.used_timer and total <= t.estimate_min * 60;
  update tasks set status = 'done', elapsed_sec = total, started_at = null,
                   finished_at = now(), on_time = ontime
  where id = p_id;
  perform log_activity('done', p_id, ontime);
  return ontime;
end $$;

create or replace function public.set_away(p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare s settings;
begin
  if not is_member() then raise exception 'not_member'; end if;
  select * into s from settings where id = 1;
  if not is_working_day(local_today()) then raise exception 'not_working_day'; end if;
  if local_now()::time >= s.lock_time then raise exception 'locked'; end if;
  if p_on then
    if exists (select 1 from tasks where user_id = auth.uid() and task_date = local_today()) then
      raise exception 'has_tasks';
    end if;
    insert into away_days (user_id, day) values (auth.uid(), local_today()) on conflict do nothing;
  else
    delete from away_days where user_id = auth.uid() and day = local_today();
  end if;
  perform log_activity('away');
end $$;

create or replace function public.toggle_reaction(p_task uuid, p_emoji text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_member() then raise exception 'not_member'; end if;
  if not exists (select 1 from tasks where id = p_task) then raise exception 'not_found'; end if;
  delete from reactions where task_id = p_task and user_id = auth.uid() and emoji = p_emoji;
  if not found then
    insert into reactions (task_id, user_id, emoji) values (p_task, auth.uid(), p_emoji);
  end if;
  perform log_activity('react', p_task);
end $$;

create or replace function public.request_look(p_task uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_member() then raise exception 'not_member'; end if;
  if not exists (select 1 from tasks where id = p_task and status = 'done' and user_id <> auth.uid()) then
    raise exception 'not_found';
  end if;
  insert into look_requests (task_id, from_user) values (p_task, auth.uid()) on conflict do nothing;
  perform log_activity('look', p_task);
end $$;

create or replace function public.mark_looks_seen()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_member() then raise exception 'not_member'; end if;
  update look_requests set seen = true
  where not seen and task_id in (select id from tasks where user_id = auth.uid());
  perform log_activity('look_seen');
end $$;

create or replace function public.settle(p_task uuid, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if not is_member() then raise exception 'not_member'; end if;
  select user_id into owner from ledger where task_id = p_task;
  if not found then raise exception 'not_found'; end if;
  if owner <> auth.uid() and not is_admin() then raise exception 'not_allowed'; end if;
  insert into settlements (task_id, settled_by, note) values (p_task, auth.uid(), left(coalesce(p_note, ''), 200))
  on conflict (task_id) do nothing;
  perform log_activity('settle', p_task);
end $$;

create or replace function public.update_my_profile(p_name text, p_color text, p_emoji text, p_language text, p_theme text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_member() then raise exception 'not_member'; end if;
  update profiles set display_name = left(trim(p_name), 40), avatar_color = p_color, avatar_emoji = left(coalesce(p_emoji, ''), 8),
                      language = p_language, theme = p_theme
  where id = auth.uid();
  perform log_activity('profile');
end $$;

-- Admin-only actions
create or replace function public.admin_set_profile(p_user uuid, p_role text, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_allowed'; end if;
  if p_user = auth.uid() and (p_role <> 'admin' or not p_active) then raise exception 'not_self'; end if;
  update profiles set role = p_role, active = p_active where id = p_user;
  perform log_activity('profile');
end $$;

create or replace function public.touch(p_kind text default 'admin')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_allowed'; end if;
  perform log_activity(p_kind);
end $$;

-- ---------------------------------------------------------------------
-- Row Level Security: who may read / change what
-- ---------------------------------------------------------------------
alter table public.settings      enable row level security;
alter table public.invites       enable row level security;
alter table public.profiles      enable row level security;
alter table public.tasks         enable row level security;
alter table public.reactions     enable row level security;
alter table public.look_requests enable row level security;
alter table public.settlements   enable row level security;
alter table public.away_days     enable row level security;
alter table public.holidays      enable row level security;
alter table public.adjustments   enable row level security;
alter table public.week_prizes   enable row level security;
alter table public.activity      enable row level security;

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (is_member());
drop policy if exists settings_admin on public.settings;
create policy settings_admin on public.settings for update using (is_admin()) with check (is_admin());

drop policy if exists invites_admin on public.invites;
create policy invites_admin on public.invites for all using (is_admin()) with check (is_admin());

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (is_member() or id = auth.uid());

-- tasks: you read your own rows directly; everyone else's go through board_tasks
drop policy if exists tasks_own on public.tasks;
create policy tasks_own on public.tasks for select using (user_id = auth.uid() and is_member());

drop policy if exists reactions_read on public.reactions;
create policy reactions_read on public.reactions for select using (is_member());
drop policy if exists looks_read on public.look_requests;
create policy looks_read on public.look_requests for select using (is_member());
drop policy if exists settlements_read on public.settlements;
create policy settlements_read on public.settlements for select using (is_member());
drop policy if exists away_read on public.away_days;
create policy away_read on public.away_days for select using (is_member());
drop policy if exists activity_read on public.activity;
create policy activity_read on public.activity for select using (is_member());

drop policy if exists holidays_read on public.holidays;
create policy holidays_read on public.holidays for select using (is_member());
drop policy if exists holidays_admin on public.holidays;
create policy holidays_admin on public.holidays for all using (is_admin()) with check (is_admin());

drop policy if exists adjustments_read on public.adjustments;
create policy adjustments_read on public.adjustments for select using (is_member());
drop policy if exists adjustments_admin on public.adjustments;
create policy adjustments_admin on public.adjustments for all using (is_admin()) with check (is_admin());

drop policy if exists prizes_read on public.week_prizes;
create policy prizes_read on public.week_prizes for select using (is_member());
drop policy if exists prizes_admin on public.week_prizes;
create policy prizes_admin on public.week_prizes for all using (is_admin()) with check (is_admin());

-- Visitors who are not logged in get nothing.
revoke all on all tables in schema public from anon;
grant select on public.board_tasks, public.day_results, public.ledger, public.reactions_given to authenticated;

-- ---------------------------------------------------------------------
-- Live updates: let open screens hear about changes instantly
-- ---------------------------------------------------------------------
do $$
declare tbl text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach tbl in array array['activity','settings','profiles','holidays','adjustments','week_prizes'] loop
      if not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = tbl) then
        execute format('alter publication supabase_realtime add table public.%I', tbl);
      end if;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Slovenian public holidays 2026-2027 (no tasks, streaks are not broken).
-- Add more later on the Admin page.
-- ---------------------------------------------------------------------
insert into public.holidays (day, name) values
  ('2026-01-01','Novo leto'), ('2026-01-02','Novo leto'), ('2026-02-08','Prešernov dan'), ('2026-04-06','Velikonočni ponedeljek'),
  ('2026-04-27','Dan upora proti okupatorju'), ('2026-05-01','Praznik dela'), ('2026-05-02','Praznik dela'), ('2026-06-25','Dan državnosti'),
  ('2026-08-15','Marijino vnebovzetje'), ('2026-10-31','Dan reformacije'), ('2026-11-01','Dan spomina na mrtve'), ('2026-12-25','Božič'),
  ('2026-12-26','Dan samostojnosti in enotnosti'),
  ('2027-01-01','Novo leto'), ('2027-01-02','Novo leto'), ('2027-02-08','Prešernov dan'), ('2027-03-29','Velikonočni ponedeljek'),
  ('2027-04-27','Dan upora proti okupatorju'), ('2027-05-01','Praznik dela'), ('2027-05-02','Praznik dela'), ('2027-06-25','Dan državnosti'),
  ('2027-08-15','Marijino vnebovzetje'), ('2027-10-31','Dan reformacije'), ('2027-11-01','Dan spomina na mrtve'), ('2027-12-25','Božič'),
  ('2027-12-26','Dan samostojnosti in enotnosti')
on conflict (day) do nothing;

-- ---------------------------------------------------------------------
-- YOUR EMAIL: change this to your own address before running.
-- It puts you on the invite list as the admin.
-- ---------------------------------------------------------------------
insert into public.invites (email, is_admin) values (lower('your.email@company.si'), true)
on conflict (email) do update set is_admin = true;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null default '' check (char_length(display_name) <= 80),
  description text not null default '' check (char_length(description) <= 500),
  avatar_path text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, description, avatar_path) on public.profiles to authenticated;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.stamp_yomi_profile_update()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger stamp_yomi_profile_updated_at
  before update on public.profiles
  for each row execute function public.stamp_yomi_profile_update();

create or replace function public.sync_yomi_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (user_id, email, is_admin)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(lower(new.email) = 'syedaddan@gmail.com', false)
  )
  on conflict (user_id) do update
  set email = excluded.email,
      is_admin = excluded.is_admin,
      updated_at = now();
  return new;
end;
$$;

create trigger sync_yomi_profile_after_auth_insert
  after insert on auth.users
  for each row execute function public.sync_yomi_profile();

create trigger sync_yomi_profile_after_email_update
  after update of email on auth.users
  for each row execute function public.sync_yomi_profile();

insert into public.profiles (user_id, email, is_admin)
select id, lower(coalesce(email, '')), coalesce(lower(email) = 'syedaddan@gmail.com', false)
from auth.users
on conflict (user_id) do update
set email = excluded.email,
    is_admin = excluded.is_admin,
    updated_at = now();

create or replace function public.is_yomi_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and is_admin
  );
$$;

revoke all on function public.is_yomi_admin() from public, anon;
grant execute on function public.is_yomi_admin() to authenticated;

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.user_item_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  attempts integer not null default 0,
  got integer not null default 0,
  slow integer not null default 0,
  missed integer not null default 0,
  response_times integer[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table public.user_lookalike_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  glyph text not null,
  attempts integer not null default 0,
  missed integer not null default 0,
  response_times integer[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, glyph)
);

create table public.user_confusion_pairs (
  user_id uuid not null references auth.users (id) on delete cascade,
  pair text not null,
  misses integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, pair)
);

create table public.user_sprint_sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at_ms bigint not null,
  deck_key text not null,
  cards_read integer not null default 0,
  misses integer not null default 0,
  mora_per_minute integer not null default 0,
  primary key (user_id, started_at_ms, deck_key)
);

create table public.user_custom_words (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  deck text not null check (deck in ('hira', 'kata')),
  kana text not null,
  meaning text not null,
  theme text not null,
  accent integer,
  source_url text not null default '',
  human_audio_url text not null default '',
  human_audio_id text not null default '',
  female_audio_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table public.user_kanji_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  character text not null,
  group_id text not null,
  views integer not null default 0,
  reveals integer not null default 0,
  attempts integer not null default 0,
  got integer not null default 0,
  slow integer not null default 0,
  missed integer not null default 0,
  last_reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, character)
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'user_preferences',
    'user_item_progress',
    'user_lookalike_progress',
    'user_confusion_pairs',
    'user_sprint_sessions',
    'user_custom_words',
    'user_kanji_progress'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format(
      'create policy "Users can manage their own rows" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      table_name
    );
  end loop;
end;
$$;

create table public.kanji_catalog_settings (
  singleton boolean primary key default true check (singleton),
  unlocked_count integer not null default 1 check (unlocked_count >= 1),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.kanji_catalog_settings (singleton, unlocked_count)
values (true, 1);

alter table public.kanji_catalog_settings enable row level security;
revoke all on public.kanji_catalog_settings from public;
grant select on public.kanji_catalog_settings to anon, authenticated;
grant update (unlocked_count) on public.kanji_catalog_settings to authenticated;

create policy "Anyone can read published Kanji lesson availability"
  on public.kanji_catalog_settings for select
  using (true);

create policy "Only admins can unlock Kanji lessons globally"
  on public.kanji_catalog_settings for update to authenticated
  using (public.is_yomi_admin())
  with check (public.is_yomi_admin());

create or replace function public.stamp_kanji_catalog_update()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create trigger stamp_kanji_catalog_settings
  before update on public.kanji_catalog_settings
  for each row execute function public.stamp_kanji_catalog_update();

create or replace function public.sync_user_progress(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Sign in is required to save progress.';
  end if;

  delete from public.user_preferences where user_id = current_user_id;
  delete from public.user_item_progress where user_id = current_user_id;
  delete from public.user_lookalike_progress where user_id = current_user_id;
  delete from public.user_confusion_pairs where user_id = current_user_id;
  delete from public.user_sprint_sessions where user_id = current_user_id;
  delete from public.user_custom_words where user_id = current_user_id;
  delete from public.user_kanji_progress where user_id = current_user_id;

  insert into public.user_preferences (user_id, preferences)
  values (current_user_id, coalesce(p_payload->'prefs', '{}'::jsonb));

  insert into public.user_item_progress (
    user_id, item_id, attempts, got, slow, missed, response_times
  )
  select current_user_id, entry.key,
    coalesce((entry.value->>'n')::integer, 0),
    coalesce((entry.value->>'got')::integer, 0),
    coalesce((entry.value->>'slow')::integer, 0),
    coalesce((entry.value->>'miss')::integer, 0),
    coalesce((
      select array_agg(response.value::integer order by response.ordinality)
      from jsonb_array_elements_text(coalesce(entry.value->'ms', '[]'::jsonb))
        with ordinality as response(value, ordinality)
    ), '{}'::integer[])
  from jsonb_each(coalesce(p_payload->'stats', '{}'::jsonb)) as entry;

  insert into public.user_lookalike_progress (
    user_id, glyph, attempts, missed, response_times
  )
  select current_user_id, entry.key,
    coalesce((entry.value->>'n')::integer, 0),
    coalesce((entry.value->>'miss')::integer, 0),
    coalesce((
      select array_agg(response.value::integer order by response.ordinality)
      from jsonb_array_elements_text(coalesce(entry.value->'rt', '[]'::jsonb))
        with ordinality as response(value, ordinality)
    ), '{}'::integer[])
  from jsonb_each(coalesce(p_payload->'conf', '{}'::jsonb)) as entry
  where entry.key not like 'pair:%';

  insert into public.user_confusion_pairs (user_id, pair, misses)
  select current_user_id, substring(entry.key from 6), (entry.value#>>'{}')::integer
  from jsonb_each(coalesce(p_payload->'conf', '{}'::jsonb)) as entry
  where entry.key like 'pair:%';

  insert into public.user_sprint_sessions (
    user_id, started_at_ms, deck_key, cards_read, misses, mora_per_minute
  )
  select current_user_id, sprint.t, sprint."key", sprint."read", sprint.miss, sprint.mpm
  from jsonb_to_recordset(coalesce(p_payload->'sprints', '[]'::jsonb))
    as sprint(t bigint, "key" text, "read" integer, miss integer, mpm integer);

  insert into public.user_custom_words (
    user_id, item_id, deck, kana, meaning, theme, accent, source_url,
    human_audio_url, human_audio_id, female_audio_id
  )
  select current_user_id,
    item->>'id',
    item->>'deck',
    item->>'kana',
    item->>'en',
    item->>'theme',
    nullif(item->>'accent', '')::integer,
    coalesce(item->>'sourceUrl', ''),
    coalesce(item->>'humanAudioUrl', ''),
    coalesce(item->>'humanAudioId', ''),
    item->>'femaleAudioId'
  from jsonb_array_elements(coalesce(p_payload->'customItems', '[]'::jsonb)) as items(item);

  insert into public.user_kanji_progress (
    user_id, character, group_id, views, reveals, attempts, got, slow, missed, last_reviewed_at
  )
  select current_user_id,
    entry.key,
    entry.value->>'groupId',
    coalesce((entry.value->>'views')::integer, 0),
    coalesce((entry.value->>'reveals')::integer, 0),
    coalesce((entry.value->>'n')::integer, 0),
    coalesce((entry.value->>'got')::integer, 0),
    coalesce((entry.value->>'slow')::integer, 0),
    coalesce((entry.value->>'miss')::integer, 0),
    nullif(entry.value->>'lastReviewedAt', '')::timestamptz
  from jsonb_each(coalesce(p_payload->'kanjiProgress', '{}'::jsonb)) as entry;
end;
$$;

revoke all on function public.sync_user_progress(jsonb) from public, anon;
grant execute on function public.sync_user_progress(jsonb) to authenticated;

insert into public.user_preferences (user_id, preferences)
select user_id, coalesce(payload->'prefs', '{}'::jsonb)
from public.user_data
on conflict (user_id) do nothing;

insert into public.user_item_progress (user_id, item_id, attempts, got, slow, missed, response_times)
select data.user_id, entry.key,
  coalesce((entry.value->>'n')::integer, 0),
  coalesce((entry.value->>'got')::integer, 0),
  coalesce((entry.value->>'slow')::integer, 0),
  coalesce((entry.value->>'miss')::integer, 0),
  coalesce((
    select array_agg(response.value::integer order by response.ordinality)
    from jsonb_array_elements_text(coalesce(entry.value->'ms', '[]'::jsonb))
      with ordinality as response(value, ordinality)
  ), '{}'::integer[])
from public.user_data as data
cross join lateral jsonb_each(coalesce(data.payload->'stats', '{}'::jsonb)) as entry
on conflict (user_id, item_id) do nothing;

insert into public.user_lookalike_progress (user_id, glyph, attempts, missed, response_times)
select data.user_id, entry.key,
  coalesce((entry.value->>'n')::integer, 0),
  coalesce((entry.value->>'miss')::integer, 0),
  coalesce((
    select array_agg(response.value::integer order by response.ordinality)
    from jsonb_array_elements_text(coalesce(entry.value->'rt', '[]'::jsonb))
      with ordinality as response(value, ordinality)
  ), '{}'::integer[])
from public.user_data as data
cross join lateral jsonb_each(coalesce(data.payload->'conf', '{}'::jsonb)) as entry
where entry.key not like 'pair:%'
on conflict (user_id, glyph) do nothing;

insert into public.user_confusion_pairs (user_id, pair, misses)
select data.user_id, substring(entry.key from 6), (entry.value#>>'{}')::integer
from public.user_data as data
cross join lateral jsonb_each(coalesce(data.payload->'conf', '{}'::jsonb)) as entry
where entry.key like 'pair:%'
on conflict (user_id, pair) do nothing;

insert into public.user_sprint_sessions (user_id, started_at_ms, deck_key, cards_read, misses, mora_per_minute)
select data.user_id, sprint.t, sprint."key", sprint."read", sprint.miss, sprint.mpm
from public.user_data as data
cross join lateral jsonb_to_recordset(coalesce(data.payload->'sprints', '[]'::jsonb))
  as sprint(t bigint, "key" text, "read" integer, miss integer, mpm integer)
on conflict (user_id, started_at_ms, deck_key) do nothing;

insert into public.user_custom_words (
  user_id, item_id, deck, kana, meaning, theme, accent, source_url,
  human_audio_url, human_audio_id, female_audio_id
)
select data.user_id,
  item->>'id',
  item->>'deck',
  item->>'kana',
  item->>'en',
  item->>'theme',
  nullif(item->>'accent', '')::integer,
  coalesce(item->>'sourceUrl', ''),
  coalesce(item->>'humanAudioUrl', ''),
  coalesce(item->>'humanAudioId', ''),
  item->>'femaleAudioId'
from public.user_data as data
cross join lateral jsonb_array_elements(coalesce(data.payload->'customItems', '[]'::jsonb)) as items(item)
on conflict (user_id, item_id) do nothing;

drop table public.user_data;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy "Users can read their own profile avatars"
  on storage.objects for select
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload their own profile avatars"
  on storage.objects for insert
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update their own profile avatars"
  on storage.objects for update
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own profile avatars"
  on storage.objects for delete
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

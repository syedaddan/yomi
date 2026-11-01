create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;
revoke all on public.user_data from anon;
grant select, insert, update on public.user_data to authenticated;

create policy "Users can read their own data"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "Users can insert their own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own data"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('custom-audio', 'custom-audio', false)
on conflict (id) do nothing;

create policy "Users can read their own custom audio"
  on storage.objects for select
  using (bucket_id = 'custom-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload their own custom audio"
  on storage.objects for insert
  with check (bucket_id = 'custom-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update their own custom audio"
  on storage.objects for update
  using (bucket_id = 'custom-audio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'custom-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own custom audio"
  on storage.objects for delete
  using (bucket_id = 'custom-audio' and (storage.foldername(name))[1] = auth.uid()::text);

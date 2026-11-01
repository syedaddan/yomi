create table public.deck_catalog_overrides (
  item_id text primary key,
  deck text not null check (deck in ('hira', 'kata', 'phr')),
  item_data jsonb,
  deleted boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  check (
    (deleted and item_data is null)
    or (not deleted and item_data is not null and jsonb_typeof(item_data) = 'object')
  )
);

alter table public.deck_catalog_overrides enable row level security;
revoke all on public.deck_catalog_overrides from public;
grant select on public.deck_catalog_overrides to anon, authenticated;
grant insert, update, delete on public.deck_catalog_overrides to authenticated;

create policy "Anyone can read the shared deck catalog"
  on public.deck_catalog_overrides for select
  using (true);

create policy "Only admins can manage the shared deck catalog"
  on public.deck_catalog_overrides for all to authenticated
  using (public.is_yomi_admin())
  with check (public.is_yomi_admin());

create or replace function public.stamp_deck_catalog_update()
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

create trigger deck_catalog_overrides_stamp_update
  before insert or update on public.deck_catalog_overrides
  for each row execute function public.stamp_deck_catalog_update();

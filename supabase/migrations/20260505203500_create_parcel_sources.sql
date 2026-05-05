-- Target project ref: lewzqavgvltzwfeypvam
-- Purpose: add parcel source metadata table for future multi-county parcel imports.
-- Scope: schema + seed + RLS policy on reference metadata table.

create table if not exists public.parcel_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  display_name text not null,
  state text not null,
  county text not null,
  provider text null,
  active boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists parcel_sources_set_updated_at on public.parcel_sources;
    create trigger parcel_sources_set_updated_at
      before update on public.parcel_sources
      for each row execute function public.set_updated_at();
  end if;
end
$$;

insert into public.parcel_sources (
  source_key,
  display_name,
  state,
  county,
  provider,
  active,
  notes
)
values (
  'houston_county_al_parcels',
  'Houston County, AL Parcels',
  'AL',
  'Houston',
  'Houston County parcel/GIS source',
  true,
  null
)
on conflict (source_key) do update
set
  display_name = excluded.display_name,
  state = excluded.state,
  county = excluded.county,
  provider = excluded.provider,
  active = excluded.active,
  notes = excluded.notes,
  updated_at = now();

alter table public.parcel_sources enable row level security;

drop policy if exists parcel_sources_select_authenticated on public.parcel_sources;
create policy parcel_sources_select_authenticated
on public.parcel_sources
for select
to authenticated
using (true);

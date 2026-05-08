-- Phase 1 foundation: business ownership tables + leads ownership columns.
-- Migration file only. Do not apply automatically.

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_status_check'
  ) then
    alter table public.businesses
      add constraint businesses_status_check
      check (status in ('active', 'inactive', 'archived'));
  end if;
end $$;

create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_members_role_check'
  ) then
    alter table public.business_members
      add constraint business_members_role_check
      check (role in ('owner', 'admin', 'staff'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_members_status_check'
  ) then
    alter table public.business_members
      add constraint business_members_status_check
      check (status in ('active', 'inactive', 'invited', 'removed'));
  end if;
end $$;

create index if not exists idx_business_members_user_id
  on public.business_members(user_id);

create index if not exists idx_business_members_business_id
  on public.business_members(business_id);

create index if not exists idx_businesses_owner_user_id
  on public.businesses(owner_user_id);

create or replace function public.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = target_business_id
      and bm.user_id = auth.uid()
      and bm.status = 'active'
  );
$$;

create or replace function public.is_business_owner(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = target_business_id
      and bm.user_id = auth.uid()
      and bm.status = 'active'
      and bm.role = 'owner'
  );
$$;

revoke all on function public.is_business_member(uuid) from public;
grant execute on function public.is_business_member(uuid) to authenticated;

revoke all on function public.is_business_owner(uuid) from public;
grant execute on function public.is_business_owner(uuid) to authenticated;

alter table if exists public.businesses enable row level security;
alter table if exists public.business_members enable row level security;

drop policy if exists businesses_select_member on public.businesses;
create policy businesses_select_member
on public.businesses
for select
to authenticated
using (
  public.is_business_member(id)
);

drop policy if exists businesses_insert_owner on public.businesses;
create policy businesses_insert_owner
on public.businesses
for insert
to authenticated
with check (owner_user_id = (select auth.uid()));

drop policy if exists businesses_update_owner on public.businesses;
create policy businesses_update_owner
on public.businesses
for update
to authenticated
using (public.is_business_owner(id))
with check (public.is_business_owner(id));

drop policy if exists business_members_select_self_or_business on public.business_members;
create policy business_members_select_self_or_business
on public.business_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_business_owner(business_id)
);

alter table if exists public.leads
  add column if not exists business_id uuid references public.businesses(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists idx_leads_business_status_created_at
  on public.leads (business_id, status, created_at desc);

create index if not exists idx_leads_business_created_at
  on public.leads (business_id, created_at desc);

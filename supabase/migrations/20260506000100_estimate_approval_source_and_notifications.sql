-- Phase B.6: estimate approval source tracking + persistent in-app notifications
-- Migration file only. Do not apply automatically.

alter table if exists public.estimates
  add column if not exists approved_by_source text null,
  add column if not exists manually_approved_at timestamptz null,
  add column if not exists approval_note text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'estimates_approved_by_source_check'
  ) then
    alter table public.estimates
      add constraint estimates_approved_by_source_check
      check (
        approved_by_source is null
        or approved_by_source in ('customer_quote', 'manual')
      );
  end if;
end $$;

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text null,
  link_path text not null,
  estimate_id uuid null references public.estimates(id) on delete set null,
  is_reviewed boolean not null default false,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_notifications_user_reviewed_created
  on public.app_notifications(user_id, is_reviewed, created_at desc);

create index if not exists idx_app_notifications_estimate_id
  on public.app_notifications(estimate_id);

create unique index if not exists uq_app_notifications_active_estimate_approved
  on public.app_notifications(user_id, notification_type, estimate_id)
  where is_reviewed = false and notification_type = 'estimate_approved';

alter table if exists public.app_notifications enable row level security;

drop policy if exists app_notifications_select_own on public.app_notifications;
create policy app_notifications_select_own
on public.app_notifications
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists app_notifications_update_own on public.app_notifications;
create policy app_notifications_update_own
on public.app_notifications
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
-- Target project ref: lewzqavgvltzwfeypvam
-- Customer alert snoozes: per-customer, per-alert-type snooze for the Today
-- retention alerts (recurring-gap and dormant). A snoozed customer is hidden
-- from that alert until snoozed_until (exclusive of past dates); permanent
-- removal is handled by marking the customer inactive, not by this table.
--
-- Scope: 1 new table + 2 indexes + RLS enable + 4 business-member policies.
--        No existing tables, data, functions, triggers, views, or storage
--        are modified.
-- Rollback: DROP TABLE public.customer_alert_snoozes; (fully reversible,
--           no other object depends on it).
--
-- The UNIQUE constraint is a formal constraint (not a bare unique index)
-- because PostgREST upsert onConflict requires a pg_constraint row.

create table if not exists public.customer_alert_snoozes (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  customer_id   uuid not null references public.customers(id) on delete cascade,
  alert_type    text not null check (alert_type in ('recurring_gap', 'dormant')),
  snoozed_until date not null,
  created_by    uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  constraint customer_alert_snoozes_customer_alert_unique unique (customer_id, alert_type)
);

create index if not exists idx_customer_alert_snoozes_business_id
  on public.customer_alert_snoozes (business_id);
create index if not exists idx_customer_alert_snoozes_created_by
  on public.customer_alert_snoozes (created_by);

alter table public.customer_alert_snoozes enable row level security;

create policy customer_alert_snoozes_select_business_member
  on public.customer_alert_snoozes for select to authenticated
  using (public.is_business_member(business_id));

create policy customer_alert_snoozes_insert_business_member
  on public.customer_alert_snoozes for insert to authenticated
  with check ((business_id is not null) and public.is_business_member(business_id));

create policy customer_alert_snoozes_update_business_member
  on public.customer_alert_snoozes for update to authenticated
  using (public.is_business_member(business_id))
  with check ((business_id is not null) and public.is_business_member(business_id));

create policy customer_alert_snoozes_delete_business_member
  on public.customer_alert_snoozes for delete to authenticated
  using (public.is_business_member(business_id));

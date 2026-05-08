-- Phase 1 leads RLS replacement: business-membership scoped policies.
-- Migration file only. Do not apply automatically.

alter table if exists public.leads enable row level security;

drop policy if exists "yardops_leads_select" on public.leads;
drop policy if exists "yardops_leads_update" on public.leads;
drop policy if exists "yardops_leads_delete" on public.leads;

drop policy if exists leads_select_business_member on public.leads;
create policy leads_select_business_member
on public.leads
for select
to authenticated
using (
  business_id is not null
  and public.is_business_member(business_id)
);

drop policy if exists leads_insert_business_member on public.leads;
create policy leads_insert_business_member
on public.leads
for insert
to authenticated
with check (
  business_id is not null
  and public.is_business_member(business_id)
);

drop policy if exists leads_update_business_member on public.leads;
create policy leads_update_business_member
on public.leads
for update
to authenticated
using (
  business_id is not null
  and public.is_business_member(business_id)
)
with check (
  business_id is not null
  and public.is_business_member(business_id)
);

drop policy if exists leads_delete_business_member on public.leads;
create policy leads_delete_business_member
on public.leads
for delete
to authenticated
using (
  business_id is not null
  and public.is_business_member(business_id)
);

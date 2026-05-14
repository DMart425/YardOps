-- Phase 2G cosmetic cleanup: remove redundant business_id IS NOT NULL from
-- leads SELECT and DELETE RLS policy QUAL expressions.
--
-- Context:
--   leads.business_id is already NOT NULL at the schema level (enforced since
--   20260511200000_phase2e_leads_not_null.sql). The redundant check in the
--   USING clause of SELECT/DELETE policies is now cosmetic and inconsistent
--   with other business-owned tables. No behavior change.
--
-- Only leads_select_business_member and leads_delete_business_member are
-- modified. INSERT and UPDATE policies are untouched.

drop policy if exists leads_select_business_member on public.leads;
create policy leads_select_business_member
on public.leads
for select
to authenticated
using (
  public.is_business_member(business_id)
);

drop policy if exists leads_delete_business_member on public.leads;
create policy leads_delete_business_member
on public.leads
for delete
to authenticated
using (
  public.is_business_member(business_id)
);

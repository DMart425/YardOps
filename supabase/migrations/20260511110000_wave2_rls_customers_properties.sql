-- Target project ref: lewzqavgvltzwfeypvam
-- Phase 2D Wave 2: Replace old created_by-scoped RLS policies with business-member scoped policies.
-- Tables: customers, properties
--
-- Context:
--   RLS is already enabled on both tables (confirmed via live pre-apply check 2026-05-11).
--   Old policies were created_by = auth.uid() scoped (single-user model, predating Phase 2).
--   All rows in both tables have business_id set (0 null rows confirmed live 2026-05-11
--   after backfilling one customer row derived from its linked property).
--   This migration drops the old policies and creates business-member scoped replacements.
--   ALTER TABLE ... ENABLE ROW LEVEL SECURITY is included defensively (idempotent if already enabled).
--
-- No NOT NULL constraints are added.
-- No FORCE ROW LEVEL SECURITY is used.

-- ============================================================
-- customers
-- ============================================================

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Drop old single-user policy
DROP POLICY IF EXISTS "owner manage customers" ON public.customers;

-- Drop new policies if re-running (idempotent)
DROP POLICY IF EXISTS customers_select_business_member ON public.customers;
DROP POLICY IF EXISTS customers_insert_business_member ON public.customers;
DROP POLICY IF EXISTS customers_update_business_member ON public.customers;
DROP POLICY IF EXISTS customers_delete_business_member ON public.customers;

CREATE POLICY customers_select_business_member
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY customers_insert_business_member
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE POLICY customers_update_business_member
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (public.is_business_member(business_id))
  WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE POLICY customers_delete_business_member
  ON public.customers
  FOR DELETE
  TO authenticated
  USING (public.is_business_member(business_id));

-- ============================================================
-- properties
-- ============================================================

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Drop old single-user policy
DROP POLICY IF EXISTS "owner manage properties" ON public.properties;

-- Drop new policies if re-running (idempotent)
DROP POLICY IF EXISTS properties_select_business_member ON public.properties;
DROP POLICY IF EXISTS properties_insert_business_member ON public.properties;
DROP POLICY IF EXISTS properties_update_business_member ON public.properties;
DROP POLICY IF EXISTS properties_delete_business_member ON public.properties;

CREATE POLICY properties_select_business_member
  ON public.properties
  FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY properties_insert_business_member
  ON public.properties
  FOR INSERT
  TO authenticated
  WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE POLICY properties_update_business_member
  ON public.properties
  FOR UPDATE
  TO authenticated
  USING (public.is_business_member(business_id))
  WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE POLICY properties_delete_business_member
  ON public.properties
  FOR DELETE
  TO authenticated
  USING (public.is_business_member(business_id));

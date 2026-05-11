-- Target project ref: lewzqavgvltzwfeypvam
-- Phase 2D Wave 3: Replace old created_by-scoped RLS policies with business-member scoped policies.
-- Tables: estimates, estimate_items, jobs
--
-- Context:
--   RLS is already enabled on all three tables (confirmed via live pre-apply check 2026-05-11).
--   Old policies were created_by = auth.uid() scoped to {public} role (single-user model, predating Phase 2).
--   All rows in all three tables have business_id set (0 null rows confirmed live 2026-05-11).
--   This migration drops the old policies and creates business-member scoped replacements.
--   ALTER TABLE ... ENABLE ROW LEVEL SECURITY is included defensively (idempotent if already enabled).
--
-- IMPORTANT: estimates has a second existing policy that must be preserved:
--   "public read estimate by token" ON public.estimates
--   Scoped to {anon} role. Allows the public quote page (/quote/[token]) to read estimates by
--   public_token without authentication. This policy is NOT dropped or modified by this migration.
--
-- No NOT NULL constraints are added.
-- No FORCE ROW LEVEL SECURITY is used.

-- ============================================================
-- estimates
-- ============================================================

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

-- Drop old single-user policy (scoped to {public} role, created_by = auth.uid())
DROP POLICY IF EXISTS "owner manage estimates" ON public.estimates;

-- Drop new policies if re-running (idempotent)
DROP POLICY IF EXISTS estimates_select_business_member ON public.estimates;
DROP POLICY IF EXISTS estimates_insert_business_member ON public.estimates;
DROP POLICY IF EXISTS estimates_update_business_member ON public.estimates;
DROP POLICY IF EXISTS estimates_delete_business_member ON public.estimates;

CREATE POLICY estimates_select_business_member
  ON public.estimates
  FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY estimates_insert_business_member
  ON public.estimates
  FOR INSERT
  TO authenticated
  WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE POLICY estimates_update_business_member
  ON public.estimates
  FOR UPDATE
  TO authenticated
  USING (public.is_business_member(business_id))
  WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE POLICY estimates_delete_business_member
  ON public.estimates
  FOR DELETE
  TO authenticated
  USING (public.is_business_member(business_id));

-- NOTE: "public read estimate by token" (anon role) is intentionally preserved.

-- ============================================================
-- estimate_items
-- ============================================================

ALTER TABLE public.estimate_items ENABLE ROW LEVEL SECURITY;

-- Drop old single-user policy
DROP POLICY IF EXISTS "owner manage estimate_items" ON public.estimate_items;

-- Drop new policies if re-running (idempotent)
DROP POLICY IF EXISTS estimate_items_select_business_member ON public.estimate_items;
DROP POLICY IF EXISTS estimate_items_insert_business_member ON public.estimate_items;
DROP POLICY IF EXISTS estimate_items_update_business_member ON public.estimate_items;
DROP POLICY IF EXISTS estimate_items_delete_business_member ON public.estimate_items;

CREATE POLICY estimate_items_select_business_member
  ON public.estimate_items
  FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY estimate_items_insert_business_member
  ON public.estimate_items
  FOR INSERT
  TO authenticated
  WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE POLICY estimate_items_update_business_member
  ON public.estimate_items
  FOR UPDATE
  TO authenticated
  USING (public.is_business_member(business_id))
  WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE POLICY estimate_items_delete_business_member
  ON public.estimate_items
  FOR DELETE
  TO authenticated
  USING (public.is_business_member(business_id));

-- ============================================================
-- jobs
-- ============================================================

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Drop old single-user policy
DROP POLICY IF EXISTS "owner manage jobs" ON public.jobs;

-- Drop new policies if re-running (idempotent)
DROP POLICY IF EXISTS jobs_select_business_member ON public.jobs;
DROP POLICY IF EXISTS jobs_insert_business_member ON public.jobs;
DROP POLICY IF EXISTS jobs_update_business_member ON public.jobs;
DROP POLICY IF EXISTS jobs_delete_business_member ON public.jobs;

CREATE POLICY jobs_select_business_member
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY jobs_insert_business_member
  ON public.jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE POLICY jobs_update_business_member
  ON public.jobs
  FOR UPDATE
  TO authenticated
  USING (public.is_business_member(business_id))
  WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE POLICY jobs_delete_business_member
  ON public.jobs
  FOR DELETE
  TO authenticated
  USING (public.is_business_member(business_id));

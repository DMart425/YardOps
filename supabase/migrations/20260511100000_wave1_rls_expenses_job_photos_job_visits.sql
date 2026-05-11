-- Target project ref: lewzqavgvltzwfeypvam
-- Phase 2D Wave 1: Replace old user_id-scoped RLS policies with business-member scoped policies.
-- Tables: expenses, job_photos, job_visits
--
-- Context:
--   RLS is already enabled on all three tables (confirmed via live pre-apply check 2026-05-11).
--   Old policies were user_id / created_by scoped (single-user model, predating Phase 2).
--   All rows in these tables have business_id set (0 null rows confirmed live 2026-05-11).
--   This migration drops the old policies and creates business-member scoped replacements.
--   ALTER TABLE ... ENABLE ROW LEVEL SECURITY is included defensively (idempotent if already enabled).
--
-- No NOT NULL constraints are added.
-- No FORCE ROW LEVEL SECURITY is used.

-- ============================================================
-- expenses
-- ============================================================

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Drop old single-user policy
DROP POLICY IF EXISTS "owner manage expenses" ON public.expenses;

-- Drop new policies if re-running (idempotent)
DROP POLICY IF EXISTS expenses_select_business_member ON public.expenses;
DROP POLICY IF EXISTS expenses_insert_business_member ON public.expenses;
DROP POLICY IF EXISTS expenses_update_business_member ON public.expenses;
DROP POLICY IF EXISTS expenses_delete_business_member ON public.expenses;

CREATE POLICY expenses_select_business_member
  ON public.expenses
  FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY expenses_insert_business_member
  ON public.expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE POLICY expenses_update_business_member
  ON public.expenses
  FOR UPDATE
  TO authenticated
  USING (public.is_business_member(business_id))
  WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE POLICY expenses_delete_business_member
  ON public.expenses
  FOR DELETE
  TO authenticated
  USING (public.is_business_member(business_id));

-- ============================================================
-- job_photos
-- ============================================================

ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;

-- Drop old single-user policies
DROP POLICY IF EXISTS "owner delete job_photos" ON public.job_photos;
DROP POLICY IF EXISTS "owner insert job_photos" ON public.job_photos;
DROP POLICY IF EXISTS "owner select job_photos" ON public.job_photos;

-- Drop new policies if re-running (idempotent)
DROP POLICY IF EXISTS job_photos_select_business_member ON public.job_photos;
DROP POLICY IF EXISTS job_photos_insert_business_member ON public.job_photos;
DROP POLICY IF EXISTS job_photos_delete_business_member ON public.job_photos;

CREATE POLICY job_photos_select_business_member
  ON public.job_photos
  FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY job_photos_insert_business_member
  ON public.job_photos
  FOR INSERT
  TO authenticated
  WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE POLICY job_photos_delete_business_member
  ON public.job_photos
  FOR DELETE
  TO authenticated
  USING (public.is_business_member(business_id));

-- No UPDATE policy: no app code path updates job_photos records.

-- ============================================================
-- job_visits
-- ============================================================

ALTER TABLE public.job_visits ENABLE ROW LEVEL SECURITY;

-- Drop old single-user policy
DROP POLICY IF EXISTS "owner manage job_visits" ON public.job_visits;

-- Drop new policies if re-running (idempotent)
DROP POLICY IF EXISTS job_visits_select_business_member ON public.job_visits;
DROP POLICY IF EXISTS job_visits_insert_business_member ON public.job_visits;
DROP POLICY IF EXISTS job_visits_delete_business_member ON public.job_visits;

CREATE POLICY job_visits_select_business_member
  ON public.job_visits
  FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY job_visits_insert_business_member
  ON public.job_visits
  FOR INSERT
  TO authenticated
  WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE POLICY job_visits_delete_business_member
  ON public.job_visits
  FOR DELETE
  TO authenticated
  USING (public.is_business_member(business_id));

-- No UPDATE policy: no app code path updates job_visits records.

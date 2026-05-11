-- Target project ref: lewzqavgvltzwfeypvam
-- Phase 2D Wave 4: Replace old user_id-scoped RLS policies with business-member scoped policies.
-- Tables: equipment, maintenance_items, customer_portal_tokens
--
-- Context:
--   RLS is already enabled on all three tables (confirmed via live pre-apply check 2026-05-11).
--   Old policies were user_id = auth.uid() scoped to {public} role (single-user model, predating Phase 2).
--   All rows in all three tables have business_id set (0 null rows confirmed live 2026-05-11
--   after backfilling one equipment row and its two linked maintenance_items).
--   This migration drops the old policies and creates business-member scoped replacements.
--   ALTER TABLE ... ENABLE ROW LEVEL SECURITY is included defensively (idempotent if already enabled).
--
-- customer_portal_tokens had two old policies to drop:
--   "owner_manage_portal_tokens" — user_id/created_by scoped ALL policy
--   "public_read_by_token"       — qual: true open-read SELECT policy (overly broad, dropped intentionally)
--   The portal route (/portal/[token]) reads tokens via admin client which bypasses RLS, so the
--   open-read policy is not needed and should not be preserved.
--
-- No UPDATE policy is created for customer_portal_tokens: no app code path updates portal tokens;
-- upsert in getOrCreatePortalToken uses ignoreDuplicates: true which does not issue an UPDATE.
--
-- No NOT NULL constraints are added.
-- No FORCE ROW LEVEL SECURITY is used.

-- ============================================================
-- equipment
-- ============================================================

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

-- Drop old single-user policy
DROP POLICY IF EXISTS "owner manage equipment" ON public.equipment;

-- Drop new policies if re-running (idempotent)
DROP POLICY IF EXISTS equipment_select_business_member ON public.equipment;
DROP POLICY IF EXISTS equipment_insert_business_member ON public.equipment;
DROP POLICY IF EXISTS equipment_update_business_member ON public.equipment;
DROP POLICY IF EXISTS equipment_delete_business_member ON public.equipment;

CREATE POLICY equipment_select_business_member
  ON public.equipment
  FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY equipment_insert_business_member
  ON public.equipment
  FOR INSERT
  TO authenticated
  WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE POLICY equipment_update_business_member
  ON public.equipment
  FOR UPDATE
  TO authenticated
  USING (public.is_business_member(business_id))
  WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE POLICY equipment_delete_business_member
  ON public.equipment
  FOR DELETE
  TO authenticated
  USING (public.is_business_member(business_id));

-- ============================================================
-- maintenance_items
-- ============================================================

ALTER TABLE public.maintenance_items ENABLE ROW LEVEL SECURITY;

-- Drop old single-user policy
DROP POLICY IF EXISTS "owner manage maintenance_items" ON public.maintenance_items;

-- Drop new policies if re-running (idempotent)
DROP POLICY IF EXISTS maintenance_items_select_business_member ON public.maintenance_items;
DROP POLICY IF EXISTS maintenance_items_insert_business_member ON public.maintenance_items;
DROP POLICY IF EXISTS maintenance_items_update_business_member ON public.maintenance_items;
DROP POLICY IF EXISTS maintenance_items_delete_business_member ON public.maintenance_items;

CREATE POLICY maintenance_items_select_business_member
  ON public.maintenance_items
  FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY maintenance_items_insert_business_member
  ON public.maintenance_items
  FOR INSERT
  TO authenticated
  WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE POLICY maintenance_items_update_business_member
  ON public.maintenance_items
  FOR UPDATE
  TO authenticated
  USING (public.is_business_member(business_id))
  WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE POLICY maintenance_items_delete_business_member
  ON public.maintenance_items
  FOR DELETE
  TO authenticated
  USING (public.is_business_member(business_id));

-- ============================================================
-- customer_portal_tokens
-- ============================================================

ALTER TABLE public.customer_portal_tokens ENABLE ROW LEVEL SECURITY;

-- Drop old policies (both must be removed)
-- "owner_manage_portal_tokens": user_id/created_by scoped ALL policy
-- "public_read_by_token": open SELECT with qual: true — intentionally dropped, not preserved
DROP POLICY IF EXISTS "owner_manage_portal_tokens" ON public.customer_portal_tokens;
DROP POLICY IF EXISTS "public_read_by_token" ON public.customer_portal_tokens;

-- Drop new policies if re-running (idempotent)
DROP POLICY IF EXISTS customer_portal_tokens_select_business_member ON public.customer_portal_tokens;
DROP POLICY IF EXISTS customer_portal_tokens_insert_business_member ON public.customer_portal_tokens;
DROP POLICY IF EXISTS customer_portal_tokens_delete_business_member ON public.customer_portal_tokens;

CREATE POLICY customer_portal_tokens_select_business_member
  ON public.customer_portal_tokens
  FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY customer_portal_tokens_insert_business_member
  ON public.customer_portal_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE POLICY customer_portal_tokens_delete_business_member
  ON public.customer_portal_tokens
  FOR DELETE
  TO authenticated
  USING (public.is_business_member(business_id));

-- No UPDATE policy: no app code path updates customer_portal_tokens.
-- getOrCreatePortalToken uses upsert with ignoreDuplicates: true, which does not issue an UPDATE.
-- The portal route (/portal/[token]) reads tokens via admin client, bypassing RLS entirely.

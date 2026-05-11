-- Target project ref: lewzqavgvltzwfeypvam
-- Phase 2D Wave 7 (Final): Replace old RLS policies on parcels and brief_settings.
-- Tables: parcels, brief_settings
--
-- Context:
--   RLS is already enabled on both tables (confirmed via live pre-apply check 2026-05-11).
--
-- parcels:
--   Shared/reference geodata — 60,953 rows from Houston County, AL GIS import.
--   Three live policies found (none tracked in local migration history):
--     "authenticated read all parcels" — SELECT, {public}, auth.role() = 'authenticated'::text
--       Old-style read policy using auth.role() check rather than TO authenticated role.
--       Dropped and replaced with cleaner parcels_select_authenticated policy.
--     "owner manage parcels" — ALL, {public}, created_by = auth.uid()
--       Dead policy: created_by is NULL on all 60,953 rows. Dropped.
--     "service role all parcels" — ALL, {public}, auth.role() = 'service_role'::text
--       *** PRESERVED — DO NOT DROP ***
--       Required for service-role parcel imports and GIS admin tooling.
--       This migration intentionally does not touch this policy.
--   No app code writes parcels via authenticated client; all imports use service role.
--   New policy: authenticated SELECT-only with USING (true) — any authenticated user
--   can search parcels, matching the parcel_sources pattern.
--
-- brief_settings:
--   User-owned settings table — 0 rows (table exists but no data written yet).
--   One old ALL-on-public policy using bare auth.uid() (not tracked in local migrations):
--     "owner manage brief_settings" — ALL, {public}, user_id = auth.uid()
--   Dropped and replaced with four user-scoped policies.
--   user_id uuid NOT NULL — ownership column confirmed.
--   No business_id column — intentionally user-scoped (same model as pricing_settings).
--   No app code currently writes to brief_settings but the table and TypeScript interface
--   (BriefSettings in database.ts) exist. Full CRUD policies added for future use.
--
-- This migration does NOT use public.is_business_member().
-- This migration does NOT modify any Waves 1–6 tables.
-- No NOT NULL constraints are added.
-- No FORCE ROW LEVEL SECURITY is used.

-- ============================================================
-- parcels
-- ============================================================

ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;

-- Drop old policies
-- "authenticated read all parcels": old-style SELECT using auth.role() check on {public}
-- "owner manage parcels": dead ALL policy (created_by is NULL on all rows)
-- *** DO NOT DROP "service role all parcels" — it is required for parcel imports ***
DROP POLICY IF EXISTS "authenticated read all parcels" ON public.parcels;
DROP POLICY IF EXISTS "owner manage parcels" ON public.parcels;

-- Drop new policy if re-running (idempotent)
DROP POLICY IF EXISTS parcels_select_authenticated ON public.parcels;

CREATE POLICY parcels_select_authenticated
  ON public.parcels
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT, UPDATE, or DELETE policies for authenticated users.
-- Parcel data is managed exclusively via service-role imports and admin tooling.
-- The existing "service role all parcels" policy covers all service-role write access.

-- ============================================================
-- brief_settings
-- ============================================================

ALTER TABLE public.brief_settings ENABLE ROW LEVEL SECURITY;

-- Drop old single-user policy (ALL on {public}, bare auth.uid())
DROP POLICY IF EXISTS "owner manage brief_settings" ON public.brief_settings;

-- Drop new policies if re-running (idempotent)
DROP POLICY IF EXISTS brief_settings_select_own ON public.brief_settings;
DROP POLICY IF EXISTS brief_settings_insert_own ON public.brief_settings;
DROP POLICY IF EXISTS brief_settings_update_own ON public.brief_settings;
DROP POLICY IF EXISTS brief_settings_delete_own ON public.brief_settings;

CREATE POLICY brief_settings_select_own
  ON public.brief_settings
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY brief_settings_insert_own
  ON public.brief_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY brief_settings_update_own
  ON public.brief_settings
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY brief_settings_delete_own
  ON public.brief_settings
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

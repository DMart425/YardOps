-- Target project ref: lewzqavgvltzwfeypvam
-- Phase 2D Wave 6: Replace old ALL-on-public RLS policies with user-scoped policies.
-- Tables: pricing_settings, profiles, push_subscriptions
--
-- Context:
--   RLS is already enabled on all three tables (confirmed via live pre-apply check 2026-05-11).
--   Each table has one old ALL policy on the {public} role using bare auth.uid() (predating Phase 2).
--   None of the old policies were tracked in local migration history.
--   Row counts: 1 each. No backfill required.
--   These tables are intentionally user-scoped, NOT business-member scoped:
--     - pricing_settings: one row per user; all app code filters by user_id; upsert conflict on user_id
--     - profiles: primary key IS the user's auth.uid(); managed by handle_new_user() trigger
--     - push_subscriptions: device/user credentials; each device belongs to a specific user
--   Old policies to drop (exact live names confirmed 2026-05-11):
--     "owner manage pricing_settings" on pricing_settings — ALL, {public}, bare auth.uid()
--     "owner manage profile"          on profiles         — ALL, {public}, bare auth.uid() (singular "profile")
--     push_subscriptions_owner_all    on push_subscriptions — ALL, {public}, bare auth.uid()
--   ALTER TABLE ... ENABLE ROW LEVEL SECURITY is included defensively (idempotent if already enabled).
--
-- pricing_settings:
--   CREATE: SELECT, INSERT, UPDATE, DELETE (user fully manages own settings row)
--
-- profiles:
--   CREATE: SELECT, UPDATE only.
--   No INSERT: handle_new_user() is SECURITY DEFINER and bypasses RLS; it creates the profile row.
--   No DELETE: cascade from auth.users handles deletion; no app code path directly deletes profiles.
--
-- push_subscriptions:
--   CREATE: SELECT, INSERT, DELETE only.
--   No UPDATE: all updates (last_used_at, stale removal) are done exclusively via admin client
--   in lib/push.ts, which bypasses RLS. No authenticated UPDATE path exists in app code.
--
-- No NOT NULL constraints are added.
-- No FORCE ROW LEVEL SECURITY is used.

-- ============================================================
-- pricing_settings
-- ============================================================

ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;

-- Drop old single-user policy (ALL on {public}, bare auth.uid())
DROP POLICY IF EXISTS "owner manage pricing_settings" ON public.pricing_settings;

-- Drop new policies if re-running (idempotent)
DROP POLICY IF EXISTS pricing_settings_select_own ON public.pricing_settings;
DROP POLICY IF EXISTS pricing_settings_insert_own ON public.pricing_settings;
DROP POLICY IF EXISTS pricing_settings_update_own ON public.pricing_settings;
DROP POLICY IF EXISTS pricing_settings_delete_own ON public.pricing_settings;

CREATE POLICY pricing_settings_select_own
  ON public.pricing_settings
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY pricing_settings_insert_own
  ON public.pricing_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY pricing_settings_update_own
  ON public.pricing_settings
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY pricing_settings_delete_own
  ON public.pricing_settings
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================
-- profiles
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop old single-user policy (ALL on {public}, bare auth.uid())
-- Note: policy name is singular "owner manage profile", not "owner manage profiles"
DROP POLICY IF EXISTS "owner manage profile" ON public.profiles;

-- Drop new policies if re-running (idempotent)
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- No INSERT policy: handle_new_user() trigger is SECURITY DEFINER and bypasses RLS.
-- No DELETE policy: cascade from auth.users handles deletion; no app code path deletes profiles directly.

-- ============================================================
-- push_subscriptions
-- ============================================================

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop old single-user policy (ALL on {public}, bare auth.uid())
-- Note: policy name uses underscore style: push_subscriptions_owner_all
DROP POLICY IF EXISTS push_subscriptions_owner_all ON public.push_subscriptions;

-- Drop new policies if re-running (idempotent)
DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_insert_own ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;

CREATE POLICY push_subscriptions_select_own
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY push_subscriptions_insert_own
  ON public.push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY push_subscriptions_delete_own
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- No UPDATE policy: all updates (last_used_at timestamp, stale subscription removal) are performed
-- exclusively via admin client in lib/push.ts, which bypasses RLS. No authenticated UPDATE path exists.

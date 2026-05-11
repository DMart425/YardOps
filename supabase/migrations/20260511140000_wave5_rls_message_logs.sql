-- Target project ref: lewzqavgvltzwfeypvam
-- Phase 2D Wave 5: Replace old user_id-scoped RLS policies with business-member scoped policies.
-- Table: message_logs
--
-- Context:
--   RLS is already enabled on message_logs (confirmed via live pre-apply check 2026-05-11).
--   Three old policies exist live:
--     "owner manage message_logs" — user_id = auth.uid() ALL policy on {public} role (bare auth.uid(), predates Phase 2)
--     message_logs_select_own    — user_id = (select auth.uid()) SELECT on {authenticated}
--     message_logs_insert_own    — user_id = (select auth.uid()) INSERT on {authenticated}
--   "owner manage message_logs" was not tracked in local migration history but was confirmed live via
--   pre-apply SQL check 2026-05-11. It is the original single-user model policy that was not cleaned up
--   when 20260504134500_message_logs_rls_tightening.sql ran (that migration dropped the two broad
--   "auth users can..." policies but not this one).
--   Table has 0 rows and 0 null business_id rows (confirmed live 2026-05-11). No backfill required.
--   This migration drops all three old policies and creates business-member scoped replacements.
--   ALTER TABLE ... ENABLE ROW LEVEL SECURITY is included defensively (idempotent if already enabled).
--
-- No UPDATE policy is created: message logs are immutable. No app code path updates message_logs.
--
-- No NOT NULL constraints are added.
-- No FORCE ROW LEVEL SECURITY is used.

-- ============================================================
-- message_logs
-- ============================================================

ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

-- Drop old policies (all three must be removed)
-- "owner manage message_logs": bare auth.uid() ALL policy on {public} role — predates Phase 2
-- message_logs_select_own: user_id scoped SELECT on {authenticated}
-- message_logs_insert_own: user_id scoped INSERT on {authenticated}
DROP POLICY IF EXISTS "owner manage message_logs" ON public.message_logs;
DROP POLICY IF EXISTS message_logs_select_own ON public.message_logs;
DROP POLICY IF EXISTS message_logs_insert_own ON public.message_logs;

-- Drop new policies if re-running (idempotent)
DROP POLICY IF EXISTS message_logs_select_business_member ON public.message_logs;
DROP POLICY IF EXISTS message_logs_insert_business_member ON public.message_logs;
DROP POLICY IF EXISTS message_logs_delete_business_member ON public.message_logs;

CREATE POLICY message_logs_select_business_member
  ON public.message_logs
  FOR SELECT
  TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY message_logs_insert_business_member
  ON public.message_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE POLICY message_logs_delete_business_member
  ON public.message_logs
  FOR DELETE
  TO authenticated
  USING (public.is_business_member(business_id));

-- No UPDATE policy: message logs are immutable. No app code path updates message_logs records.

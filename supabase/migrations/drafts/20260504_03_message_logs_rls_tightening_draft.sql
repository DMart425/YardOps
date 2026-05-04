-- DRAFT ONLY - REVIEW BEFORE APPLYING
-- Target project ref: lewzqavgvltzwfeypvam
-- Do NOT run against: kugpjudlgxhxgxnxmeli
-- Purpose: tighten message_logs policies to owner-scoped access.

alter table if exists public.message_logs enable row level security;

-- Remove broad authenticated SELECT/INSERT policies (dynamic so names do not have to match exactly).
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'message_logs'
      AND cmd in ('SELECT', 'INSERT')
      AND 'authenticated' = ANY (roles)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.message_logs;', pol.policyname);
  END LOOP;
END $$;

-- Recreate explicit owner-scoped policies.
DROP POLICY IF EXISTS message_logs_select_own ON public.message_logs;
CREATE POLICY message_logs_select_own
ON public.message_logs
FOR SELECT
TO authenticated
USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS message_logs_insert_own ON public.message_logs;
CREATE POLICY message_logs_insert_own
ON public.message_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = (select auth.uid()));

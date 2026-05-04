-- DRAFT ONLY - REVIEW BEFORE APPLYING
-- Target project ref: lewzqavgvltzwfeypvam
-- Do NOT run against: kugpjudlgxhxgxnxmeli
-- Purpose: tighten message_logs policies to owner-scoped access.

alter table if exists public.message_logs enable row level security;

-- Remove currently verified broad authenticated policies explicitly.
drop policy if exists "auth users can insert message_logs" on public.message_logs;
drop policy if exists "auth users can select message_logs" on public.message_logs;

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

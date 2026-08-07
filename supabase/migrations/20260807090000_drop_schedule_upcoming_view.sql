-- Target project ref: lewzqavgvltzwfeypvam
-- Resolve Supabase Advisor CRITICAL: "Security Definer View" on
-- public.schedule_upcoming.
--
-- The view joined job_visits + jobs + customers + properties (customer names,
-- service addresses, upcoming schedule), executed with owner permissions
-- (no security_invoker → RLS on all four base tables bypassed), and its ACL
-- granted full privileges to anon — dumpable by any holder of the public
-- anon key via PostgREST.
--
-- No app code references this view (verified: zero usages outside generated
-- types and docs). Dropping it, per the 2026-05-04 hardening draft's own
-- recommendation to prefer app-layer queries against RLS-protected tables.
--
-- Scope: 1 unused view dropped. No tables, data, RLS, functions, or
--        triggers modified.
-- Rollback: recreate the view from the definition preserved in the
--           20260504_05 draft / git history (fully reversible).

DROP VIEW IF EXISTS public.schedule_upcoming;

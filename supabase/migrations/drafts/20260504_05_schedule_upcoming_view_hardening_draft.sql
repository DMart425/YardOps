-- DRAFT ONLY - REVIEW BEFORE APPLYING
-- Target project ref: lewzqavgvltzwfeypvam
-- Do NOT run against: kugpjudlgxhxgxnxmeli
-- Purpose: review and harden public.schedule_upcoming exposure.

-- Attempt to set SECURITY INVOKER mode when supported.
-- If the runtime does not support the option or the view does not exist, this block is a no-op with NOTICE.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'schedule_upcoming'
      AND c.relkind = 'v'
  ) THEN
    BEGIN
      EXECUTE 'ALTER VIEW public.schedule_upcoming SET (security_invoker = true)';
      RAISE NOTICE 'Applied: schedule_upcoming set to security_invoker=true';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not set security_invoker on public.schedule_upcoming. Recommend replacing view with app-layer queries against base tables.';
    END;
  ELSE
    RAISE NOTICE 'public.schedule_upcoming view not found; no change.';
  END IF;
END $$;

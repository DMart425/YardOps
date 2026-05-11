-- Target project ref: lewzqavgvltzwfeypvam
-- Phase 2E Group 3: NOT NULL hardening for core operations tables.
-- Tables: customers, properties, estimates, jobs, expenses, message_logs
--
-- Context:
--   All six tables have 0 null business_id rows (confirmed via live pre-check 2026-05-11).
--   All six business_id FKs currently use ON DELETE SET NULL (confirmed).
--   ON DELETE SET NULL is incompatible with NOT NULL — a SET NULL action on a
--   NOT NULL column would cause a constraint violation when a business is deleted.
--   Each FK is therefore dropped and recreated with ON DELETE RESTRICT before
--   the NOT NULL constraint is applied.
--
-- FK constraint names (confirmed from live pg catalog 2026-05-11):
--   customers_business_id_fkey
--   properties_business_id_fkey
--   estimates_business_id_fkey
--   jobs_business_id_fkey
--   expenses_business_id_fkey
--   message_logs_business_id_fkey
--
-- This migration does NOT:
--   - touch leads (deferred — external insert path unverified)
--   - touch Group 1 tables (estimate_items, job_visits, customer_portal_tokens, job_photos)
--   - touch Group 2 tables (equipment, maintenance_items)
--   - change RLS policies
--   - backfill data
--   - modify any app code

-- ============================================================
-- customers
-- ============================================================

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_business_id_fkey;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE RESTRICT;

ALTER TABLE public.customers
  ALTER COLUMN business_id SET NOT NULL;

-- ============================================================
-- properties
-- ============================================================

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_business_id_fkey;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE RESTRICT;

ALTER TABLE public.properties
  ALTER COLUMN business_id SET NOT NULL;

-- ============================================================
-- estimates
-- ============================================================

ALTER TABLE public.estimates
  DROP CONSTRAINT IF EXISTS estimates_business_id_fkey;

ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE RESTRICT;

ALTER TABLE public.estimates
  ALTER COLUMN business_id SET NOT NULL;

-- ============================================================
-- jobs
-- ============================================================

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_business_id_fkey;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE RESTRICT;

ALTER TABLE public.jobs
  ALTER COLUMN business_id SET NOT NULL;

-- ============================================================
-- expenses
-- ============================================================

ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_business_id_fkey;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE RESTRICT;

ALTER TABLE public.expenses
  ALTER COLUMN business_id SET NOT NULL;

-- ============================================================
-- message_logs
-- ============================================================

ALTER TABLE public.message_logs
  DROP CONSTRAINT IF EXISTS message_logs_business_id_fkey;

ALTER TABLE public.message_logs
  ADD CONSTRAINT message_logs_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE RESTRICT;

ALTER TABLE public.message_logs
  ALTER COLUMN business_id SET NOT NULL;

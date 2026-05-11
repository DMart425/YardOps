-- Target project ref: lewzqavgvltzwfeypvam
-- Phase 2E Group 1: NOT NULL hardening for empty/supporting tables.
-- Tables: estimate_items, job_visits, customer_portal_tokens, job_photos
--
-- Context:
--   All four tables have zero rows (confirmed via live pre-check 2026-05-11).
--   All four have zero null business_id values (confirmed).
--   All four business_id FKs currently use ON DELETE SET NULL (confirmed).
--   ON DELETE SET NULL is incompatible with NOT NULL — a SET NULL action on a
--   NOT NULL column would cause a constraint violation when a business is deleted.
--   Each FK is therefore dropped and recreated with ON DELETE RESTRICT before
--   the NOT NULL constraint is applied.
--
-- FK constraint names (confirmed from live pg catalog 2026-05-11):
--   estimate_items_business_id_fkey
--   job_visits_business_id_fkey
--   customer_portal_tokens_business_id_fkey
--   job_photos_business_id_fkey
--
-- This migration does NOT:
--   - touch leads (deferred — external insert path unverified)
--   - touch Group 2 tables (equipment, maintenance_items)
--   - touch Group 3 tables (customers, properties, estimates, jobs, expenses, message_logs)
--   - change RLS policies
--   - backfill data
--   - modify any app code

-- ============================================================
-- estimate_items
-- ============================================================

ALTER TABLE public.estimate_items
  DROP CONSTRAINT IF EXISTS estimate_items_business_id_fkey;

ALTER TABLE public.estimate_items
  ADD CONSTRAINT estimate_items_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE RESTRICT;

ALTER TABLE public.estimate_items
  ALTER COLUMN business_id SET NOT NULL;

-- ============================================================
-- job_visits
-- ============================================================

ALTER TABLE public.job_visits
  DROP CONSTRAINT IF EXISTS job_visits_business_id_fkey;

ALTER TABLE public.job_visits
  ADD CONSTRAINT job_visits_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE RESTRICT;

ALTER TABLE public.job_visits
  ALTER COLUMN business_id SET NOT NULL;

-- ============================================================
-- customer_portal_tokens
-- ============================================================

ALTER TABLE public.customer_portal_tokens
  DROP CONSTRAINT IF EXISTS customer_portal_tokens_business_id_fkey;

ALTER TABLE public.customer_portal_tokens
  ADD CONSTRAINT customer_portal_tokens_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE RESTRICT;

ALTER TABLE public.customer_portal_tokens
  ALTER COLUMN business_id SET NOT NULL;

-- ============================================================
-- job_photos
-- ============================================================

ALTER TABLE public.job_photos
  DROP CONSTRAINT IF EXISTS job_photos_business_id_fkey;

ALTER TABLE public.job_photos
  ADD CONSTRAINT job_photos_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE RESTRICT;

ALTER TABLE public.job_photos
  ALTER COLUMN business_id SET NOT NULL;

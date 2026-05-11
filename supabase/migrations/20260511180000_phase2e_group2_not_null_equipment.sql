-- Target project ref: lewzqavgvltzwfeypvam
-- Phase 2E Group 2: NOT NULL hardening for equipment and maintenance_items.
--
-- Context:
--   Both tables have non-zero row counts (confirmed via live pre-check 2026-05-11):
--     equipment:         5 rows, 0 null business_id
--     maintenance_items: 15 rows, 0 null business_id
--   Both business_id FKs currently use ON DELETE SET NULL (confirmed).
--   ON DELETE SET NULL is incompatible with NOT NULL — a SET NULL action on a
--   NOT NULL column would cause a constraint violation when a business is deleted.
--   Each FK is therefore dropped and recreated with ON DELETE RESTRICT before
--   the NOT NULL constraint is applied.
--
-- FK constraint names (confirmed from live pg catalog 2026-05-11):
--   equipment_business_id_fkey
--   maintenance_items_business_id_fkey
--
-- App insert paths verified to set business_id:
--   equipment/actions.ts::createEquipment()
--   equipment/actions.ts::addMaintenanceItem()
--
-- This migration does NOT:
--   - touch leads (deferred — external insert path unverified)
--   - touch Group 1 tables (estimate_items, job_visits, customer_portal_tokens, job_photos)
--   - touch Group 3 tables (customers, properties, estimates, jobs, expenses, message_logs)
--   - change RLS policies
--   - backfill data
--   - modify any app code

-- ============================================================
-- equipment
-- ============================================================

ALTER TABLE public.equipment
  DROP CONSTRAINT IF EXISTS equipment_business_id_fkey;

ALTER TABLE public.equipment
  ADD CONSTRAINT equipment_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE RESTRICT;

ALTER TABLE public.equipment
  ALTER COLUMN business_id SET NOT NULL;

-- ============================================================
-- maintenance_items
-- ============================================================

ALTER TABLE public.maintenance_items
  DROP CONSTRAINT IF EXISTS maintenance_items_business_id_fkey;

ALTER TABLE public.maintenance_items
  ADD CONSTRAINT maintenance_items_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE RESTRICT;

ALTER TABLE public.maintenance_items
  ALTER COLUMN business_id SET NOT NULL;

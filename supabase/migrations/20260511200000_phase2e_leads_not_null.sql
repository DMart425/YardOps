-- Target project ref: lewzqavgvltzwfeypvam
-- Phase 2E leads: NOT NULL hardening for public.leads.business_id
--
-- Context:
--   public.leads has 9 total rows, 0 null business_id rows (confirmed via live
--   read-only audit 2026-05-11). All existing leads use business_id
--   fc6b0c9b-b95d-4de8-8c22-aca6ceb9ff60.
--   WicksburgLawnService public intake now writes business_id via
--   YARDOPS_INTAKE_BUSINESS_ID env var (confirmed 2026-05-11).
--   leads.business_id FK currently uses ON DELETE SET NULL (confirmed).
--   ON DELETE SET NULL is incompatible with NOT NULL — a SET NULL action on a
--   NOT NULL column would cause a constraint violation when a business is deleted.
--   The FK is therefore dropped and recreated with ON DELETE RESTRICT before
--   the NOT NULL constraint is applied.
--   RLS policies already require business_id IS NOT NULL on insert/update —
--   no RLS changes needed.
--
-- FK constraint name: leads_business_id_fkey (confirmed from live pg catalog)
--
-- This migration does NOT:
--   - touch any table other than public.leads
--   - change RLS policies
--   - backfill data (0 null rows — no backfill required)
--   - modify any app code
--   - touch WicksburgLawnService

-- ============================================================
-- leads
-- ============================================================

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_business_id_fkey;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_business_id_fkey
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE RESTRICT;

ALTER TABLE public.leads
  ALTER COLUMN business_id SET NOT NULL;

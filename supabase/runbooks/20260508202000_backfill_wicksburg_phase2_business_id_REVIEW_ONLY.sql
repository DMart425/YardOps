-- Phase 2B Backfill Runbook: Backfill business_id for Wicksburg Lawn Service
-- REVIEW ONLY - MANUAL EXECUTION REQUIRED
-- Do not run this as a migration. Execute manually after review and approval.
--
-- Context: Phase 2A schema migrations added nullable business_id columns to operational and settings tables.
-- This runbook backfills the Wicksburg business_id where business_id is currently null.
--
-- Wicksburg business_id: fc6b0c9b-b95d-4de8-8c22-aca6ceb9ff60
--
-- Safety Check: Ensure the business exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE id = 'fc6b0c9b-b95d-4de8-8c22-aca6ceb9ff60') THEN
        RAISE EXCEPTION 'Wicksburg business not found. Aborting backfill.';
    END IF;
END $$;

-- Backfill operational tables
UPDATE public.customers
SET business_id = 'fc6b0c9b-b95d-4de8-8c22-aca6ceb9ff60'
WHERE business_id IS NULL;

UPDATE public.properties
SET business_id = 'fc6b0c9b-b95d-4de8-8c22-aca6ceb9ff60'
WHERE business_id IS NULL;

UPDATE public.estimates
SET business_id = 'fc6b0c9b-b95d-4de8-8c22-aca6ceb9ff60'
WHERE business_id IS NULL;

UPDATE public.estimate_items
SET business_id = 'fc6b0c9b-b95d-4de8-8c22-aca6ceb9ff60'
WHERE business_id IS NULL;

UPDATE public.jobs
SET business_id = 'fc6b0c9b-b95d-4de8-8c22-aca6ceb9ff60'
WHERE business_id IS NULL;

UPDATE public.job_visits
SET business_id = 'fc6b0c9b-b95d-4de8-8c22-aca6ceb9ff60'
WHERE business_id IS NULL;

UPDATE public.job_photos
SET business_id = 'fc6b0c9b-b95d-4de8-8c22-aca6ceb9ff60'
WHERE business_id IS NULL;

UPDATE public.expenses
SET business_id = 'fc6b0c9b-b95d-4de8-8c22-aca6ceb9ff60'
WHERE business_id IS NULL;

-- Backfill settings and communication tables
UPDATE public.equipment
SET business_id = 'fc6b0c9b-b95d-4de8-8c22-aca6ceb9ff60'
WHERE business_id IS NULL;

UPDATE public.maintenance_items
SET business_id = 'fc6b0c9b-b95d-4de8-8c22-aca6ceb9ff60'
WHERE business_id IS NULL;

UPDATE public.message_logs
SET business_id = 'fc6b0c9b-b95d-4de8-8c22-aca6ceb9ff60'
WHERE business_id IS NULL;

UPDATE public.customer_portal_tokens
SET business_id = 'fc6b0c9b-b95d-4de8-8c22-aca6ceb9ff60'
WHERE business_id IS NULL;

UPDATE public.pricing_settings
SET business_id = 'fc6b0c9b-b95d-4de8-8c22-aca6ceb9ff60'
WHERE business_id IS NULL;

-- Verification: Check row counts and null business_id counts
SELECT 'customers' as table_name, count(*) as total_rows, count(*) filter (where business_id is null) as null_business_id FROM public.customers
UNION ALL
SELECT 'properties', count(*), count(*) filter (where business_id is null) FROM public.properties
UNION ALL
SELECT 'estimates', count(*), count(*) filter (where business_id is null) FROM public.estimates
UNION ALL
SELECT 'estimate_items', count(*), count(*) filter (where business_id is null) FROM public.estimate_items
UNION ALL
SELECT 'jobs', count(*), count(*) filter (where business_id is null) FROM public.jobs
UNION ALL
SELECT 'job_visits', count(*), count(*) filter (where business_id is null) FROM public.job_visits
UNION ALL
SELECT 'job_photos', count(*), count(*) filter (where business_id is null) FROM public.job_photos
UNION ALL
SELECT 'expenses', count(*), count(*) filter (where business_id is null) FROM public.expenses
UNION ALL
SELECT 'equipment', count(*), count(*) filter (where business_id is null) FROM public.equipment
UNION ALL
SELECT 'maintenance_items', count(*), count(*) filter (where business_id is null) FROM public.maintenance_items
UNION ALL
SELECT 'message_logs', count(*), count(*) filter (where business_id is null) FROM public.message_logs
UNION ALL
SELECT 'customer_portal_tokens', count(*), count(*) filter (where business_id is null) FROM public.customer_portal_tokens
UNION ALL
SELECT 'pricing_settings', count(*), count(*) filter (where business_id is null) FROM public.pricing_settings;
-- Add business_id columns to operational tables
-- Phase 2A: Operational tables (customers, properties, estimates, estimate_items, jobs, job_visits, job_photos, expenses)

-- customers
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_business_id ON public.customers USING btree (business_id);

-- properties
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_properties_business_id ON public.properties USING btree (business_id);

-- estimates
ALTER TABLE public.estimates
ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_estimates_business_id ON public.estimates USING btree (business_id);

-- estimate_items
ALTER TABLE public.estimate_items
ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_estimate_items_business_id ON public.estimate_items USING btree (business_id, estimate_id);

-- jobs
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_business_id ON public.jobs USING btree (business_id);

-- job_visits
ALTER TABLE public.job_visits
ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_visits_business_id ON public.job_visits USING btree (business_id, job_id);

-- job_photos
ALTER TABLE public.job_photos
ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_photos_business_id ON public.job_photos USING btree (business_id, job_id);

-- expenses
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_business_id ON public.expenses USING btree (business_id);
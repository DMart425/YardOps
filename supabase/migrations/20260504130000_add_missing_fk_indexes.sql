-- Target project ref: lewzqavgvltzwfeypvam
-- Purpose: add missing foreign-key helper indexes.
-- Scope: indexes only; no data, RLS, functions, views, or triggers.

create index if not exists idx_customer_portal_tokens_created_by
  on public.customer_portal_tokens (created_by);

create index if not exists idx_estimates_property_id
  on public.estimates (property_id);

create index if not exists idx_job_photos_user_id
  on public.job_photos (user_id);

create index if not exists idx_jobs_customer_id
  on public.jobs (customer_id);

create index if not exists idx_jobs_estimate_id
  on public.jobs (estimate_id);

create index if not exists idx_jobs_next_job_created_id
  on public.jobs (next_job_created_id);

create index if not exists idx_message_logs_property_id
  on public.message_logs (property_id);

create index if not exists idx_parcels_created_by
  on public.parcels (created_by);

create index if not exists idx_properties_parcel_id
  on public.properties (parcel_id);

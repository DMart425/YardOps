-- Phase B.3: lightweight estimate revision tracking fields
-- NOTE: Migration file only. Do not apply automatically.

alter table if exists public.estimates
  add column if not exists revision_number integer not null default 1,
  add column if not exists last_revised_at timestamptz null,
  add column if not exists last_sent_at timestamptz null;
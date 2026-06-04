-- Target project ref: lewzqavgvltzwfeypvam
-- Phase 5X: Add source linkage columns to estimates table.
-- Purpose: Track which completed job prompted an estimate for extra work,
--          and whether converting that estimate should close the job's follow-up slot.
-- Scope: column additions and indexes only.
--        No backfill. No RLS change. No NOT NULL hardening on existing columns.
--        No data, triggers, views, or functions modified.

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS source_job_id uuid
    REFERENCES public.jobs(id) ON DELETE SET NULL;

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS satisfies_follow_up boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_estimates_source_job_id
  ON public.estimates (source_job_id)
  WHERE source_job_id IS NOT NULL;

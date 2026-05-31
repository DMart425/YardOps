-- Phase 5Q.1: Add job_inputs JSONB column to jobs table
-- Purpose: Foundation for explicit per-job service scope and add-on storage.
--          Populated by future phases (5Q.2+) when jobs are created or
--          scheduled as follow-ups. Existing jobs are unaffected (NULL).
-- Nullable, no default, no constraint, no backfill, no RLS change.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_inputs jsonb;

-- Target project ref: lewzqavgvltzwfeypvam
-- Phase 5X.4a: Add sets_property_defaults to estimates.
-- Purpose: Track whether an approved estimate should replace the property's
--          default service agreement for future jobs.
-- Scope: schema-only column addition.
--        No backfill beyond DEFAULT false. No RLS change.
--        No data, triggers, views, or functions modified.

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS sets_property_defaults boolean NOT NULL DEFAULT false;

-- DRAFT ONLY - REVIEW BEFORE APPLYING
-- Target project ref: lewzqavgvltzwfeypvam
-- Do NOT run against: kugpjudlgxhxgxnxmeli
-- Purpose: safest minimal leads RLS posture for this pass.
--
-- IMPORTANT:
-- The leads table currently has no owner/assignee column in known schema context.
-- Tight owner-scoped policies without such a column can break current operations.
--
-- This draft intentionally applies no policy changes yet.
-- It documents risk and sets up a later migration path:
--   1) add created_by/assigned_to column
--   2) backfill ownership
--   3) replace broad authenticated policies with owner/assignee scoped policies

DO $$
BEGIN
  RAISE NOTICE 'Draft only: no leads RLS policy changes applied in this migration.';
  RAISE NOTICE 'Reason: leads lacks owner/assignee column; changing access now may break app workflows.';
END $$;

-- Target project ref: lewzqavgvltzwfeypvam
-- Fix: promote bare unique index to formal UNIQUE constraint on
--      customer_portal_tokens.customer_id.
--
-- Context:
--   getOrCreatePortalToken() uses:
--     .upsert({ ... }, { onConflict: 'customer_id', ignoreDuplicates: true })
--   PostgREST resolves the onConflict parameter against pg_constraint (contype='u').
--   customer_portal_tokens_customer_id_key exists only as a bare CREATE UNIQUE INDEX,
--   which does not create a pg_constraint row. PostgREST therefore cannot resolve the
--   conflict target and rejects the upsert, causing every portal link generation to fail.
--
-- Fix:
--   1. Drop the bare unique index (freeing the name).
--   2. Add a formal UNIQUE constraint with the same name.
--      PostgreSQL will recreate the underlying index as part of the constraint.
--      The constraint will now appear in pg_constraint with contype='u', satisfying
--      PostgREST's validation of the onConflict parameter.
--
-- This migration does NOT:
--   - alter business_id or any other column
--   - change NOT NULL constraints
--   - change RLS or policies
--   - touch any table other than customer_portal_tokens
--   - include Phase 2E Group 2 or Group 3 changes
--   - include leads

DROP INDEX IF EXISTS customer_portal_tokens_customer_id_key;

ALTER TABLE public.customer_portal_tokens
  ADD CONSTRAINT customer_portal_tokens_customer_id_key UNIQUE (customer_id);

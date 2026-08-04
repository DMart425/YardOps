-- Target project ref: lewzqavgvltzwfeypvam
-- Security hardening: close the anon estimate read exposure found in the
-- 2026-08-03 security review.
--
-- 1. Drop the anon "public read estimate by token" SELECT policy on estimates.
--    Live predicate is (public_token IS NOT NULL AND status NOT IN
--    ('expired','declined')) — the token match is NOT in the policy, so any
--    holder of the public anon key can list every active estimate (including
--    each public_token) via PostgREST. No app code path uses this policy:
--    /quote/[token] and /portal/[token] read via the service-role client.
--
-- 2. Revoke EXECUTE on handle_new_user() from PUBLIC. Live ACL still carries
--    an =X/postgres (PUBLIC) grant that anon/authenticated inherit. The
--    function is trigger-only; triggers run as table owner, so the auth
--    signup trigger is unaffected.
--
-- 3. Add the one missing FK covering index (leads.created_by).
--
-- Scope: 1 RLS policy dropped, 1 function ACL revoke, 1 additive index.
--        No data, schema shape, triggers, views, or storage modified.
-- Rollback: recreate the policy / re-grant / drop the index (all reversible).

DROP POLICY IF EXISTS "public read estimate by token" ON public.estimates;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

CREATE INDEX IF NOT EXISTS idx_leads_created_by ON public.leads (created_by);

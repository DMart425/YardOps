# Company Architecture Transition Plan

This document is the current source of truth for transitioning YardOps from user-owned records to company-owned records while preserving current Wicksburg functionality.

## 1. Phase A - Foundation Schema Plan

### Goal
1. Establish tenant foundations without changing behavior.
2. Add company scaffolding and nullable company_id fields.
3. Keep all current Wicksburg flows working exactly as-is.

### Files/tables likely touched
1. Tables: companies, company_members.
2. Tables to add nullable company_id: leads, customers, properties, jobs, estimates, estimate_items, message_logs, pricing_settings, brief_settings, equipment, maintenance_items, expenses, job_photos, job_visits if present, customer_portal_tokens, push_subscriptions.
3. Table decision note: parcels stays shared for now unless product chooses tenant-private parcel cache.

### Execution checklist
1. Define companies table contract and lifecycle states.
2. Define company_members with role, status, default company marker.
3. Add nullable company_id to target tables.
4. Add indexes for future company reads before policy changes.
5. Do not tighten RLS in this phase.

### Risks
1. Migration blast radius if too many tables changed at once.
2. Naming inconsistency between created_by and user_id ownership models.
3. Hidden dependencies in service-role queries that assume single-tenant data.

### Rollback point
1. Drop new tables/columns only if still empty and pre-backfill.
2. If already partially populated, keep schema and pause before Phase B.

### Acceptance criteria
1. New schema objects exist and do not break app reads/writes.
2. All existing app flows still function with null company_id.
3. No RLS policy behavior changed.

### Dry-run validation queries
1. Verify new tables exist:
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('companies','company_members');
2. Verify company_id columns exist and are nullable:
SELECT table_name, column_name, is_nullable FROM information_schema.columns WHERE table_schema='public' AND column_name='company_id' ORDER BY table_name;
3. Verify no accidental non-null constraints yet:
SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='company_id' AND is_nullable='NO';

## 2. Phase B - Backfill Plan

### Goal
1. Create Wicksburg as first company tenant.
2. Attach current operator as owner.
3. Backfill company_id across all target records safely and verifiably.

### Files/tables likely touched
1. Tables: companies, company_members.
2. Backfill targets: leads, customers, properties, jobs, estimates, estimate_items, message_logs, pricing_settings, brief_settings, equipment, maintenance_items, expenses, job_photos, job_visits if present, customer_portal_tokens, push_subscriptions.

### Execution checklist
1. Create single company row for Wicksburg Lawn Service.
2. Insert company_members owner row for current user.
3. Backfill by source-of-truth ownership path:
4. created_by tables -> company via company_members.user_id.
5. user_id tables -> company via company_members.user_id.
6. child tables -> company from parent row when safer.
7. Assign all existing leads to Wicksburg company_id for now.
8. Record any rows that cannot be mapped deterministically.
9. Stop if unresolved rows exist above agreed threshold.

### Risks
1. Incorrect mapping for records without clear owner references.
2. Partial backfill creates mixed-tenant data quality issues.
3. Large-table update locks or long-running operations.

### Rollback point
1. If validation fails, set backfilled company_id values back to null for affected tables only.
2. Keep companies and membership rows; they are low-risk foundation data.

### Acceptance criteria
1. Wicksburg company exists exactly once.
2. Current operator is owner in company_members.
3. All target rows have company_id populated or are in explicit exception list.
4. Exception list is approved before Phase C.

### Dry-run validation queries
1. Company and owner membership:
SELECT c.id, c.name, m.user_id, m.role FROM public.companies c JOIN public.company_members m ON m.company_id = c.id WHERE c.name = 'Wicksburg Lawn Service';
2. Null checks by table:
SELECT count(*) FROM public.customers WHERE company_id IS NULL;
SELECT count(*) FROM public.properties WHERE company_id IS NULL;
SELECT count(*) FROM public.jobs WHERE company_id IS NULL;
SELECT count(*) FROM public.estimates WHERE company_id IS NULL;
SELECT count(*) FROM public.expenses WHERE company_id IS NULL;
3. Consistency check example (jobs vs customers):
SELECT count(*) FROM public.jobs j JOIN public.customers c ON c.id = j.customer_id WHERE j.company_id IS DISTINCT FROM c.company_id;

## 3. Phase C - App Dual-Write Plan

### Goal
1. Start writing company_id on all new records while preserving current behavior.
2. Introduce active company context in server-side request flow.
3. Keep old ownership filters functional during transition.

### Files/tables likely touched
1. Active company resolution surface: src/lib/supabase/server.ts, middleware.ts.
2. Insert/update action surfaces:
3. src/app/(protected)/leads/actions.ts
4. src/app/(protected)/customers/actions.ts
5. src/app/(protected)/properties/actions.ts
6. src/app/(protected)/jobs/actions.ts
7. src/app/(protected)/estimates/actions.ts
8. src/app/(protected)/estimates/[id]/actions.ts
9. src/app/(protected)/equipment/actions.ts
10. src/app/(protected)/finances/actions.ts
11. src/app/(protected)/settings/actions.ts
12. src/app/(protected)/settings/push-actions.ts
13. src/app/(protected)/jobs/photo-actions.ts
14. src/app/(protected)/customers/[id]/portal-actions.ts
15. Service-role safeguards: src/lib/supabase/admin.ts, src/app/quote/[token]/actions.ts, src/app/portal/[token]/page.tsx, src/lib/push.ts, cron routes.

### Execution checklist
1. Add active company context lookup from company_members.
2. Require active company context for protected writes.
3. Add company_id to all inserts listed above.
4. Keep created_by and user_id unchanged as actor attribution.
5. Add consistency guard checks for parent-child writes.
6. Update settings writes to include company_id.
7. Add service-role query guardrails requiring company-qualified lookup.

### Risks
1. Missing company context causes write failures.
2. Legacy pages relying on single-row settings may read wrong row.
3. Service-role code may bypass tenant assumptions if filters are incomplete.

### Rollback point
1. Feature-flag or config gate dual-write.
2. Revert app changes while keeping backfilled schema intact.

### Acceptance criteria
1. New records in all core tables include company_id.
2. No regression in Wicksburg lead-to-job workflow.
3. Service-role writes/reads are scoped by resolved company.

### Dry-run validation queries
1. New-write smoke checks:
SELECT id, company_id, created_at FROM public.customers ORDER BY created_at DESC LIMIT 20;
SELECT id, company_id, created_at FROM public.jobs ORDER BY created_at DESC LIMIT 20;
2. Settings write shape:
SELECT user_id, company_id, updated_at FROM public.pricing_settings ORDER BY updated_at DESC LIMIT 20;

## 4. Phase D - Company-Aware Read Path Plan

### Goal
1. Move all read paths to company-scoped queries.
2. Preserve current Wicksburg behavior while eliminating implicit single-tenant assumptions.

### Files/routes likely touched
1. Dashboards and list/detail pages:
2. src/app/(protected)/today/page.tsx
3. src/app/(protected)/leads/page.tsx
4. src/app/(protected)/leads/website/[id]/page.tsx
5. src/app/(protected)/leads/[id]/page.tsx
6. src/app/(protected)/customers/page.tsx
7. src/app/(protected)/customers/[id]/page.tsx
8. src/app/(protected)/properties/page.tsx
9. src/app/(protected)/properties/[id]/page.tsx
10. src/app/(protected)/jobs/page.tsx
11. src/app/(protected)/jobs/[id]/page.tsx
12. src/app/(protected)/estimates/page.tsx
13. src/app/(protected)/estimates/[id]/page.tsx
14. src/app/(protected)/settings/page.tsx
15. Public/service-role routes:
16. src/app/quote/[token]/page.tsx
17. src/app/portal/[token]/page.tsx
18. src/app/api/cron/morning-summary/route.ts
19. src/app/api/cron/evening-summary/route.ts
20. src/app/api/parcels/search/route.ts

### Execution checklist
1. Add company filters to each table read in protected pages/actions.
2. For relational reads, enforce company consistency on base and joined tables.
3. Resolve settings by company first, user second only where intended.
4. Add compatibility mode so Wicksburg behavior remains unchanged during rollout.
5. Validate quote and portal flows with tenant-safe lookups.

### Risks
1. Partial filter rollout causes empty or inconsistent dashboards.
2. Over-filtering may hide valid records.
3. Token routes can fail if company joins are incomplete.

### Rollback point
1. Keep temporary fallback read logic behind runtime switch.
2. Revert read-filter changes without dropping dual-write.

### Acceptance criteria
1. Every protected page/action reads company-scoped data.
2. Quote and portal pages still work for existing Wicksburg tokens.
3. Cron summaries only act on intended company users.

### Dry-run validation queries
1. Cross-table mismatch checks:
SELECT count(*) FROM public.properties p JOIN public.customers c ON c.id = p.customer_id WHERE p.company_id IS DISTINCT FROM c.company_id;
SELECT count(*) FROM public.estimates e JOIN public.jobs j ON j.estimate_id = e.id WHERE e.company_id IS DISTINCT FROM j.company_id;
2. Settings ambiguity check:
SELECT company_id, count(*) FROM public.pricing_settings GROUP BY company_id ORDER BY count(*) DESC;

## 5. Phase E - RLS Transition Plan

### Goal
1. Move from user-owned policy model to company-owned policy model safely.
2. Use temporary dual policies before removing legacy rules.

### Files/tables likely touched
1. RLS policies on tenant tables listed in Phase A.
2. Role mapping from company_members.
3. High-risk tables first: leads, customers, properties, jobs, estimates, expenses, message_logs.

### Execution checklist
1. Add company-aware SELECT/INSERT/UPDATE/DELETE policies while legacy policies remain.
2. Add role-aware policy branches for owner/admin/field_operator.
3. Validate app flows under dual policy period.
4. Remove legacy user-only policies only after read/write cutover is complete.
5. Keep service-role paths explicitly filtered even after RLS transition.

### Risks
1. Premature policy removal breaks active flows.
2. Role matrix too strict for field operations.
3. Hidden endpoints may still depend on old policies.

### Rollback point
1. Re-enable legacy policies immediately if regression appears.
2. Keep dual policies until two full release cycles are stable.

### Acceptance criteria
1. All protected flows succeed under company-aware policies.
2. No cross-company visibility in user-scoped clients.
3. Role behavior matches expected access matrix.

### Dry-run validation queries
1. Policy inventory by table:
SELECT schemaname, tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;
2. Identify legacy-pattern policies pending removal:
SELECT tablename, policyname FROM pg_policies WHERE schemaname='public' AND (qual ILIKE '%created_by%' OR qual ILIKE '%user_id%');

## 6. Phase F - Customer Portal and Public Lead Ingest Plan

### Goal
1. Make public lead intake and customer portal tenant-safe.
2. Preserve existing Wicksburg public UX.

### Files/tables likely touched
1. Public quote accept/decline: src/app/quote/[token]/actions.ts, src/app/quote/[token]/page.tsx.
2. Portal token flow: src/app/(protected)/customers/[id]/portal-actions.ts, src/app/portal/[token]/page.tsx.
3. Public lead review/convert path: src/app/(protected)/leads/actions.ts, src/app/(protected)/leads/page.tsx.
4. Ingest boundary integration contract with website repo per AGENTS.md.
5. Tables: leads, customer_portal_tokens, customers, properties, estimates, pricing_settings, profiles.

### Execution checklist
1. Add company_id to portal tokens and enforce token-company-customer consistency.
2. Ensure quote token lookup carries company-safe joins for downstream updates.
3. Assign website leads to Wicksburg company_id by explicit mapping.
4. Add service-role query guardrails requiring company match in all public token flows.
5. Add monitoring for token lookup failures and lead assignment failures.

### Risks
1. Token mismatch can break customer portal/quote acceptance.
2. Public lead ingest may fail if mapping is missing.
3. Service-role bypass remains high-impact if unscoped.

### Rollback point
1. Keep backward-compatible token read path during transition window.
2. If issues occur, disable stricter token-company checks temporarily and retain logging.

### Acceptance criteria
1. New leads are always assigned to intended company.
2. Portal tokens resolve only within owning company.
3. Quote acceptance/decline still works for Wicksburg customers.

### Dry-run validation queries
1. Token-company consistency:
SELECT count(*) FROM public.customer_portal_tokens t JOIN public.customers c ON c.id = t.customer_id WHERE t.company_id IS DISTINCT FROM c.company_id;
2. Lead assignment completeness:
SELECT count(*) FROM public.leads WHERE company_id IS NULL;
3. Quote consistency:
SELECT count(*) FROM public.estimates e JOIN public.customers c ON c.id = e.customer_id WHERE e.company_id IS DISTINCT FROM c.company_id;

## 7. Phase G - Final Hardening

### Goal
1. Complete tenant hardening after stability is proven.
2. Remove compatibility scaffolding and enforce invariants.

### Files/tables likely touched
1. All tenant-owned tables with company_id.
2. App compatibility switches and legacy fallback branches in pages/actions from Phases C and D.
3. RLS policy set finalization for role-aware company access.

### Execution checklist
1. Convert company_id columns to NOT NULL where complete.
2. Add and enforce company_id foreign keys to companies.
3. Add remaining supporting indexes for hot company query paths.
4. Remove legacy user-only compatibility logic.
5. Tighten role permissions based on real usage telemetry.
6. Re-run security/performance advisor checks and policy audits.

### Risks
1. Constraint enforcement can fail if residual bad data exists.
2. Cleanup may remove still-needed compatibility branch.
3. Role tightening can block operational edge cases.

### Rollback point
1. Roll back constraint migrations in reverse order.
2. Re-enable compatibility branches if access regressions appear.
3. Keep policy snapshots to restore quickly.

### Acceptance criteria
1. All targeted tables enforce non-null company_id and FK integrity.
2. No legacy compatibility reads/writes remain in production path.
3. Owner/admin/field_operator permissions are validated end-to-end.
4. Wicksburg workflow remains uninterrupted across lead -> estimate -> job -> payment loop.

### Dry-run validation queries
1. Null and orphan checks:
SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='company_id' AND is_nullable='YES';
SELECT count(*) FROM public.customers c LEFT JOIN public.companies co ON co.id = c.company_id WHERE co.id IS NULL;
2. Constraint inventory:
SELECT conname, conrelid::regclass FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND conname ILIKE '%company%';
3. Final policy audit:
SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;

## Release gating recommendation
1. Require formal sign-off at end of each phase before starting the next.
2. Tag rollback checkpoints at every phase boundary.
3. Run a fixed Wicksburg regression suite after each phase:
4. Login and protected navigation.
5. Website lead review and convert.
6. Estimate create and quote accept.
7. Job complete and payment updates.
8. Settings save, push subscription, and cron summaries.

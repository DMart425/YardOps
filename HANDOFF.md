# YardOps Handoff — Operational State

> **Living document.** Future coder chats MUST update this file whenever architecture, database state,
> workflows, major feature behavior, migrations, deployment assumptions, or project status changes.
> Any handoff to a new chat must reference this file and include a reminder to keep it updated.

Last updated: 2026-05-11

---

## Repos

| Repo | Purpose |
|------|---------|
| `DMart425/YardOps` | Private operations app — this repo |
| `DMart425/WicksburgLawnService` | Public business website + lead intake form |

**Do not casually edit WicksburgLawnService during YardOps work.**
WicksburgLawnService must be audited before hardening `leads.business_id`.

---

## Current Checkpoint

- **Latest commit:** `5037536` — Harden core business ownership (Phase 2E Group 3)
- **Branch:** `main`
- **Supabase project:** `lewzqavgvltzwfeypvam` (Wicksburg Lawn Service)
- **Deployment:** Vercel, auto-deploys on push to `main`
- **Production URL:** https://app.wicksburglawnservice.com

> **Note:** The Supabase DB password was exposed in a prior session and needs rotation. User has asked
> not to interrupt active work repeatedly for this. Rotate at a safe pause point.
> Do NOT document the exposed password here or anywhere in the repo.

---

## Workflow Rules (Mandatory)

Before every change:
1. Run `git status --short` and confirm clean state.
2. `.claude/` may exist as untracked — **never stage or commit it**.
3. Work in small, explicitly approved steps.

For DB/migration changes:
- Draft migration file first and return a pre-approval report.
- Apply only after explicit user approval.
- Use `npx supabase db query --linked --file "<migration file>"` to apply.
- **Do NOT use `supabase db push`** — remote/local migration history mismatch exists.
- Verify live DB state after apply (read-only SQL).
- User tests before commit.
- Commit migration file only after explicit approval.

For code changes:
- Stage only explicitly approved files.
- Never stage `.claude/`, unrelated migrations, or unrelated app code.
- Never commit or push without explicit approval.
- Never change `.env`, deployment settings, RLS, NOT NULL constraints, or app code outside the approved scope.

---

## Completed Phases

### Phase 2D — RLS Business Scoping ✅

All RLS policies on business-owned tables have been replaced with business-scoped policies using `public.is_business_member(business_id)`.

**User-scoped tables** (unchanged — still use `auth.uid()` directly):
- `pricing_settings`
- `profiles`
- `push_subscriptions`
- `brief_settings`

**Parcels:** remain authenticated-readable with service-role policy preserved.

**Public estimate token policy** on `estimates` was preserved.

Phase 2D commits (Waves 1–7):

| Commit | Description |
|--------|-------------|
| `a66a5dd` | Replace Wave 1 RLS policies with business scoping |
| `3a45952` | Replace Wave 2 RLS policies with business scoping |
| `246ba55` | Replace Wave 3 RLS policies with business scoping |
| `f31c3d2` | Replace Wave 4 RLS policies with business scoping |
| `4ba5112` | Replace Wave 5 RLS policies with business scoping |
| `44b941e` | Replace Wave 6 RLS policies — user-scoped settings/profile/subscription |
| `548f5bb` | Replace Wave 7 RLS policies — parcels/brief_settings |

---

### Phase 2E — NOT NULL Hardening ✅ (leads deferred)

`business_id NOT NULL` enforced on all YardOps-owned tables. Each FK converted from `ON DELETE SET NULL` to `ON DELETE RESTRICT` before applying NOT NULL.

| Group | Tables | Status | Commit |
|-------|--------|--------|--------|
| Group 1 | `estimate_items`, `job_visits`, `customer_portal_tokens`, `job_photos` | ✅ Applied + committed | `7200e5b` |
| Group 2 | `equipment`, `maintenance_items` | ✅ Applied + committed | `5d5e81f` |
| Group 3 | `customers`, `properties`, `estimates`, `jobs`, `expenses`, `message_logs` | ✅ Applied + committed | `5037536` |
| `leads` | — | ⏸ **Deferred** | — |

**Why `leads` is deferred:**
`leads` has an external insert path through the WicksburgLawnService public intake form. Before hardening, audit the public intake to confirm every lead insert writes `business_id`. See Recommended Next Task below.

---

### Portal Token Fixes ✅

Root causes and fixes:

| Problem | Fix |
|---------|-----|
| `customer_portal_tokens.customer_id` was a bare unique index — invisible to PostgREST `onConflict` | Dropped bare index, added formal `UNIQUE` constraint |
| `token` column default used `encode(..., 'base64url')` — unsupported on PostgreSQL 15 (Supabase) | Changed default to `encode(gen_random_bytes(32), 'hex')` |
| Portal page used hardcoded light colors — invisible on dark YardOps theme | Replaced all hardcoded colors with CSS variables |

**Share Portal Link now works. Public portal page loads and matches app styling.**

Commits: `7200e5b` (schema), `fd5818d` (portal styling)

---

### Equipment Removal Flow ✅

- `deleteEquipment(equipmentId)` verifies active business ownership (`id + business_id`).
- `maintenance_items.equipment_id` has `ON DELETE CASCADE` — linked maintenance records removed automatically.
- Danger Zone card on equipment detail page with `window.confirm()` guard.

Commit: `e23a1df`

---

### Lead Itemized Service Checkboxes ✅

Manual lead form (`/leads/new`) replaced a package dropdown with four individual checkboxes:
- Mowing
- Weed Eating / Trimming
- Edging
- Blow Off Hard Surfaces

`createLead()` writes directly to `default_mowing_enabled`, `default_weed_eating_enabled`, `default_edging_enabled`, `default_blow_off_enabled`. No schema migration needed — columns already existed.

Lead → property → estimate/job service carryover confirmed working.

Commit: `6b2c553`

---

### Job Service Label Fixes ✅

**Problem:** Job cards showed `recurring` as the service label. `job_type` is a scheduling concept and must never appear as a service scope.

**Fix applied:**
- `job_type` is never displayed as a service label.
- Job cards now derive service display from linked property booleans first (itemized list).
- Legacy `service_package` codes remain as fallback when booleans are not set.
- `scheduleFollowUpJob` now derives and persists `service_package` from property booleans when parent job has no package.

Commits: `8621e2d`, `9028e84`, `3c5371a`

---

## Committed Migrations (Full List)

| File | Description |
|------|-------------|
| `20260505203500_create_parcel_sources.sql` | Parcel sources lookup table |
| `20260506000200_property_default_service_booleans.sql` | Four service boolean columns on properties |
| `20260511170000_phase2e_group1_not_null_empty_tables.sql` | Phase 2E Group 1 NOT NULL |
| `20260511171000_fix_customer_portal_tokens_customer_unique.sql` | Formal UNIQUE constraint on portal tokens |
| `20260511172000_fix_customer_portal_tokens_token_default.sql` | Fix token default to hex |
| `20260511180000_phase2e_group2_not_null_equipment.sql` | Phase 2E Group 2 NOT NULL |
| `20260511190000_phase2e_group3_not_null_core_operations.sql` | Phase 2E Group 3 NOT NULL |

---

## Commit History (Recent, Newest First)

| Hash | Description |
|------|-------------|
| `5037536` | Harden core business ownership (Phase 2E Group 3) |
| `3c5371a` | Show itemized services on job cards |
| `9028e84` | Derive job service labels from property defaults |
| `8621e2d` | Fix job service labels (remove job_type fallback) |
| `6b2c553` | Use itemized services for manual leads |
| `e23a1df` | Add equipment removal flow |
| `5d5e81f` | Harden equipment business ownership (Phase 2E Group 2) |
| `fd5818d` | Polish customer portal styling |
| `4991772` | Temporary portal-actions diagnostic logging (then cleaned up) |
| `7200e5b` | Harden portal token schema (Phase 2E Group 1 + portal fixes) |
| `ffbd42b` | Polish lead property return flow (Phase B.7d) |
| `701fed8` | B.7c-b: property default service checkboxes + estimate defaults |
| `58879bc` | B.7c-a: property default service boolean columns (migration + types) |
| `548f5bb` | Wave 7 RLS (parcels/brief_settings) |
| `44b941e` | Wave 6 RLS (user-scoped settings/profile/subscription) |
| `4ba5112` | Wave 5 RLS |
| `f31c3d2` | Wave 4 RLS |
| `246ba55` | Wave 3 RLS |
| `3a45952` | Wave 2 RLS |
| `a66a5dd` | Wave 1 RLS |

---

## Current Verified Behavior

All of the following were user-tested and confirmed working as of `5037536`:

- ✅ Share Portal Link generates a working public URL
- ✅ Public portal page loads and matches dark app styling
- ✅ Equipment create / edit works
- ✅ Maintenance item flow works
- ✅ Equipment removal works (cascades to maintenance records)
- ✅ Manual lead itemized service form works
- ✅ Lead → estimate → job service carryover works
- ✅ Job cards show itemized services (e.g., "Mowing, Blow Off")
- ✅ `recurring` no longer appears as a service label
- ✅ Steve Pippin shows correct service label
- ✅ Cedric Thomas shows "Mowing, Blow Off"

---

## Open / Deferred Items

| Item | Status | Notes |
|------|--------|-------|
| `leads.business_id NOT NULL` | ⏸ Deferred | Audit WicksburgLawnService intake path first |
| DB password rotation | ⏸ Pending | Schedule at a safe pause point; do not interrupt active work |
| B.7a website frequency/service-interest intake | ⏸ Pending | `6c8bada` in WicksburgLawnService |
| B.7b YardOps consumption of B.7a leads | ⏸ Pending | Verify normalization/carryover |
| Stale jobs with `service_package = null` and no property booleans | ℹ️ Minor | Cards show no 🌿 line — acceptable for now, data cleanup optional |
| RLS hardening checklist items | ℹ️ Future | See Architecture.md §9 |

---

## Recommended Next Task

**Read-only audit of WicksburgLawnService public intake + YardOps `leads` insert path** before hardening `leads.business_id`.

Suggested audit scope:
- Public WicksburgLawnService form payload — what fields does it send?
- API/action/function that inserts the lead — does it write `business_id`?
- Whether itemized services from the intake form map to YardOps property booleans.
- Live `leads` null count on `business_id`.
- `leads.business_id` current FK delete rule.
- `leads` RLS policies.
- Any existing null `business_id` rows — safe to backfill?

### Read-Only SQL for Leads Audit

Run these against `lewzqavgvltzwfeypvam` (read-only, no mutations):

```sql
-- Null count check
SELECT COUNT(*) AS total_rows,
       COUNT(*) FILTER (WHERE business_id IS NULL) AS null_business_id
FROM public.leads;

-- NOT NULL status
SELECT table_name, column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'leads'
  AND column_name = 'business_id';

-- FK delete rule
SELECT tc.table_name, tc.constraint_name, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'business_id'
  AND tc.table_name = 'leads';

-- RLS policies
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'leads'
ORDER BY policyname;
```

---

## Guardrails

- Do not redesign the app unless explicitly asked.
- Do not add schema/migration/RLS/env changes unless explicitly approved.
- Do not remove lead-status customers from property assignment.
- Do not make destructive actions one-click.
- Do not hardcode county/state defaults in UI or forms.
- Keep changes phase-scoped and reviewable.
- Never stage or commit `.claude/`.
- Never apply SQL to any Supabase project without confirming the ref is `lewzqavgvltzwfeypvam`.
- Never use `supabase db push` — use `npx supabase db query --linked --file`.

---

## Job Preservation Warnings

These must not break during any refactor:

- **Recurring auto-schedule:** `completeJob()` checks `property.auto_schedule_next`, `service_frequency`, `scheduled_date`. All must remain present.
- **Recurrence chain:** `recurrence_source` (parent) and `next_job_created_id` (child) must not be removed or reset.
- **`started_at` → `actual_minutes`:** `markInProgress()` sets `started_at`; `completeJob()` computes `actual_minutes`. These must stay coupled.
- **Reschedule log:** `reschedule_count` and `reschedule_log` are append-only.
- **Today page date assumptions:** `scheduled_date` as `YYYY-MM-DD`; `completed_at` as full ISO timestamp.
- **Estimate visit fields:** `visit_scheduled_date` and `visit_scheduled_time` appear on Today page.
- **`payment_status` enum:** `unpaid`, `partial`, `paid`, `not_billable` — renaming any value is a breaking change.
- **FK cascades:** `job_photos`, `job_visits`, `expenses` all use `job_id` as FK.

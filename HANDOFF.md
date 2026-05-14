# YardOps Handoff — Operational State

> **Living document.** Future coder chats MUST update this file whenever architecture, database state,
> workflows, major feature behavior, migrations, deployment assumptions, or project status changes.
> Any handoff to a new chat must reference this file and include a reminder to keep it updated.

Last updated: 2026-05-13

---

## Repos

| Repo | Purpose |
|------|---------|
| `DMart425/YardOps` | Private operations app — this repo |
| `DMart425/WicksburgLawnService` | Public business website + lead intake form |

**Do not casually edit WicksburgLawnService during YardOps work.**

---

## Current Checkpoint

- **Latest commit:** `0a165d1` — Fix quote accepted banner and mobile header
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

### Phase 2E — NOT NULL Hardening ✅ (complete — all tables including leads)

`business_id NOT NULL` enforced on all YardOps-owned tables. Each FK converted from `ON DELETE SET NULL` to `ON DELETE RESTRICT` before applying NOT NULL.

| Group | Tables | Status | Commit |
|-------|--------|--------|--------|
| Group 1 | `estimate_items`, `job_visits`, `customer_portal_tokens`, `job_photos` | ✅ Applied + committed | `7200e5b` |
| Group 2 | `equipment`, `maintenance_items` | ✅ Applied + committed | `5d5e81f` |
| Group 3 | `customers`, `properties`, `estimates`, `jobs`, `expenses`, `message_logs` | ✅ Applied + committed | `5037536` |
| `leads` | — | ✅ Applied + verified + user-tested | — |

**leads hardening notes:**
WicksburgLawnService public intake was audited before applying. Confirmed every lead insert writes `business_id` via `YARDOPS_INTAKE_BUSINESS_ID` env var. 0 null rows across 9 existing leads. Public intake test passed after migration was applied. `leads_business_id_fkey` now uses `ON DELETE RESTRICT`.

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

### Phase 2F — Final Multi-Business Audit ✅

Read-only audit run against live DB (`lewzqavgvltzwfeypvam`). All 13 business-owned tables verified. No blockers or must-fix items found.

**Verified:**
- All 13 business-owned tables have `business_id NOT NULL` → `businesses(id)` with `ON DELETE RESTRICT`
- Zero null `business_id` rows across all 13 tables
- All business-owned RLS policies use `is_business_member(business_id)` with `WITH CHECK` requiring `NOT NULL`
- User-scoped tables (`profiles`, `pricing_settings`, `push_subscriptions`, `brief_settings`) correctly remain `auth.uid()`-scoped
- Reference/special policies preserved (`parcels`, public estimate token, portal token route)
- All protected server actions call `requireBusinessContext()` and set/scope `business_id`; no `created_by`-only data access
- Public/token routes work correctly; WicksburgLawnService intake confirmed business-scoped
- `finances/page.tsx` explicitly scopes all queries to `businessId`

**Defense-in-depth findings (Phase 2G candidates):**
- `DataExportSection.tsx` — ✅ Fixed in Phase 2G Task 1 (see below)
- `portal/[token]/page.tsx` — jobs query scoped by `customer_id` only; no `business_id`
- `quote/[token]/actions.ts` — `customers`/`properties` updates in `acceptEstimate` lack `business_id` scope
- Cron routes — no `business_id` filter on jobs/estimates; single-business only
- `leads` RLS SELECT/DELETE has redundant `business_id IS NOT NULL` check (cosmetic)

---

### Phase 2G — DataExportSection.tsx Cleanup ✅

**User-tested in production.** Two commits applied to `DataExportSection.tsx`:

- `f0edcc8` — Added explicit `business_id` filter to all three export queries via `requireBusinessContext()`. Replaced RLS-only scoping with defense-in-depth.
- `9b61a62` — Export content improvements:
  - Customer phone numbers formatted as `(xxx) xxx-xxxx` in CSV output
  - `customer_name` column added to properties export (after `customer_id`)
  - `customer_name` column added to jobs export (after `customer_id`)
  - `services` column added to jobs export: property booleans first (Mowing / Weed Eating / Edging / Blow Off), falls back to friendly `service_package` label; raw `service_package` retained for legacy/debug context

No schema changes. No migrations. The four property boolean columns already existed from `20260506000200_property_default_service_booleans.sql`.

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
| `20260511200000_phase2e_leads_not_null.sql` | Phase 2E leads — business_id NOT NULL / FK ON DELETE RESTRICT |

---

## Commit History (Recent, Newest First)

| Hash | Description |
|------|-------------|
| `0a165d1` | Fix quote accepted banner and mobile header (Phase 2G) |
| `5aff7d8` | Scope quote acceptance updates by business (Phase 2G) |
| `c0734c4` | Document portal service labels |
| `70fa054` | Modernize portal service labels (Phase 2G) |
| `22e1538` | Document portal scoping cleanup |
| `71975dd` | Scope portal jobs by business (Phase 2G — portal business_id) |
| `8ea0350` | Document Wicksburg phone formatting |
| `0399455` | Document YardOps phone formatting |
| `de10c59` | Format YardOps phone inputs (Patch B) |
| `9b61a62` | Improve data export content (Phase 2G Task 1 — export cleanup) |
| `f0edcc8` | Scope data exports by business (Phase 2G Task 1 — business_id filter) |
| `1c209ac` | Document Phase 2F audit results |
| `e4d0879` | Document post-hardening roadmap |
| `b9c02f3` | Harden leads business ownership (Phase 2E Final) |
| `289b732` | Update YardOps architecture and handoff docs |
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

All of the following were user-tested and confirmed working as of `289b732`:

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
- ✅ Public WicksburgLawnService intake form submits successfully with `leads.business_id NOT NULL` enforced
- ✅ Data exports filter by `business_id` explicitly (not RLS-only)
- ✅ Customers CSV exports phone numbers formatted as `(xxx) xxx-xxxx`
- ✅ Properties CSV exports include `customer_name`
- ✅ Jobs CSV exports include `customer_name` and human-readable `services` label
- ✅ YardOps phone inputs format as `(xxx) xxx-xxxx` while typing (manual lead, customer edit, estimate new-customer, quote confirm)
- ✅ WicksburgLawnService public quote form phone input formats as `(xxx) xxx-xxxx` while typing (`2a7b0f8`)
- ✅ Customer portal jobs scoped by both `customer_id` and `business_id` (`71975dd`)
- ✅ Customer portal service labels use property booleans first (Mowing / Weed Eating / Edging / Blow Off), fall back to friendly legacy labels (`70fa054`)
- ✅ `acceptEstimate` customer/property updates scoped by `business_id` (defense-in-depth beyond `public_token` lookup) (`5aff7d8`)
- ✅ Quote accepted banner uses neutral wording: "Estimate accepted. We'll be in touch soon!" (`0a165d1`)
- ✅ Mobile quote header Call Now button no longer clips/crushes on narrow viewports (`0a165d1`)

---

## Open / Deferred Items

| Item | Status | Notes |
|------|--------|-------|
| DB password rotation | ⏸ Pending | Schedule at a safe pause point; do not interrupt active work |
| Phase 2F — Final Multi-Business Audit | ✅ Complete | All 13 tables verified — no blockers found |
| Phase 2G — Defense-in-Depth Cleanup | ⏸ In Progress | Task 1 ✅, Patch B ✅, Patch C ✅, portal scoping ✅, portal labels ✅, quote actions scoping ✅, quote UX ✅; next: cron routes |
| WicksburgLawnService phone input formatting (Patch C) | ✅ Complete | `2a7b0f8` in WicksburgLawnService — separate repo, no YardOps changes |
| B.7a website frequency/service-interest intake | ⏸ Pending | `6c8bada` in WicksburgLawnService |
| B.7b YardOps consumption of B.7a leads | ⏸ Pending | Verify normalization/carryover |
| Stale jobs with `service_package = null` and no property booleans | ℹ️ Minor | Cards show no 🌿 line — acceptable for now, data cleanup optional |

---

## Post-Phase-2E Roadmap

Full roadmap lives in Architecture.md §16. Summary:

| Phase | Goal | Status |
|-------|------|--------|
| 2F | Final end-to-end multi-business audit | ✅ Complete |
| 2G | Defense-in-depth cleanup (exports, legacy fields, scoping) | ⏸ Pending |
| 3 | Public intake and lead workflow improvements | ⏸ Pending |
| 4 | Operations UX / workflow polish | ⏸ Pending |
| 5 | Reporting, automation, and growth features | ⏸ Pending |

**Permanent Future-Handoff Requirements** (mandatory — see Architecture.md §16):
Every future handoff must instruct the next chat to read ARCHITECTURE.md and HANDOFF.md first, remind it to update those docs after any verified/committed change, state the latest commit, current phase status, open items, workflow guardrails, and known security follow-ups (no secret values).

---

## Recommended Next Task

**Immediate next task: Phase 2G — Cron routes multi-business scoping gap documentation**

**This is documentation-only. Do not change cron route code yet.**

`api/cron/morning-summary` and `api/cron/evening-summary` query `jobs`/`estimates` without a `business_id` filter and fetch `pricing_settings` with `.limit(1)`. Current single-business behavior is acceptable. The actual implementation fix should be deferred until multi-business support is being actively built — at that point the routes will need to iterate over businesses or accept a scoped business context.

Scope: Add a note to ARCHITECTURE.md §16 documenting the gap and the deferral decision. No cron route code changes.

Remaining Phase 2G items (in Architecture.md §16):
1. ~~`DataExportSection.tsx`~~ ✅ complete
2. ~~Patch B — YardOps phone formatting~~ ✅ complete
3. ~~Patch C — WicksburgLawnService phone formatting~~ ✅ complete
4. ~~`portal/[token]/page.tsx` business_id scoping~~ ✅ complete
5. ~~`portal/[token]/page.tsx` service label modernization~~ ✅ complete
6. ~~`quote/[token]/actions.ts` business_id scoping~~ ✅ complete (`5aff7d8`)
7. ~~Quote page UX fixes~~ ✅ complete (`0a165d1`)
8. Cron routes — document multi-business scoping gap; address when multi-business needed — **next task**
9. `leads` RLS SELECT/DELETE — cosmetic `business_id IS NOT NULL` cleanup

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

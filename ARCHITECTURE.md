# YardOps Architecture

> **Living document.** Future coder chats MUST update this file whenever architecture, database state,
> workflows, major feature behavior, migrations, deployment assumptions, or project status changes.
> Any handoff to a new chat must reference this file and include a reminder to keep it updated.

Last updated: 2026-05-11
Current checkpoint commit: `e4d0879` (Document post-hardening roadmap)  
Approved Supabase project: `lewzqavgvltzwfeypvam` (Wicksburg Lawn Service)

---

## 1. Project Identity & Repo Separation

**YardOps** (`DMart425/YardOps`) is the private operations command center for Wicksburg Lawn Service. It is not customer-facing.

**WicksburgLawnService** (`DMart425/WicksburgLawnService`) is the public business website and lead intake form. It writes rows into `public.leads` in the shared Supabase project.

**Rules:**
- Do not casually edit WicksburgLawnService during YardOps work.
- Never merge responsibilities: YardOps is operations; WicksburgLawnService is a lead funnel only.

YardOps enables the operator to:
- Track leads from the website and manually-added sources
- Manage customers, properties, and recurring service schedules
- Create and send estimates (with public quote tokens for customer approval)
- Schedule and complete jobs, with optional photo logging
- Track partial and full payments, generate invoices
- Log outbound SMS activity
- Monitor daily/weekly workflow and cash flow
- Manage equipment and maintenance schedules
- Generate customer portal links

---

## 2. Tech Stack

| Component | Tech |
|-----------|------|
| Framework | Next.js (App Router) |
| Runtime | Node.js on Vercel |
| Language | TypeScript (strict mode) |
| UI | React 19 |
| Styling | Custom global CSS — no Tailwind |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (email + password) |
| ORM | None — direct Supabase JS SDK |
| Server Logic | Next.js Server Actions, Route Handlers |
| Forms | HTML forms + `useActionState` |
| Notifications | Web Push API (PWA) |
| Exports | jsPDF (PDF invoices), CSV export |
| Geocoding | External API, results cached in `parcels` table |
| Weather | Open-Meteo API (free, no auth) |
| Deployment | Vercel — auto-deploys `main` branch |

---

## 3. Folder Structure

```
src/
├── app/
│   ├── (protected)/              # Auth-required route group
│   │   ├── customers/
│   │   ├── properties/
│   │   ├── jobs/
│   │   ├── estimates/
│   │   ├── leads/
│   │   ├── today/
│   │   ├── finances/
│   │   ├── equipment/
│   │   ├── settings/
│   │   └── layout.tsx            # Protected layout — second auth guard
│   ├── api/
│   │   ├── cron/                 # Morning/evening summary cron handlers
│   │   ├── push/                 # Web push subscription endpoints
│   │   └── parcels/              # Parcel search (reads cached parcels rows)
│   ├── login/                    # Public: login page
│   ├── quote/[token]/            # Public: customer-facing estimate quote
│   ├── portal/[token]/           # Public: customer portal (accessible — see §4)
│   ├── page.tsx                  # Root redirects to /today
│   ├── layout.tsx                # Root layout (metadata, PWA, theme)
│   └── globals.css               # Global styles (dark theme, CSS variables)
├── components/
│   ├── forms/
│   │   ├── JobForm.tsx
│   │   ├── EstimateForm.tsx
│   │   ├── PropertyForm.tsx
│   │   └── ...
│   ├── JobActions.tsx
│   ├── EstimateStatusActions.tsx
│   ├── ParcelLookup.tsx          # Shared parcel search + import component
│   └── ...
├── lib/
│   ├── supabase/
│   │   ├── server.ts             # Anon client (user-scoped, RLS enforced)
│   │   ├── admin.ts              # Service role client (bypasses RLS)
│   │   └── client.ts             # Browser client (exists but unused — legacy)
│   ├── business/
│   │   └── context.ts            # requireBusinessContext() — resolves userId + businessId
│   ├── pricing.ts                # Estimate calculation engine
│   ├── geocode.ts                # Address geocoding helper
│   ├── frequency.ts              # normalizeFrequency() — maps website values to canonical YardOps values
│   └── push.ts                   # Web push helper
├── types/
│   └── database.ts               # TypeScript interfaces for all DB entities (manually maintained)
└── middleware.ts                 # Session refresh, route protection (root level)
```

---

## 4. Authentication & Routing

### Middleware Flow

1. Every request passes through `middleware.ts`.
2. Middleware creates a server-side Supabase anon client and calls `getUser()` to refresh session.
3. If no user and route is NOT `/login`, `/quote/*`, or `/portal/*` → redirect to `/login`.
4. If user exists and route IS `/login` → redirect to `/today`.

### Public Routes

| Route | Access | Client |
|-------|--------|--------|
| `/login` | Public | — |
| `/quote/[token]` | Public — no auth | `createAdminClient()` — looks up by `public_token` |
| `/portal/[token]` | **Public — accessible** | `createAdminClient()` — looks up by portal token |

**Portal is now publicly accessible.** Middleware allowlist was updated to permit unauthenticated access to `/portal/*`. Portal tokens use `encode(gen_random_bytes(32), 'hex')` as the default.

### Protected Routes

- Everything under `(protected)/` requires authentication.
- Protected layout (`src/app/(protected)/layout.tsx`) performs a second auth check.
- Failing auth redirects to `/login`.

### `requireBusinessContext()`

All protected server actions and pages call `requireBusinessContext()` from `@/lib/business/context`. This resolves the authenticated `userId` and the associated `businessId` and throws/redirects if either is missing. Every DB mutation includes `.eq('business_id', businessId)` for scoping.

---

## 5. Business Ownership Model

### `businesses` Table

A `businesses` table exists as the FK target for `business_id` on all business-owned tables. The `is_business_member(business_id)` function is used in RLS policies.

### Business-Owned Tables (Phase 2E complete — all tables)

All of the following tables have `business_id NOT NULL` with `ON DELETE RESTRICT`:

- `customers`
- `properties`
- `estimates`
- `estimate_items`
- `jobs`
- `job_visits`
- `job_photos`
- `expenses`
- `message_logs`
- `equipment`
- `maintenance_items`
- `customer_portal_tokens`
- `leads`

Phase 2E is fully complete. WicksburgLawnService public intake was audited before hardening `leads` — confirmed every insert writes `business_id` via `YARDOPS_INTAKE_BUSINESS_ID`. Public intake test passed after migration was applied and verified.

---

## 6. RLS Model (Phase 2D — Complete)

Business-owned tables use `public.is_business_member(business_id)` in all SELECT/INSERT/UPDATE/DELETE policies. This replaces the prior `created_by = auth.uid()` pattern.

**User-scoped tables** (unchanged — use `auth.uid()` directly, not business scoping):
- `pricing_settings`
- `profiles`
- `push_subscriptions`
- `brief_settings`

**Special policies preserved:**
- `parcels` — authenticated-readable, service-role policy preserved for parcel ingestion.
- `estimates` — public token SELECT policy preserved for `/quote/[token]` access.

**Phase 2D waves:**

| Wave | Commit | Scope |
|------|--------|-------|
| 1 | `a66a5dd` | Core business-owned tables |
| 2 | `3a45952` | Additional business tables |
| 3 | `246ba55` | Additional business tables |
| 4 | `f31c3d2` | Additional business tables |
| 5 | `4ba5112` | Additional business tables |
| 6 | `44b941e` | User-scoped settings/profile/subscription |
| 7 | `548f5bb` | Parcels + brief_settings |

---

## 7. Data Model

### `businesses`
- `id` — FK target for `business_id` on all business-owned tables

### `profiles` (1 per user)
- `id` (auth user ID)
- `business_name`, `owner_name`, `business_phone`, `business_email`
- `service_radius_miles`, `default_hourly_rate`, `minimum_visit_charge`
- `created_at`, `updated_at`

### `pricing_settings` (1 per user)
- `id`, `user_id` (FK → auth.users)
- `target_hourly_rate`, `minimum_price`, `round_to_nearest`, `default_setup_minutes`
- `venmo_handle`, `blackout_dates` (array of `YYYY-MM-DD` strings)
- `time_zone` (IANA timezone string — used by Jobs/Today for date calculations)
- `settings_json`, `created_at`, `updated_at`

### `customers`
- `id`, `created_by` (FK → auth.users), `business_id` **NOT NULL** (FK → businesses, ON DELETE RESTRICT)
- `first_name`, `last_name`, `phone`, `email`
- `status` (`'lead'` | `'active'` | `'inactive'` | `'archived'`)
- `notes`, `preferred_contact_method`, `tags` (array)
- `created_at`, `updated_at`

### `properties`
- `id`, `created_by`, `customer_id` (FK → customers), `business_id` **NOT NULL** (FK → businesses, ON DELETE RESTRICT)
- `service_address`, `city`, `state`, `postal_code`, `county`
- `latitude`, `longitude` (geocoded, used for weather forecasts and route ordering)
- `parcel_id` (FK → parcels), `parcel_acres`, `estimated_mowable_acres`, `lot_size_source`
- `default_mowing_enabled` (boolean | null)
- `default_weed_eating_enabled` (boolean | null)
- `default_edging_enabled` (boolean | null)
- `default_blow_off_enabled` (boolean | null)
- `default_service_package` (soft-retired — do not drop yet; existing values preserved)
- `default_price`, `service_frequency`
- `auto_schedule_next` (boolean — auto-create next job after completion)
- `property_name`, `access_notes`, `obstacle_notes`, `parking_notes`, `internal_notes`
- `status` (`'active'` | `'inactive'` | `'archived'`)
- `created_at`, `updated_at`

### `jobs`
- `id`, `created_by`, `customer_id`, `property_id`, `estimate_id` (nullable), `business_id` **NOT NULL**
- `status` (`'scheduled'` | `'in_progress'` | `'completed'` | `'skipped'` | `'cancelled'` | `'needs_reschedule'`)
- `payment_status` (`'unpaid'` | `'paid'` | `'partial'` | `'not_billable'`)
- `price`, `quoted_total`, `amount_paid`, `payment_method`
- `scheduled_date` (`YYYY-MM-DD`), `scheduled_time_window`
- `completed_at` (ISO timestamp), `started_at`, `actual_minutes`
- `service_package`, `title`, `job_type` (`'recurring'` | `'one_time'`)
- `recurrence_source` (parent job ID), `next_job_created_id` (child job ID)
- `completion_notes`, `internal_notes`, `customer_notes`
- `skipped_reason`, `reschedule_count`, `reschedule_log`, `rescheduled_from`
- `created_at`, `updated_at`

### `estimates`
- `id`, `created_by`, `customer_id`, `property_id`, `business_id` **NOT NULL**
- `status` (`'draft'` | `'sent'` | `'approved'` | `'converted'` | `'declined'` | `'expired'`)
- `total`, `subtotal`, `estimated_minutes`, `frequency`
- `estimate_inputs` (JSON — pricing engine inputs)
- `valid_until`, `public_token`, `notes`
- `accepted_at`, `approved_by_source` (`'customer_quote'` | `'manual'` | null)
- `manually_approved_at`, `approval_note`
- `revision_number`, `last_revised_at`, `last_sent_at`
- `visit_scheduled_date`, `visit_scheduled_time` (shown on Today page)
- `created_at`

### `estimate_items`
- `id`, `created_by`, `estimate_id`, `business_id` **NOT NULL**, `sort_order`
- `service_name`, `description`, `quantity`, `unit`, `unit_price`, `line_total`
- `created_at`, `updated_at`

### `expenses`
- `id`, `user_id`, `job_id` (nullable), `business_id` **NOT NULL**
- `category` (`'fuel'` | `'equipment'` | `'supplies'` | `'repairs'` | `'insurance'` | `'labor'` | `'other'`)
- `vendor`, `description`, `amount`, `purchased_at`, `notes`, `receipt_url`

### `message_logs`
- `id`, `user_id`, `customer_id`, `job_id`, `estimate_id`, `business_id` **NOT NULL**
- `message_type`, `delivery_method`, `recipient_phone`, `message_body`
- `sent_at`, `manually_marked_sent`

### `equipment`
- `id`, `created_by`, `business_id` **NOT NULL**
- `name`, `equipment_type` (`'mower'` | `'trimmer'` | `'blower'` | `'edger'` | `'trailer'` | `'truck'` | `'other'`)
- `make`, `model`, `serial_number`, `current_hours`
- `status` (`'active'` | `'inactive'` | `'retired'`)
- `notes`, `created_at`, `updated_at`

### `maintenance_items`
- `id`, `equipment_id` (FK → equipment, **ON DELETE CASCADE**), `business_id` **NOT NULL**
- `name` and various maintenance schedule fields
- Deleting an equipment row automatically deletes all linked maintenance_items.

### `customer_portal_tokens`
- `token` — default `encode(gen_random_bytes(32), 'hex')`
- `customer_id` — formal **UNIQUE** constraint (required by PostgREST for `onConflict` upsert)
- `business_id` **NOT NULL**, `created_by`, `created_at`, `expires_at`

### `job_visits`
- `id`, `job_id`, `business_id` **NOT NULL**, and visit detail fields

### `job_photos`
- `id`, `job_id`, `business_id` **NOT NULL`, and photo/storage fields

### `leads` (website intake)
- `id`, `business_id` **NOT NULL** (FK → businesses, ON DELETE RESTRICT)
- `name`, `phone`, `email`, `address`, `frequency`, `notes`
- `status` (`'new'` | `'converted'` | `'archived'`)
- `created_by` (nullable), `created_at`

### `parcels` (cached from external source)
- `id`, `source` (matches `parcel_sources.source_key`)
- `source_parcel_id`, `apn`, `owner_name`, `situs_address`, `mailing_address`
- `land_use`, `lot_sqft`, `lat`, `lon`, `raw_json`

### `parcel_sources`
- `id`, `source_key` (unique), `display_name`, `state`, `county`
- `provider`, `active`, `notes`, `created_at`, `updated_at`

### `app_notifications`
- `id`, `user_id`, `notification_type` (`'estimate_approved'`)
- `title`, `body`, `link_path`, `estimate_id` (nullable)
- `is_reviewed`, `reviewed_at`, `created_at`

---

## 8. Service Selection Model

### Property Booleans — Source of Truth

After property save, the canonical service scope is stored in four boolean columns:
- `default_mowing_enabled`
- `default_weed_eating_enabled`
- `default_edging_enabled`
- `default_blow_off_enabled`

`null` = not yet reviewed. `true`/`false` = explicitly set.

`default_service_package` is **soft-retired** and must not be dropped yet. Existing values preserved on update. New properties get `null`.

### Service Display Priority (Job Cards)

1. **Property booleans** (if any are `true`) → itemized list: e.g., "Mowing, Blow Off"
2. **`job.service_package`** code → friendly label (legacy fallback)
3. **No 🌿 line** if neither is available
4. **`job_type`** (`'recurring'`, `'one_time'`) is **never** displayed as a service label

### Helpers in `jobs/page.tsx`

- `formatServicePackage(pkg)` — maps package codes to friendly labels; handles unknown codes with underscore-replace
- `formatServiceBooleans(prop)` — builds itemized list from property boolean columns
- `serviceLabel(pkg, propRaw)` — calls `formatServiceBooleans` first; falls back to `formatServicePackage`

### Helpers in `jobs/actions.ts`

- `deriveServicePackageFromBooleans(prop)` — maps boolean columns to a `service_package` code for storage in follow-up jobs created by `scheduleFollowUpJob`

### Follow-up Job Service Carryover

`scheduleFollowUpJob` uses a three-level fallback for `service_package`:
1. Parent job's `service_package`
2. Property's `default_service_package` (legacy)
3. Derived from property booleans via `deriveServicePackageFromBooleans()`

---

## 9. Frequency Normalization

### Canonical YardOps Frequencies
`weekly`, `biweekly`, `one_time`, `custom`, `paused`

### Website Intake Frequencies
`weekly`, `biweekly`, `one_time`, `unsure`

`unsure` fails safe to `null` — never defaults to `weekly`. Handled by `normalizeFrequency()` in `lib/frequency.ts`.

---

## 10. Lead → Customer Lifecycle

```
Public website form
  → public.leads (status = 'new')

YardOps review → convert OR dismiss/delete

Convert website lead:
  convertWebsiteLead() → customers row (status = 'lead') + marks leads row converted
  → Add full property from lead context (/properties/new?customer_id=...)
  → Build estimate from property context
  → Convert estimate to job → customer promoted to 'active'

Manual lead (direct entry in YardOps):
  createLead() → customers row (status = 'lead') + properties row (together, one form)
  → Build estimate → Convert to job → customer promoted to 'active'
```

### Intake Notes Preserved

Website/manual intake address, frequency, and service interests are written into `customers.notes` during lead creation. This preserves data before the full property is created.

---

## 11. Migration Workflow Rules

- **Draft migration file first.** Return a pre-approval report before applying.
- **Apply with:** `npx supabase db query --linked --file "<migration file>"`
- **Do NOT use `supabase db push`** — remote/local migration history mismatch exists.
- **Verify live DB** with read-only SQL after apply.
- **User tests** before commit.
- **Commit migration file** only after explicit user approval.
- **Confirm project ref** is `lewzqavgvltzwfeypvam` before any SQL execution.

---

## 12. Portal Token Model

- `customer_portal_tokens.customer_id` has a formal **UNIQUE** constraint (not a bare index).
  - PostgREST requires a `pg_constraint` row (contype='u') for `onConflict` validation.
  - A bare `CREATE UNIQUE INDEX` is NOT visible to PostgREST — only `ADD CONSTRAINT ... UNIQUE` works.
- Token default: `encode(gen_random_bytes(32), 'hex')`
  - PostgreSQL 15 (Supabase) does NOT support `encode(..., 'base64url')` — error code `22023`.
- Portal is accessible at `/portal/[token]` without authentication.
- Token lookup uses `createAdminClient()` (bypasses RLS).

---

## 13. Supabase Rules

### Environment Variables

| Var | Purpose |
|-----|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — server only, never expose |
| `NEXT_PUBLIC_QUOTE_BASE_URL` | Base URL for public quote + portal links |
| `CRON_SECRET` | Verified in cron route handlers |

### Client Types

| Client | Auth | RLS | Usage |
|--------|------|-----|-------|
| `createClient()` | User session | ✅ Enforced | All protected routes and server actions |
| `createAdminClient()` | None | ❌ Bypassed | `/quote/[token]`, `/portal/[token]`, cron handlers |

### Schema Drift Risk

`src/types/database.ts` is manually maintained. After every migration, verify types manually or run `supabase gen types typescript`. Column renames or drops will silently break queries — no compile-time safety.

---

## 14. Parcel Architecture

- `parcels.source` matches `parcel_sources.source_key` for source metadata joins.
- County fallback: parcel raw fields → `parcel_sources.county`.
- State fallback: parcel raw fields → `parcel_sources.state`.
- City and ZIP are imported only when present in parcel data — never guessed.
- `PropertyForm` requires `service_address`, `city`, `state`, and `county` at save time.
- `ParcelLookup` component is shared between `PropertyForm` and `EstimateForm`.
- Parcel lookup in `EstimateForm` does not save imported data back to the property record.

---

## 15. Known Deferred / Open Items

| Item | Status | Notes |
|------|--------|-------|
| DB password rotation | ⏸ Pending | Schedule at a safe pause |
| B.7a website frequency/service intake | ⏸ Pending | WicksburgLawnService `6c8bada` |
| B.7b YardOps consumption of B.7a leads | ⏸ Pending | |
| RLS hardening checklist (from prior review) | ℹ️ Future | See below |

### RLS Hardening Checklist (future — not yet applied)

- Review `schedule_upcoming` view — confirm it exposes only intended rows.
- Tighten permissive `leads` update/delete RLS if policies are broader than intended.
- Tighten `message_logs` insert policy.
- Revoke direct RPC execute on `handle_new_user()` if trigger-only.
- Add missing FK indexes where sequential scans exist.
- Optimize RLS policies using `(select auth.uid())` pattern where Supabase Advisor flags repeated evaluation.

---

## 16. Post-Phase-2E Roadmap

### Phase 2F — Final Multi-Business Audit

**Goal:** Run a final end-to-end audit now that Phase 2D and Phase 2E are complete.

**Status:** ✅ Complete — PASSED (2026-05-11)

**Audit results:**

All 13 business-owned tables verified via live DB query against `lewzqavgvltzwfeypvam`:

| Result | Detail |
|--------|--------|
| `business_id NOT NULL` | ✅ All 13 tables: `customers`, `properties`, `estimates`, `estimate_items`, `jobs`, `job_visits`, `job_photos`, `expenses`, `message_logs`, `equipment`, `maintenance_items`, `customer_portal_tokens`, `leads` |
| `business_id` FK target | ✅ All 13 → `businesses(id)` |
| FK delete rule | ✅ All 13 use `ON DELETE RESTRICT` — no `ON DELETE SET NULL` remains |
| Null `business_id` rows | ✅ Zero across all 13 tables |
| Business-owned RLS | ✅ All 13 use `is_business_member(business_id)`; INSERT/UPDATE WITH CHECK require `business_id IS NOT NULL` |
| User-scoped tables | ✅ `profiles`, `pricing_settings`, `push_subscriptions`, `brief_settings` all use `(SELECT auth.uid())` pattern |
| Reference/special tables | ✅ `parcels` authenticated-read + service-role preserved; `estimates` public quote token policy preserved |
| App insert/update paths | ✅ All protected server actions call `requireBusinessContext()` and set/scope `business_id`; no `created_by`-only data access found |
| Public/token routes | ✅ `/quote/[token]` and `/portal/[token]` work correctly; WicksburgLawnService intake confirmed business-scoped |
| Exports/reporting | ✅ `finances/page.tsx` explicitly scopes all queries to `businessId`; `DataExportSection.tsx` relies on RLS only (Phase 2G cleanup candidate) |
| No blockers | ✅ No must-fix items found |

**Defense-in-depth findings (tracked in Phase 2G):** see Phase 2G section below.

---

### Phase 2G — Defense-in-Depth Cleanup

**Goal:** Clean up remaining hardening/consistency issues found during Phase 2D/2E and Phase 2F.

**Status:** ⏸ Pending — next task

**Known items (from Phase 2F audit):**

1. **`DataExportSection.tsx`** — no explicit `business_id` filter on `customers`/`properties`/`jobs` queries. Uses `createClient()` with RLS only. Fix: fetch `businessId` via `requireBusinessContext()` and add `.eq('business_id', businessId)` to all three queries. *(Highest priority — defense against RLS drift)*
2. **`portal/[token]/page.tsx`** — `jobs` query uses only `customer_id`, no `business_id` filter. The portal token row already has `business_id`; use it to scope the query. *(Low risk today; multi-business leak if ever multi-business)*
3. **`quote/[token]/actions.ts`** — `customers.update()` and `properties.update()` in `acceptEstimate` have no `business_id` filter; gated by `public_token` lookup only. Fix: derive `business_id` from the fetched estimate row and add to both update calls.
4. **Cron routes** (`morning-summary`, `evening-summary`) — query `jobs`/`estimates` without `business_id` filter and grab `pricing_settings` with `.limit(1)`. Safe for single-business only; needs business iteration before multi-business use.
5. **`leads` RLS SELECT/DELETE policies** — QUAL redundantly includes `business_id IS NOT NULL`; harmless now that column is NOT NULL but inconsistent with other tables. Cosmetic cleanup only.
6. Continue checking for legacy `created_by`/`user_id` assumptions in business-owned queries.
7. Continue replacing legacy `service_package`/package-name assumptions with itemized service booleans where appropriate.
8. Do not remove legacy `default_service_package` yet — still referenced in `scheduleFollowUpJob` fallback chain. Full compatibility audit required before removal.
9. Confirm `message_logs`, portal tokens, and customer-facing links continue to behave correctly after each cleanup patch.
10. Keep each cleanup patch small and reviewable.

---

### Phase 3 — Public Intake and Lead Workflow Improvements

**Goal:** Improve the WicksburgLawnService → YardOps lead lifecycle now that hardening is stable.

**Status:** ⏸ Pending

**Potential tasks:**
1. Improve public WicksburgLawnService intake to YardOps service mapping.
2. Make website lead service interests prefill YardOps property booleans more directly during conversion.
3. Improve lead conversion flow: lead → customer → property → estimate.
4. Preserve customer/parcel/address/service info across the full flow.
5. Reduce duplicated manual entry.
6. Ensure public intake and manual YardOps lead creation use consistent service language: Mowing, Weed Eating, Edging, Blow Off.
7. Keep WicksburgLawnService read-only unless explicitly asked to patch it.

---

### Phase 4 — Operations UX / Workflow Polish

**Goal:** Improve day-to-day YardOps usability after data hardening.

**Status:** ⏸ Pending

**Potential tasks:**
1. Customer/property workflow polish.
2. Estimate builder polish.
3. Estimate → job conversion polish.
4. Jobs page/service card polish.
5. Scheduling and recurring job improvements.
6. Equipment/maintenance polish.
7. Daily/weekly brief improvements.
8. Reports/export improvements.
9. Payment/portal/invoice polish.
10. Better validation/errors for forms.

---

### Phase 5 — Reporting, Automation, and Growth Features

**Goal:** Build features on top of the stable multi-business-safe foundation.

**Status:** ⏸ Pending

**Potential tasks:**
1. Daily brief and weekly brief improvements.
2. More useful revenue/expense reporting.
3. Better route/day planning.
4. Follow-up reminders.
5. Customer service history improvements.
6. Portal enhancements.
7. Better public quote/intake analytics.
8. Future multi-business/team/operator support if desired.

---

### Permanent Future-Handoff Requirements

Every future handoff to a new chat MUST include:
1. Instruction to read ARCHITECTURE.md and HANDOFF.md first.
2. Reminder that those docs are living source-of-truth documents.
3. Reminder to update those docs after verified/committed architecture, DB, migration, workflow, deployment, or major app behavior changes.
4. Latest verified commit.
5. Current Phase 2E / Phase 2F / post-hardening status.
6. Current open/deferred items.
7. Workflow guardrails:
   - Run `git status --short` before staging/committing/applying.
   - Never stage `.claude/`.
   - Never use `supabase db push`.
   - Use `npx supabase db query --linked --file` only after approval.
   - Never commit/push/apply migrations without explicit approval.
   - WicksburgLawnService is read-only unless explicitly told otherwise.
8. Known security follow-ups, including Supabase password rotation, without including secret values.

---

## 17. Design Principles

- **Mobile-first** — all pages designed for 320px+; sidebar hidden on mobile; bottom nav instead.
- **Dark theme only** — CSS custom properties in `globals.css`; no light mode; no Tailwind.
- **No inline DB queries in components** — all DB access is server-side (actions or page server components).
- **`revalidatePath()` after every mutation** — clears ISR cache so fresh data renders.
- **Timezone-aware date handling** — use user's configured `pricing_settings.time_zone`; never bare `new Date()` for comparisons.
- **No ORM** — direct Supabase JS SDK; simple and transparent.
- **Simplicity over features** — only ship what solves a real problem.

---

## 18. Job Preservation Warnings

These must not break during any refactor:

- **Recurring auto-schedule:** `completeJob()` checks `property.auto_schedule_next`, `service_frequency`, `scheduled_date`. All must remain present and non-null.
- **Recurrence chain:** `recurrence_source` and `next_job_created_id` must not be removed or reset.
- **`started_at` → `actual_minutes`:** `markInProgress()` sets `started_at`; `completeJob()` computes `actual_minutes`. Must stay coupled.
- **Reschedule log:** `reschedule_count` and `reschedule_log` are append-only.
- **Today page date assumptions:** `scheduled_date` as `YYYY-MM-DD`; `completed_at` as full ISO timestamp.
- **Estimate visit fields:** `visit_scheduled_date` and `visit_scheduled_time` appear on Today page.
- **`payment_status` enum:** `unpaid`, `partial`, `paid`, `not_billable` — renaming is a breaking change.
- **FK cascades:** `job_photos`, `job_visits`, `expenses` all use `job_id` as FK.

---

## 19. Developer Onboarding

### Prerequisites

- Node.js 18+, npm, Git
- Access to Supabase project `lewzqavgvltzwfeypvam` (or own dev project)
- Vercel account (optional for local dev)

### Local Setup

```bash
git clone https://github.com/DMart425/YardOps.git
cd yardops
npm install
```

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://lewzqavgvltzwfeypvam.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase dashboard>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard>
CRON_SECRET=<random string>
NEXT_PUBLIC_QUOTE_BASE_URL=http://localhost:3000
```

```bash
npx supabase link --project-ref lewzqavgvltzwfeypvam  # optional, for migrations
npm run dev
```

### Validation Commands

```bash
npx tsc --noEmit          # TypeScript check
npx eslint <file>         # ESLint on specific files
npm run lint              # Full lint
npm run build             # Production build check
```

### Common Pitfalls

- Using `new Date()` for date comparisons — use timezone-aware helpers (`getLocalDateStr`, etc.)
- Accessing `job.customers` or `job.properties` directly — may be array or object; always normalize with `Array.isArray()`
- Forgetting `revalidatePath()` after mutations — cached data won't update
- Querying `pricing_settings` with wrong FK — use `user_id`, not `created_by`
- Running `supabase db push` — don't; use `npx supabase db query --linked --file`

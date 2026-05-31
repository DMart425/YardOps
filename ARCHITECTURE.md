# YardOps Architecture

> **Living document.** Future coder chats MUST update this file whenever architecture, database state,
> workflows, major feature behavior, migrations, deployment assumptions, or project status changes.
> Any handoff to a new chat must reference this file and include a reminder to keep it updated.

Last updated: 2026-05-31
Current checkpoint commit: `2ca5a86` (Fix today date conversion crash — Phase 5I)
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
- Monitor daily/weekly workflow and cash flow via the `/today` operations brief (home dashboard)
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
│   │   └── invoice/[jobId]/      # Public: per-job invoice/receipt page (token-scoped)
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
│   ├── format.ts                 # Display formatting helpers: formatPhoneInput() — formats 10-digit US numbers as (xxx) xxx-xxxx; used on all phone input fields and customer-facing output
│   ├── geocode.ts                # Address geocoding helper
│   ├── frequency.ts              # Frequency and service interest helpers: normalizeFrequency(), formatFrequencyLabel(), parseWebsiteServiceInterests(), formatServiceInterestLabel()
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
- `name` — primary business display name. Resolution order: `businesses.name → profiles.business_name → 'Lawn Service'`. Do not hardcode tenant names as fallbacks.
- `phone` (nullable text) — business-scoped contact number. Configurable in Settings → Business Phone (saves via `businessId`). Resolution order for all customer-facing surfaces: `businesses.phone → profiles.business_phone → null`. Formatted as `(xxx) xxx-xxxx` using `formatPhoneInput()` at input and display. Added in migration `20260522000000_add_business_phone.sql`.

### `profiles` (1 per user)
- `id` (auth user ID)
- `business_name`, `owner_name`, `business_phone`, `business_email`
- `service_radius_miles`, `default_hourly_rate`, `minimum_visit_charge`
- `created_at`, `updated_at`
- **Note:** `profiles.business_name` and `profiles.business_phone` are now secondary fallbacks. Primary sources are `businesses.name` and `businesses.phone`. The Settings page does not expose UI to edit profile fields directly — it writes to `businesses` (phone) and `pricing_settings` (all other settings).

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
- `title`, `body`, `link_path`, `estimate_id` (nullable FK → estimates, **ON DELETE SET NULL**)
- `is_reviewed`, `reviewed_at`, `created_at`

**Note:** `estimate_id` uses `ON DELETE SET NULL` — deleting an estimate orphans any linked notification (sets `estimate_id = null`). All queries that count or display approval notifications must include `.not('estimate_id', 'is', null)` to exclude orphaned rows. The `convertToJob()` action auto-clears unreviewed approval notifications when an estimate is converted so they never surface as stale.

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

`internal_notes` from the parent job is also copied to the follow-up job.

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
| Preferred weekday snapping — V1 suggestion chip | ✅ Phase 5E | Optional 💡 chip in `ScheduleFollowUpCard`; uses `getClosestWeekdayNearDate` (±4 days, backward+forward, min=today); chip suppressed when no valid candidate |
| `preferred_service_day` capture in `/leads/new` | ✅ Phase 5F | `b90d0c3` — dropdown beside Requested Frequency; empty saves as null; no migration |
| `preferred_service_day` display on property detail | ✅ Phase 5F | `fd5ecd3` — Preferred day row in address + service info card; null shows "Any day" |
| Today page Collected today + This week stat cards | ✅ Phase 5G | `0a4ce23` — Collected today sums `amount_paid` from completed-today jobs (hides when zero); This week shows scheduled job count + expected revenue for current Sunday–Saturday window |
| Today page Needs Follow-up section | ✅ Phase 5G | `74b8a90` — recurring completed jobs with `next_job_created_id IS NULL` in last 30 days; limit 10; CTA links to `/jobs/[id]`; hides when empty |
| Today page Approved Estimates Waiting section | ✅ Phase 5G | `74b8a90` — approved estimates pending scheduling; limit 5; CTA links to `/estimates/[id]`; hides when empty |
| Today page visual polish | ✅ Phase 5H | `ee7f75b` — stat grid cleanup; Overdue moved before Completed Today; Needs Follow-up helper text, days-since, formatted frequency; Approved Estimates Waiting date label fixed to "Created" |
| Today page compact stat cards | ✅ Phase 5H | `3865e0d` + `b908ac7` — Jobs Today and This Week both use `count · $amount` single-card format |
| Today Needs Follow-up false-positive fix | ✅ Phase 5H | `b908ac7` — suppresses completed recurring jobs when same property has upcoming active recurring job; filter by `property_id` first, `customer_id` fallback; suppression scoped only to Needs Follow-up display |
| Estimate conversion `job_type` derivation | ✅ Phase 5I | `f1d77a6` — `weekly`/`biweekly` estimates → `recurring` job; `one_time`/`null`/other → `one_time` job; helper `deriveJobTypeFromFrequency()` in `estimates/actions.ts` |
| Estimate conversion `scheduled_time_window` | ✅ Phase 5I | `f1d77a6` — Time Window select added to convert panel in `EstimateStatusActions.tsx`; empty → null; morning/afternoon/evening saved to job |
| Needs Follow-up day-count fix | ✅ Phase 5I | `4af55db` + `2ca5a86` — days-since now compares local date-only values; `getLocalDateStr(timeZone, new Date(completed_at))` → `dateOnlyToUtcMs()` → integer days; 0 shows "today"; hotfix wrapped raw string in `new Date()` to prevent runtime crash |
| Route balancing / auto-scheduling for follow-up | ⏸ Future | Distributing customers evenly across the week is a larger feature; auto-scheduling on completion is not built; `Property.schedule_anchor_date` reserved for this; do not implement until explicitly asked |
| Printable/downloadable portal invoice PDF | ⏸ Future | Portal invoice page is web-only; PDF export not yet added |

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
| Exports/reporting | ✅ `finances/page.tsx` explicitly scopes all queries to `businessId`; `DataExportSection.tsx` was RLS-only at audit time (fixed in Phase 2G Task 1) |
| No blockers | ✅ No must-fix items found |

**Defense-in-depth findings (tracked in Phase 2G):** see Phase 2G section below.

---

### Phase 2G — Defense-in-Depth Cleanup

**Goal:** Clean up remaining hardening/consistency issues found during Phase 2D/2E and Phase 2F.

**Status:** ⏸ In Progress

**Completed items:**

1. **`DataExportSection.tsx`** ✅ — **User-tested in production (`9b61a62`).** Two patches applied:
   - `f0edcc8`: Added `requireBusinessContext()` and explicit `.eq('business_id', businessId)` to all three export queries (customers, properties, jobs). Replaced RLS-only scoping with explicit defense.
   - `9b61a62`: Export content improvements:
     - Customer `phone` formatted as `(xxx) xxx-xxxx` in CSV output (passthrough for unrecognized formats)
     - `customer_name` column added to properties and jobs exports (built from already-fetched customers data — no extra query)
     - `services` column added to jobs export: property boolean columns checked first (Mowing / Weed Eating / Edging / Blow Off); falls back to friendly `service_package` label; `service_package` retained for legacy/debug context
     - Four property boolean columns added to properties select to support jobs service label derivation

**Patch B — YardOps phone input formatting ✅ (user-tested `de10c59`):**

- Added `src/lib/format.ts` — exports `formatPhoneInput(value: string): string`; formats 10-digit numbers as `(xxx) xxx-xxxx`; handles leading `1`; graceful partial progress while typing; passthrough for unrecognized formats
- `leads/new/page.tsx` — manual lead phone field now formats on input (controlled `useState`)
- `customers/[id]/_form.tsx` — customer edit phone field now formats on input; existing raw-digit values display formatted on open (initialized via `formatPhoneInput`)
- `EstimateForm.tsx` — inline new-customer phone field now formats on input (existing state wrapped with `formatPhoneInput`)
- `quote/[token]/QuoteConfirmForm.tsx` — quote confirmation phone edit field now formats on input; existing value displays formatted when editing begins
- WicksburgLawnService phone input formatting is **Patch C** — separate repo, separate commit

**Patch C — WicksburgLawnService phone input formatting ✅ (user-tested `2a7b0f8` in `DMart425/WicksburgLawnService`):**

- `app/page.tsx` — added local `formatPhoneInput` helper (same logic as YardOps `src/lib/format.ts`); updated controlled phone `onChange` to format on keystroke
- Public quote intake form phone input now formats as `(xxx) xxx-xxxx` while typing
- No YardOps files changed. No SQL/migrations. Committed separately in WicksburgLawnService repo.

**`portal/[token]/page.tsx` business_id scoping ✅ (user-tested `71975dd`):**

- Added `business_id` to the `customer_portal_tokens` select
- Destructured `business_id` from portal token row
- Added `.eq('business_id', business_id)` to the jobs query alongside existing `customer_id` filter
- No SQL/migrations. No behavior change beyond scoping.

**`portal/[token]/page.tsx` service label modernization ✅ (user-tested `70fa054`):**

- Added `property_id` to jobs select
- Added parallel properties fetch (scoped by `customer_id` + `business_id`) to retrieve the four boolean columns
- Built `propertyMap: Map<string, PropertyBooleans>` from fetched properties
- Added `SERVICE_LABELS` map and `serviceLabel(pkg, prop)` helper (module-level): property booleans first → `SERVICE_LABELS[pkg]` → title-cased code → `'Lawn Service'`
- Removed old inline `pkgLabel()` — replaced both call sites (Upcoming + Service History) with `serviceLabel()`
- No SQL/migrations. No schema changes.

**`quote/[token]/actions.ts` business_id scoping ✅ (user-tested `5aff7d8`):**

- Added `business_id` to the `QuoteEstimate` type and to the estimate select in `acceptEstimate`
- Added `.eq('business_id', estimate.business_id)` to the `customers` update call
- Added `.eq('business_id', estimate.business_id)` to the lead→active `customers` update call
- Added `.eq('business_id', estimate.business_id)` to the `properties` update call
- Customer/property updates are now scoped by both `id` and `business_id` (defense-in-depth beyond `public_token` lookup)
- No SQL/migrations. No behavior change beyond scoping.

**`quote/[token]/page.tsx` UX fixes ✅ (user-tested `0a165d1`):**

- Accepted banner wording changed from `"You've already accepted this estimate. We'll be in touch soon!"` to `"Estimate accepted. We'll be in touch soon!"` — neutral wording works correctly for both immediate post-accept and revisit-after-accept scenarios
- Mobile header layout fixed: added `flex: '1 1 0', minWidth: 0` to the text block div; added `flexShrink: 0, whiteSpace: 'nowrap'` to the Call Now button wrapper div so the button no longer clips/crushes on narrow viewports
- No SQL/migrations.

**Cron routes multi-business scoping gap — documented and deferred:**

- `src/app/api/cron/morning-summary/route.ts` and `src/app/api/cron/evening-summary/route.ts` use `createAdminClient()` (RLS bypassed) and make no `business_id`-scoped queries.
- Both routes fetch `pricing_settings` with `.select('time_zone').limit(1).single()` — grabs the first row in the table, assumes single-business.
- `jobs` query (both routes): `.eq('scheduled_date', today)` only — no `business_id` filter.
- `estimates` query (morning only): `.eq('visit_scheduled_date', today)` only — no `business_id` filter.
- `notifyAllUsers()` (both routes): fetches all `push_subscriptions` rows without business scoping; notifies every subscribed user across all businesses.
- **Current single-business behavior is acceptable.** No code change needed now.
- **Deferred:** when multi-business support is actively being built, the routes will need to iterate per business (fetch all businesses, loop, scope each query by `business_id`, send per-business push to that business's users) or accept a scoped business context.
- **Do not change cron route code until multi-business support is being actively built.**

**`leads` RLS SELECT/DELETE cosmetic cleanup ✅ Applied and verified:**

- Migration file: `supabase/migrations/20260513200000_phase2g_leads_rls_cosmetic.sql` (committed `e85cbcc`)
- Applied manually via Supabase SQL Editor on `lewzqavgvltzwfeypvam` (Wicksburg Lawn Service / production) — Supabase CLI was unavailable due to `cli_login_postgres` role permission error on `SUPABASE_DB_PASSWORD`; SQL Editor succeeded
- `leads_select_business_member` (SELECT) — USING clause now: `is_business_member(business_id)` — redundant `business_id IS NOT NULL AND` prefix removed
- `leads_delete_business_member` (DELETE) — USING clause now: `is_business_member(business_id)` — redundant `business_id IS NOT NULL AND` prefix removed
- `leads_insert_business_member` (INSERT) — WITH CHECK unchanged: `((business_id IS NOT NULL) AND is_business_member(business_id))`
- `leads_update_business_member` (UPDATE) — USING and WITH CHECK unchanged: `((business_id IS NOT NULL) AND is_business_member(business_id))`
- Cosmetic only. No behavior change. No app code changes. `leads.business_id` is already `NOT NULL` at schema level so the removed check was redundant.
- Verified via `pg_policies` query — all four policies confirmed correct.

**Phase 2G status: ✅ Active cleanup list complete. One item deferred:**

- **Cron routes multi-business scoping:** documented and deferred — do not change cron route code until multi-business support is actively being built.
- **`leads` RLS SELECT/DELETE cosmetic cleanup:** ✅ applied and verified — complete.

**Ongoing standing notes:**

1. Continue checking for legacy `created_by`/`user_id` assumptions in business-owned queries.
2. Continue replacing legacy `service_package`/package-name assumptions with itemized service booleans where appropriate.
3. Do not remove legacy `default_service_package` yet — still referenced in `scheduleFollowUpJob` fallback chain. Full compatibility audit required before removal.
4. Confirm `message_logs`, portal tokens, and customer-facing links continue to behave correctly after each cleanup patch.
5. Keep each cleanup patch small and reviewable.

---

### Phase 3 — Public Intake and Lead Workflow Improvements

**Goal:** Improve the WicksburgLawnService → YardOps lead lifecycle now that hardening is stable.

**Status:** ⏸ In Progress

**Kickoff audit findings (2026-05-13):**
- Website lead detail page (`/leads/website/[id]`) displayed `lead.frequency` as raw stored value (e.g., `one_time`) — no friendly formatter applied
- Lead detail property card (`/leads/[id]`) displayed `item.service_frequency` with a manual `.replace(/_/g, ' ')` instead of `formatFrequencyLabel()`
- Service interests not shown on website lead detail page before conversion (tracked as Task 2)
- Notes-format dependency: `buildNotesWithServiceInterests` format (WicksburgLawnService) must stay in sync with `parseWebsiteServiceInterests` parser (YardOps) — fragile if either side changes
- Address parsing in `parseAddressParts()` is best-effort; comma-separated edge cases could mismatch

**Completed tasks:**

- **Task 1a — Website lead frequency display** ✅ (`0589026`): Added `formatFrequencyLabel` import to `leads/website/[id]/page.tsx`; replaced raw `lead.frequency` display with `formatFrequencyLabel(lead.frequency)`. No data changes.
- **Task 1b — Lead detail property frequency display** ✅ (`3cc8a77`): Added `formatFrequencyLabel` to existing `@/lib/frequency` import in `leads/[id]/page.tsx`; replaced `.replace(/_/g, ' ')` with `formatFrequencyLabel(item.service_frequency)`. No data changes.
- **Task 2a — Website lead service interests display** ✅ (`591ca1b`): Added `parseWebsiteServiceInterests` and `formatServiceInterestLabel` imports; parsed structured `"Website service interests:"` block from `lead.notes`; rendered itemized pills in Request Details card before conversion. No data changes.
- **Task 2b — Website lead notes cleanup** ✅ (`f496246`): Added `stripServiceInterestsBlock()` local helper to strip the structured intake block from the visible Customer Notes display — prevents the structured block from appearing twice (once as pills, once as raw text). No data changes.
- **Task 3 — Quote page frequency label** ✅ (`5f9ba2d`): Changed quote summary card header from `"{FREQ} Lawn Service"` to `"Service Frequency — {FREQ}"` — correctly labels frequency as frequency, not service type. No data changes.
- **Task 4 — Website lead frequency label rename** ✅ (`1941585`): Changed Request Details row label from `"Requested Service"` to `"Service Frequency"` on website lead detail page — consistent with quote page wording. No data changes.
- **Task 5 — Manual lead detail visual alignment** ✅ (`820b053`): Aligned `leads/[id]/page.tsx` with website lead detail visual style — `detail-section` wrappers throughout, section headings outside cards, Contact section renamed `"Contact Info"` with icon rows and Call/Text/Email quick-action buttons, structured intake block stripped from visible notes via `stripStructuredIntakeBlock()`, `"Request Details"` section label used for intake context. No data changes.
- **Task 6 — Manual lead request/property display merge** ✅ (`4001837`): Added comparison logic to suppress or contextualise original website request data based on whether a property already exists. Three cases: (a) no property → show `"Requested Service Setup"` section prominently; (b) one property where request matches property setup → suppress duplicate section entirely; (c) one differing property or multiple properties → show compact `"Original website request: ..."` note near the property card. Boolean comparison mirrors `formatDefaultServices()` semantics exactly (`mowing !== false`; others `=== true`). No data changes. No SQL/migrations. WicksburgLawnService not touched.
- **Patch 1 — Add Property acreage prefill** ✅ (`0e724ea`, user-tested): `leads/[id]/page.tsx` now appends `parcel_acres` and `estimated_mowable_acres` to the `addPropertyHref` URL when parcel data exists. `parcelAcres` and `mowableAcres` were already computed for the parcel card display; two `addPropertyParams.set()` calls and the `const addPropertyHref` declaration were moved to after the parcel calculation block so the values are in scope. `properties/new` already accepted both params — no changes to the property form or `createProperty()` action required. No SQL/migrations. WicksburgLawnService not touched. All existing Add Property params preserved.
- **Patch 2 — Add Property parcel_id carryover** ✅ (`4c18726`, user-tested): `leads/[id]/page.tsx` now also appends `parcel_id` and `lot_size_source=parcel` to `addPropertyHref` when a matched parcel exists. `properties/new` updated to accept and destructure both params and pass them into `PropertyForm` `defaultValues`. `PropertyForm` already read `defaultValues.parcel_id` and emitted it as a hidden input; `createProperty()` already inserted it — no changes needed to either. After property save, `ApplyParcelButton` shows `✓ Parcel data already applied` on first render. `ApplyParcelButton` remains unchanged for existing/manual correction cases. No SQL/migrations. WicksburgLawnService not touched.
- **Parcel Lookup lot-size fallback fix** ✅ (`fddb06a`, user-tested): Fixed `computeParcel()` in `ParcelLookup.tsx` — changed `const parcelAcresBase = rawParcelAcres ?? sqftParcelAcres` to `(rawParcelAcres != null && rawParcelAcres > 0) ? rawParcelAcres : sqftParcelAcres`. Nullish coalescing did not bypass `0`, so parcels with `CALC_ACRES = 0` in raw_json never fell back to `lot_sqft`. Now they do. No SQL/migrations.
- **Parcel Lookup zero acreage skip** ✅ (`01b1d11`, user-tested): Added `pickFirstPositiveNumber()` helper alongside existing `pickFirstNumber()`. Replaced `pickFirstNumber` with `pickFirstPositiveNumber` for the `rawParcelAcres` calculation only — skips zero values so later fields like `DeededAcres` can be reached. `timberAcres` continues to use `pickFirstNumber` (zero timber is valid). Example: 500 BILLINGS TRL (`CALC_ACRES=0`, `DeededAcres=0.42`) now shows `0.42 ac total`. Parcels with all-zero acreage (e.g., 500 REDBUD CIR) correctly remain "No usable lot size data". No SQL/migrations.
- **Patch 3 — Add Property county prefill** ✅ (`8966add`, user-tested): `leads/[id]/page.tsx` now derives and passes `county` to the Add Property URL when a matched parcel exists. County extraction: tries `raw_json.attributes` for `['county', 'County', 'SitusCounty', 'SITUS_COUNTY']` first; if none found and `parcel.source` is set, runs a secondary read-only query to `parcel_sources.county` via `source_key`. `source: string | null` added to `ParcelRow` type; `source` added to parcel `.select()` string. County appended as `?county=...` only when a value is found — no hardcoded fallback. `properties/new` was already fully wired for the `county` URL param — no changes to that page, `PropertyForm`, or `createProperty()`. Production test: Houston County parcels now prefill county field correctly. No SQL/migrations. All existing Add Property params preserved.
- **normalizeFrequency cleanup** ✅ (`df491c0`): Removed duplicate/unreachable cases — the two-block structure (Block A "canonical" + Block B "legacy") collapsed into a single linear block. Dead cases removed: duplicate `weekly` check, duplicate `biweekly`/`bi-weekly` checks. All accepted inputs preserved: `weekly`, `biweekly`, `bi-weekly`, `bi weekly`, `one_time`, `one time`, `one-time`, `one-time cut`, `one time cut`, `custom`, `paused`; `unsure`/`not sure yet`/`not sure` still return null. No behavior change. Updated header comment to list all accepted inputs. Only `src/lib/frequency.ts` changed.
- **EstimateForm hint clarity** ✅ (`1db4f33`, user-tested): `EstimateForm.tsx` now imports `formatFrequencyLabel` and uses it for the frequency-defaulted hint (shows `Bi-weekly` instead of `biweekly`). Frequency hint is suppressed when `mapPropertyFrequency()` returns null (e.g., `custom`/`paused`) to avoid contradictory display. Service defaults hint replaced with a unified IIFE: shows `"Service defaults applied from property: Mowing, Weed eating, ..."` when `propertyBooleanDefaults()` is non-null (modern properties); falls back to `"Service defaults applied from legacy package: ..."` only when actually using the legacy package path. No pricing, submission, or default behavior changed.
- **Job detail label polish** ✅ (`e3a510e`, user-tested): `jobs/[id]/page.tsx` now uses a local `SERVICE_LABELS` map for `🌿 Package` display — `mow_only → 'Mow Only'`, `mow_trim_blow → 'Mow, Trim & Blow'`, `trim_cleanup → 'Trim & Cleanup'`, `full_service → 'Full Service'`; unknown codes fall back to title-case, null falls back to `'Standard Mow'`. Added `JOB_TYPE_LABELS` map for `🔄 Type` display — `one_time → 'One-time'`, `recurring → 'Recurring'`. Production tested: Mow Only, Full Service, Mow Trim & Blow, One-time, Recurring, itemized Service Scope all confirmed. No job data, estimate conversion, invoice, payment, or status behavior changed.
- **Approved estimate operator workflow** ✅ (`f305373`, user-tested): Three file changes: (1) `estimates/page.tsx` — `STATUS_FILTERS` extended with `['approved', 'Approved']` tab between Open and Draft; (2) `estimates/[id]/page.tsx` — approved-state banner added when `estimate.status === 'approved'`, prompting operator to convert to job; (3) `estimates/actions.ts` `convertToJob()` — best-effort `app_notifications` UPDATE to mark unreviewed approval notifications as reviewed immediately on conversion, plus `revalidatePath('/today')` added. No SQL/migrations.
- **Estimates default to Open + converted notification filtering** ✅ (`e7407c9`, user-tested): `estimates/page.tsx` default filter changed from `'all'` to `'open'` so the list opens on actionable estimates. `(protected)/layout.tsx` and `today/page.tsx` notification queries updated with `estimates!estimate_id(status)` embedded join and a JS filter to exclude converted-estimate notifications from badge count and Today card. **SQL cleanup run manually in Supabase SQL Editor against `lewzqavgvltzwfeypvam`:** (a) all unreviewed `estimate_approved` notifications whose linked estimate has `status = 'converted'` were marked reviewed; (b) all unreviewed `estimate_approved` notifications with `estimate_id = null` (Dustin Martin — estimate deleted, FK set to null via `ON DELETE SET NULL`) were marked reviewed.
- **Orphaned estimate notification guard** ✅ (`1c19d44`, user-tested): Added `.not('estimate_id', 'is', null)` to both `(protected)/layout.tsx` and `today/page.tsx` approval notification queries. Permanent guard — deleted-estimate orphaned notifications (where `estimate_id = null` due to `ON DELETE SET NULL`) never drive the badge count or Today card. Root cause: Supabase `ON DELETE SET NULL` on `app_notifications.estimate_id` — deleting an estimate nullifies the FK, leaving the notification row orphaned. SQL cleanup removed existing orphaned rows; this guard prevents any future orphans from surfacing.
- **Post-estimate workflow audit** ✅: Full read-only audit of the accepted-estimate → job → completion → payment → follow-up flow. Findings: (1) Today page still used `(job.service_package ?? job.job_type)!.replace(/_/g, ' ')` in two card locations and one SMS body — `job_type` fallback could show `"one time"` / `"recurring"` as service label; (2) Invoice PDF has redundant + raw service description (deferred); (3) SMS invoice body used raw replace; (4) `scheduleFollowUpJob` shows for all completed jobs regardless of `job_type`; (5) ARCHITECTURE.md `auto_schedule_next` note was inaccurate — follow-up is always manual. No schema or behavior issues found.
- **Today service label polish** ✅ (`cb05cdd`, user-tested): Added `SERVICE_LABELS` map and `servicePackageLabel()` helper to `today/page.tsx` (matching the pattern in `jobs/page.tsx` and `jobs/[id]/page.tsx`). Replaced `(job.service_package ?? job.job_type)!.replace(/_/g, ' ')` in Today's Jobs and Tomorrow's Jobs card sections — no `job_type` fallback, friendly labels used (`"Mow, Trim & Blow"` not `"mow trim blow"`). Also fixed the Tomorrow reminder SMS `pkg` variable (same file). Fixed `buildInvoiceSms()` in `JobActions.tsx` — added `SMS_SERVICE_LABELS` map; completion invoice SMS now shows `"Service: Mow, Trim & Blow"`. `DownloadInvoiceButton.tsx` intentionally not touched — PDF invoice description cleanup is a possible follow-on. No scheduling, payment, or status behavior changed. No SQL/migrations.
- **PDF invoice service description cleanup** ✅ (`46fc17b`, user-tested): `DownloadInvoiceButton.tsx` — replaced multi-line `const desc` ternary that produced redundant strings like `"Lawn Service - Mow, Trim & Blow (mow trim blow)"` with a single `const desc = data.jobTitle`. Estimate-converted job titles are already fully descriptive. No layout, payment, or banner behavior changed.
- **Paid-at-completion amount persistence + PDF totals alignment** ✅ (`dd19b02`, user-tested): Two fixes in one commit: (1) `completeJob()` in `jobs/actions.ts` — resolves `paymentStatus` and `finalPrice` before the DB update; now writes `amount_paid: paymentStatus === 'paid' ? finalPrice : null`. Prior to this, completing a job as "Paid now" set `payment_status = 'paid'` but left `amount_paid = null`, causing the PDF invoice to show a contradictory PAID banner with $0 paid and full balance due. `markPaid()` and `markPartial()` unchanged. (2) `DownloadInvoiceButton.tsx` — "Total:", "Paid:", and "Balance Due:" label x-positions moved from `pageWidth - margin - 80` to `pageWidth - margin - 120` to prevent the "Balance Due:" label (12pt bold, ~79pt wide) from overlapping the value column at only 80pt clearance. PDF PAID banner condition unchanged — correct once `amount_paid` is properly populated.
- **One-time paid job data repair** ✅ (SQL only, `lewzqavgvltzwfeypvam`): After `dd19b02`, audited all Wicksburg jobs with `payment_status = 'paid' AND COALESCE(amount_paid, 0) = 0`. After targeted cleanup, query returned no rows. No remaining Wicksburg paid jobs have missing `amount_paid`.
- **SaaS-safe invoice business name fallback** ✅ (`2342041`): `jobs/[id]/page.tsx` — changed `DownloadInvoiceButton` `businessName` prop from `profile?.business_name ?? 'Wicksburg Lawn Service'` to `profile?.business_name ?? 'Lawn Service'`. Removes hardcoded tenant name from invoice fallback.
- **Invoice business name from business context** ✅ (`ec48565`, user-tested): `jobs/[id]/page.tsx` — added `supabase.from('businesses').select('name').eq('id', businessId).single()` using the already-resolved `businessId` from `requireBusinessContext()`; updated `businessName` prop to `business?.name ?? profile?.business_name ?? 'Lawn Service'`. Invoice header now uses `businesses.name` as primary source. `businessPhone` and `businessEmail` remain profile-sourced — no business-level contact columns exist yet. **Future SaaS direction:** business identity, contact fields, and payment branding should eventually move to a proper business-scoped settings source. Do not re-hardcode tenant names as fallbacks.

**Potential tasks (remaining):**
1. ~~Frequency display polish~~ ✅ complete (Tasks 1a, 1b)
2. ~~Show service interests on website lead detail page~~ ✅ complete (Tasks 2a, 2b)
3. ~~Quote page and lead detail copy/label fixes~~ ✅ complete (Tasks 3, 4)
4. ~~Manual lead detail visual alignment and deduplication~~ ✅ complete (Tasks 5, 6)
5. ~~Add Property acreage prefill from matched parcel~~ ✅ complete (Patch 1)
6. ~~Add Property parcel_id carryover~~ ✅ complete (Patch 2)
7. ~~Parcel Lookup lot-size fallback and zero-skip fixes~~ ✅ complete (`fddb06a`, `01b1d11`)
8. ~~Add Property county prefill from matched parcel~~ ✅ complete (Patch 3, `8966add`)
9. ~~normalizeFrequency duplicate/unreachable case cleanup~~ ✅ complete (`df491c0`)
10. ~~EstimateForm hint clarity — frequency label and service defaults~~ ✅ complete (`1db4f33`)
11. ~~Job detail service package and job type label polish~~ ✅ complete (`e3a510e`)
12. ~~Approved estimate operator workflow — Approved tab, approved-state banner, convertToJob notification clear + /today revalidate~~ ✅ complete (`f305373`)
13. ~~Estimates default to Open; converted-estimate notification filtering; stale notification SQL cleanup~~ ✅ complete (`e7407c9`)
14. ~~Orphaned estimate notification guard — null estimate_id filter in layout and Today notification queries~~ ✅ complete (`1c19d44`)
15. ~~Post-estimate workflow audit — scheduling, completion, payment, follow-up flow~~ ✅ complete (read-only audit)
16. ~~Today page service labels — SERVICE_LABELS map, no job_type fallback, friendly labels in cards and SMS bodies~~ ✅ complete (`cb05cdd`)
17. Improve public WicksburgLawnService intake to YardOps service mapping.
18. Improve lead conversion flow: lead → customer → property → estimate.
19. Preserve customer/parcel/address/service info across the full flow.
20. Reduce duplicated manual entry.
21. Ensure public intake and manual YardOps lead creation use consistent service language: Mowing, Weed Eating, Edging, Blow Off.
22. ~~Review PDF invoice service description — remove redundant raw service package parenthetical.~~ ✅ complete (`46fc17b`)
23. Keep WicksburgLawnService read-only unless explicitly asked to patch it.

---

### Phase 4 — Operations UX / Workflow Polish

**Goal:** Improve day-to-day YardOps usability after data hardening.

**Status:** ✅ Substantially Complete

**Completed (4A–4D + payment bugfixes + cleanup):**

- **4A/4B — Today and Jobs page polish:** Today stat cards are actionable links to filtered Jobs views. Jobs page: status label polish, overdue count, weekly scheduled total, cancelled/skipped filter, pagination clarity. Customer/property detail pages link to filtered Jobs views; property detail has "+ New Job" shortcut. "Total revenue" relabeled to "Total billed" on customer/property detail (accrual vs. cash clarity).
- **4C — Follow-up scheduling improvements:** Explicit property frequency required. Blow off label aligned. `unsure` frequency preserved in lead notes. Parent job shows Follow-up Visit summary. One-time job flag on follow-up card. `internal_notes` carried forward to follow-up job. Warning when suggested date is in the past.
- **4D — Finances display polish:** Uncollected receivables card (all-time completed unpaid/partial, links to Jobs filter). Month selector responsive grid. Expense list cap disclosed when truncated.
- **Payment bugfixes (production-verified):** `completeJob()` now correctly handles all four payment paths. `markPartial()` is cumulative. Complete Job panel supports partial payment at completion. Past-date guard on both `rescheduleJob()` and `scheduleFollowUpJob()`. See §18 for full behavior spec.
- **Phase 4 cleanup:** Customer detail `+ New Job` shortcut (`5acdcbb`). Today capped list disclosure notes (`890cfcf`). `staleUnpaidCount` internal rename in `jobs/page.tsx` (`c1b22b9`). Job detail payment summary row wording for all four payment status cases (`463e762`).

---

### Phase 5 — Reporting, Automation, and Growth Features

**Goal:** Build features on top of the stable multi-business-safe foundation.

**Status:** ⏸ In Progress

#### Phase 5A — Customer Collections / Receivables (⏸ In Progress)

**Completed:**
- Customers list unpaid balance badges — orange dollar amount shown on customer cards with outstanding balances (`53b22c0`)
- Customer detail Outstanding Balance section — per-job unpaid/partial list with amounts, dates, and links to job detail (`95cb0cc`)
- Customer detail Send Balance Reminder SMS — pre-filled SMS with total balance, per-job breakdown, Venmo handle, and customer portal link (`0259d1e`, `561bf76`, `7093925`)
- Customer portal service history payment clarity — due/remaining/paid/partial/not-billable states shown with contextual wording and amounts; partial state shows subtext with amount paid and total (`8232e4a`)

**Portal SMS token behavior:**
- `getOrCreatePortalToken()` (`customers/[id]/portal-actions.ts`) called only when `outstandingJobs.length > 0 && customerRow.phone`
- Token is permanent, one-per-customer; upsert with `onConflict: 'customer_id'`
- Portal URL: `NEXT_PUBLIC_QUOTE_BASE_URL ?? 'https://app.wicksburglawnservice.com'` + `/portal/${token}`

**Potential next Phase 5 tasks:**
1. Operational weekly summary improvements.
2. ~~Estimate → job conversion polish.~~ ✅ complete (see Phase 5B)
3. Revenue/expense reporting improvements.
4. Portal enhancements (customer-facing UX).
5. Bulk job actions.
6. Better public quote/intake analytics.
7. Future multi-business/team/operator support if desired.

---

### Phase 5B — Estimate Conversion Polish & Business-Scoped Phone

**Goal:** Polish the estimate → job conversion workflow and add a proper business-scoped phone for customer-facing communications.

**Status:** ✅ Complete (2026-05-22)

**Commits:** `2fd14eb`, `4f3254b`, `924dead`, `ac212ba`

**Estimate conversion polish (`2fd14eb`, `4f3254b`):**

- `convertToJob()` in `estimates/actions.ts` — added duplicate conversion guard: returns early with error if `estimate.status === 'converted'`; prevents double-conversion if action is triggered twice
- Converted estimate detail (`estimates/[id]/page.tsx`) — looks up linked job via `jobs.estimate_id + business_id` when `estimate.status === 'converted'`; renders **View Job →** button when a linked job is found
- Estimate SMS business name now uses `businesses.name` as primary source, then `profiles.business_name`, then `'Lawn Service'` — matches the resolution already established in `jobs/[id]/page.tsx`

**Business-scoped phone (`924dead`, `ac212ba`):**

- Migration: `supabase/migrations/20260522000000_add_business_phone.sql` — adds `phone text` (nullable) to `businesses`. Applied and verified on `lewzqavgvltzwfeypvam`.
- `src/types/database.ts` — added `Business` interface with `phone: string | null`
- Settings → Business Phone field: saves to `businesses.phone` using `businessId` (business-scoped, not user-scoped). `saveSettings()` updated to call `requireBusinessContext()` and write `businesses.phone` in parallel with `pricing_settings` upsert
- Phone input live-formats while typing using existing `formatPhoneInput()` from `src/lib/format.ts` (same pattern as customer/lead phone fields)
- Resolution order for all customer-facing surfaces: `businesses.phone → profiles.business_phone → null`
- Surfaces updated: estimate SMS, job invoice PDF (`DownloadInvoiceButton`), customer portal (header + contact section)
- Display formatting: `formatPhoneInput()` applied at read time on all server-rendered surfaces so raw-digit stored values display as `(xxx) xxx-xxxx`

**Deferred from this phase:**

- Job detail **View Estimate** link when `job.estimate_id` exists — not yet added
- Convert-to-job date/time pre-fill polish — not yet added
- Public quote page phone source — uses a separate data path; not updated in this phase
- `JobActions` component SMS messages (on-my-way, day-before, job-complete) — `businessPhone` not yet passed as a prop; still phone-free in SMS bodies
- Operational weekly summary improvements

---

### Phase 5C — Portal Invoices, Receipt SMS, and Payment Receipt Stability

**Goal:** Give customers a permanent per-job invoice URL via the portal. Provide the operator with a receipt SMS for later payment events. Fix repeated partial payment submission stability.

**Status:** ✅ Complete (2026-05-23)

**Commits:** `da7e53e`, `b6ed6b3`, `453d43f`, `a70c6dc`, `0351ab6`, `b70f1b2`, `13de697`, `ba85520`, `7c5280a`

**Portal invoice page (`da7e53e`, `b6ed6b3`, `453d43f`):**

- New public route `/portal/[token]/invoice/[jobId]` — per-job invoice/receipt page, accessible without auth via portal token
- Job is double-scoped by both `customer_id` (via token lookup) and `business_id` — cannot access another customer's or business's job via URL manipulation
- Uses `createAdminClient()` (bypasses RLS, same as portal main page)
- `portal/[token]/page.tsx` service history rows now include **View Invoice** links pointing to `/portal/[token]/invoice/[jobId]` for completed jobs
- Completion SMS (`buildInvoiceSms()`) now includes the portal invoice URL as a clickable link for the customer

**Receipt SMS for later payment events (`a70c6dc`, `0351ab6`):**

- `buildPaymentReceiptSms()` — new SMS builder for operator-triggered receipt after `markPaid()` / `markPartial()` post-completion
- Distinct from `buildInvoiceSms()` (auto-shown at job completion) — receipt SMS must NOT reference job completion; job was already completed earlier
- `not_billable` jobs: no owed amount displayed, no invoice/payment SMS shown
- `JobActions.tsx` uses `pendingReceipt` state to pre-build the SMS body in the submit button `onClick` before the server action fires; SMS compose sheet opens after the action succeeds

**Repeated partial payment stability fix (`b70f1b2`, `13de697`, `ba85520`, `7c5280a`):**

- Root cause of regressions: attempts to "reset" the form after submission used `setState` in submit button `onClick` that caused the form to unmount before the native `submit` event fired, preventing `markPartial()` from receiving `FormData`
- React 18 invariant: state updates in `onClick` are flushed synchronously after the handler returns but BEFORE the browser fires the native `submit` event — unmounting the form in `onClick` means the submit event fires against nothing
- Correct fix (`7c5280a`): controlled `laterPartialAmt` input; no form-structural state in `onClick`; only `setPendingReceipt` (side-effect, doesn't affect form DOM); input cleared after success via deferred `useEffect` with `setTimeout(..., 0)` (satisfies `react-hooks/set-state-in-effect` ESLint rule)
- This invariant is documented in `AGENTS.md` Durable Development Rules as a permanent constraint — see §20 for full rule

---

### Phase 5D — Follow-up Completion-Date Anchor

**Goal:** Prevent follow-up date drift when jobs complete early or late relative to their scheduled date.

**Status:** ✅ Complete (2026-05-23)

**Commit:** `b985bb3`

- `jobs/[id]/page.tsx` — computes `completedDateLocal = getLocalDateStr(timeZone, new Date(job.completed_at))` server-side when `completed_at` is present; passes as `completedDate` prop to `ScheduleFollowUpCard`
- `ScheduleFollowUpCard.tsx` — added `completedDate?: string | null` prop; anchors `suggestedDate` from `completedDate ?? scheduledDate`
- No migration. No behavior change for jobs without `completed_at`.

---

### Phase 5E — Optional Scheduling Helper (Follow-up Suggestion Chips)

**Goal:** Surface optional date suggestions on the `ScheduleFollowUpCard` to help the operator pick a good follow-up date faster — without removing manual control.

**Status:** ✅ Complete (2026-05-31)

**Commits:** `315268c` (V1 implementation), `49c051f` (preferred weekday closest-date fix)

#### What was built

`ScheduleFollowUpCard` was extended with up to three optional suggestion chips shown above the date input. Clicking a chip fills the date field; it does not submit. Manual date entry is always the authority. Chips are suppressed entirely when not applicable.

**Chip 1 — Cadence 📅**

- Always shown when cadence date is known (weekly +7 / biweekly +14 from anchor)
- Note: "7-day cadence" or "14-day cadence"

**Chip 2 — Preferred day 💡**

- Shown when `Property.preferred_service_day` is set AND a cadence date is known
- Uses `getClosestWeekdayNearDate(suggestedDate, preferredServiceDay, { minDate: todayLocal, maxDays: 4 })`
- Searches both backward AND forward from the cadence date within ±4 days; closer candidate wins; ties prefer future
- Excludes candidates before today (`minDate`)
- Suppressed when the cadence date is already on the preferred weekday, or when no candidate falls within ±4 days
- Note: "Preferred day"

**Chip 3 — Lighter workload ⚡**

- Shown when `scheduledJobDates` is populated and at least one of chips 1–2 is shown (max 3 chips total)
- Forward-only scan (+1 to +6 days from cadence date); first date with ≥2 fewer jobs than cadence date wins
- Note: "Lighter day (N jobs)"

#### Server-side data fetching

- `preferred_service_day` added to the `properties` join in `jobs/[id]/page.tsx`
- `scheduledJobDates` query runs only when `job.status === 'completed' && !job.next_job_created_id`; fetches `scheduled_date` for all non-cancelled/skipped jobs in the next 21 days for the same business
- No migration required — `preferred_service_day` already existed in the schema and `PropertyForm`

#### `getClosestWeekdayNearDate` algorithm (`src/lib/date.ts`)

```
backDays = (currentDay - target + 7) % 7   // days to go backward
fwdDays  = 7 - backDays                     // days to go forward (always backDays + fwdDays = 7)
```
- If `backDays > maxDays` → backward candidate excluded
- If `fwdDays > maxDays` → forward candidate excluded
- Backward candidate also excluded when it falls before `minDate`
- Both valid → smaller distance wins; ties prefer future
- Neither valid → returns `startDate` unchanged (caller suppresses chip)

#### What remains deferred

- Route balancing (distributing customers evenly across days of the week) — `Property.schedule_anchor_date` reserved for this
- Auto-scheduling (completing a job auto-creates the follow-up) — not built; `property.auto_schedule_next` reserved
- ~~Preferred service day capture on `leads/new` fast-entry form~~ ✅ complete in Phase 5F (`b90d0c3`)
- Weather/rain-day shifting — not planned

---

### Phase 5F — Manual Lead Preferred Service Day

**Goal:** Close the gap from Phase 5E — `preferred_service_day` was capturable in `PropertyForm` but not in the manual lead fast-entry flow (`/leads/new`), and was not visible on the property detail page.

**Status:** ✅ Complete (2026-05-31)

**Commits:** `b90d0c3` (capture in `/leads/new`), `fd5ecd3` (display on property detail)

#### Changes

**`/leads/new` form capture (`b90d0c3`):**
- Added optional Preferred Service Day dropdown beside Requested Frequency in a `form-row` pair
- Values match `PropertyForm` exactly: `''` (Any day → `null`), `monday` … `saturday`
- Helper text: "Optional — helps YardOps suggest follow-up dates. You can still schedule any day."
- `createLead()` in `leads/actions.ts` passes `preferred_service_day: str(formData, 'preferred_service_day')` into the property insert
- Empty `''` → `str()` returns `null` → DB column receives `NULL`
- No migration — column already existed

**Property detail display (`fd5ecd3`):**
- Preferred day row added to the address + service info card on `/properties/[id]`, directly below Frequency
- `null` → displays "Any day"
- Set value → title-cased, e.g. `thursday` → "Thursday"
- Read-only display only; no edit behavior changed

#### `preferred_service_day` coverage (complete after Phase 5F)

| Surface | Read | Write |
|---------|------|-------|
| `/leads/new` fast-entry | — | ✅ `b90d0c3` |
| `PropertyForm` (create/edit via `/properties/new`, `/properties/[id]`) | — | ✅ Pre-existing |
| `properties/[id]` detail card | ✅ `fd5ecd3` | — |
| `ScheduleFollowUpCard` 💡 chip | ✅ Phase 5E | — |
| `jobs/[id]/page.tsx` join | ✅ Phase 5E | — |
| `customers/[id]/page.tsx` | ✅ Pre-existing | — |

---

### Phase 5G — Today Operations Brief

**Goal:** Enhance `/today` (the operations home) with actionable summary sections beyond job lists — giving the operator a fast at-a-glance read on what needs attention.

**Status:** ✅ Complete (2026-05-31)

**Commits:** `0a4ce23` (stat cards), `74b8a90` (action sections)

#### `/today` as the operations brief

`/today` is the operator's home dashboard — the root path redirects to it. After Phase 5G it runs ~14 parallel queries and assembles a complete daily operations view. All additions are read-only link surfaces. No automation, no background side effects.

#### Phase 5G-A — Stat cards (`0a4ce23`)

Two new stat cards added to the stat grid:

| Card | Logic | Notes |
|------|-------|-------|
| **Collected today** | Sum of `amount_paid` from completed-today jobs | `not_billable` contributes 0 naturally; hidden when zero; links to Jobs filtered by today's completions |
| **This week** | Count + expected revenue of scheduled/in-progress/needs-reschedule jobs for current Sunday–Saturday week | Week range uses Sunday-start UTC calculation matching `jobs/page.tsx` pattern; links to `/jobs?filter=week` |

#### Phase 5G-B — Action sections (`74b8a90`)

Two new conditional sections inserted after Tomorrow's Jobs, before Unpaid:

**Needs Follow-up**
- Query: `jobs` where `status=completed`, `job_type=recurring`, `next_job_created_id IS NULL`, `completed_at >= 30 days ago`; limit 10
- Shows: job title, customer name, property address, completed date, service frequency
- CTA: **Schedule Follow-up** → `/jobs/[id]`
- Disappears naturally when follow-up is created (`next_job_created_id` populated by `scheduleFollowUpJob`)

**Approved Estimates Waiting**
- Query: `estimates` where `status=approved`; limit 5
- Shows: customer name, property address, estimate total, created date; `pill-approved` badge
- CTA: **Schedule Job** → `/estimates/[id]`
- Disappears naturally when estimate leaves `approved` status (converted/declined/expired)

Both sections are hidden when empty — no visual noise on a clean dashboard.

#### No route/nav/schema changes

No new routes added. No nav items added. No schema migrations. No env var changes.

---

### Phase 5H — Today Operations Brief Visual Polish

**Goal:** Reduce visual clutter on `/today` and fix a false-positive in Needs Follow-up without adding new features.

**Status:** ✅ Complete (2026-05-31)

**Commits:** `ee7f75b` (visual polish), `3865e0d` (compact stat cards), `b908ac7` (week stat + follow-up filter fix)

#### Stat card format (current)

All stat cards that pair a count with an amount use a single compact card:

| Card | Value format | Label | Link |
|------|-------------|-------|------|
| Jobs today | `{count} · ${amount}` | Jobs today | `/jobs?view=scheduled&filter=today` |
| This week | `{count} · ${amount}` | This week | `/jobs?filter=week` |
| Collected today | `${amount}` (hidden when 0) | Collected today | `/jobs?view=completed&filter=today` |
| Completed today | `{count}` | Completed today | `/jobs?view=completed&filter=today` |
| Overdue | `{count}` (colored) | Overdue | `/jobs?view=scheduled&filter=overdue` |
| Unpaid balance | `${amount}` (colored) | Unpaid balance | `/jobs?view=completed&filter=unpaid` |
| New leads | `{count}` (colored) | New leads | `/leads` |

#### Section order (current)

1. Page header
2. EstimateApprovalNotifications
3. Rain warning banner
4. Recurring gap alert
5. Dormant/retention alert
6. Stat grid
7. Today's Jobs (always — has empty state)
8. Estimate Visits (conditional)
9. **Overdue** (conditional) — moved before Completed Today in Phase 5H
10. **Completed Today** (conditional)
11. Tomorrow's Jobs (conditional)
12. Needs Follow-up (conditional)
13. Approved Estimates Waiting (conditional)
14. Unpaid (conditional)

#### Needs Follow-up — query and filtering

**Base query** (unchanged from Phase 5G): `jobs` where `status=completed`, `job_type=recurring`, `next_job_created_id IS NULL`, `completed_at >= 30 days ago`; selects `id, title, completed_at, property_id, customer_id` + customer/property joins; limit 10.

**Suppression query** (added Phase 5H `b908ac7`): `jobs` where `business_id`, `job_type=recurring`, `status` in `scheduled/in_progress/needs_reschedule`, `scheduled_date >= today`; selects `id, property_id, customer_id, scheduled_date`. No limit — used only for Set membership lookup.

**Filter logic** (applied after Promise.all — no DB round-trip):
1. Build `upcomingPropertyIds` Set from suppression query results where `property_id != null`
2. Build `upcomingCustomerIds` Set from suppression query results where `customer_id != null` (fallback only)
3. For each candidate follow-up job:
   - If `property_id` non-null → exclude if `upcomingPropertyIds.has(property_id)`
   - If `property_id` null and `customer_id` non-null → exclude if `upcomingCustomerIds.has(customer_id)`
   - Otherwise → keep

**Scope:** suppression affects only the Needs Follow-up section display. The suppression query result is not used anywhere else. Future jobs remain fully visible on Jobs page, Tomorrow section, This Week stat, and all other views.

#### Other Phase 5H polish

- Estimate Visits heading: `📋` emoji removed (consistent with all other section headings)
- Estimate Visits card: redundant raw phone number row removed (Remind button is the action surface)
- Needs Follow-up: helper text added; `formatFrequencyLabel()` applied to raw frequency value; days-since computed from `todayStartMs - new Date(completed_at).getTime()` (same pattern as Overdue's `daysLate`)
- Approved Estimates Waiting: helper text added; date label changed from "Approved" to "Created" (field is `created_at`, not `accepted_at`/`manually_approved_at`)

#### No route/nav/schema changes

No new routes. No nav items. No schema migrations. No env var changes.

---

### Phase 5I — Approved Estimate to Job Flow Fix

**Goal:** Ensure estimate → job conversion preserves the recurring intent of the estimate, and fix a runtime crash in `/today`.

**Status:** ✅ Complete (2026-05-31)

**Commits:** `f1d77a6` (conversion fixes), `4af55db` (day-count fix), `2ca5a86` (runtime hotfix)

#### `job_type` derivation from estimate frequency (`f1d77a6`)

`convertToJob()` in `src/app/(protected)/estimates/actions.ts` previously hardcoded `job_type: 'one_time'` for all converted jobs. This silently broke the follow-up scheduling flow for recurring-service customers: after completing a `one_time` job, the `ScheduleFollowUpCard` never appeared and the customer dropped out of Needs Follow-up.

**Fix:** Added `deriveJobTypeFromFrequency(frequency: string | null): 'one_time' | 'recurring'` helper:

```ts
function deriveJobTypeFromFrequency(frequency: string | null): 'one_time' | 'recurring' {
  if (frequency === 'weekly' || frequency === 'biweekly') return 'recurring'
  return 'one_time'
}
```

| `estimate.frequency` | `job.job_type` |
|---------------------|----------------|
| `'weekly'` | `'recurring'` |
| `'biweekly'` | `'recurring'` |
| `'one_time'` | `'one_time'` |
| `'monthly'` / `null` / other | `'one_time'` |

`estimate.frequency` is a top-level column on the `estimates` table — no join needed; `convertToJob()` already fetches `select('*')`.

**All other conversion fields preserved:**

| Field | Source |
|-------|--------|
| `customer_id` | `estimate.customer_id` |
| `property_id` | `estimate.property_id` |
| `estimate_id` | estimateId argument |
| `price` | `estimate.total` |
| `quoted_total` | `estimate.total` |
| `title` | `deriveJobScopeFromEstimate()` |
| `service_package` | `deriveJobScopeFromEstimate()` |
| `internal_notes` | `deriveJobScopeFromEstimate()` (scope checklist) |
| `customer_notes` | `estimate.notes` |
| `scheduled_date` | operator input |
| `scheduled_time_window` | operator input (new) |
| `payment_status` | always `'unpaid'` |
| `status` | always `'scheduled'` |

Post-conversion: estimate → `status = 'converted'`; customer `lead → active`; approval notification cleared; `revalidatePath('/today')`; redirect to `/jobs/[newJobId]`. Duplicate conversion guard unchanged.

#### Time Window capture in convert panel (`f1d77a6`)

`EstimateStatusActions.tsx` convert panel expanded: Scheduled Date and Time Window now appear side-by-side in a `form-row`. Time Window select (`name="scheduled_time_window"`, defaultValue `""`) offers Any time / Morning / Afternoon / Evening. Empty value passes through `str()` helper as `null`; named values save to `job.scheduled_time_window`.

#### Needs Follow-up day-count fix (`4af55db` + `2ca5a86`)

**Original bug:** `daysSince` was computed as `Math.floor((todayStartMs - new Date(job.completed_at).getTime()) / 86400000)`. For a job completed later in the current day, this produced a negative integer (e.g., `-1d ago`).

**Root cause of hotfix crash (`2ca5a86`):** The first fix attempt passed the raw `job.completed_at` string directly to `getLocalDateStr(timeZone, date: Date)`. Dynamic Supabase `.select()` leaves the field typed as `any`, so TypeScript did not catch the type mismatch at build time. At runtime, `Intl.DateTimeFormat.format(someString)` coerced the string to `NaN` and threw `RangeError: Invalid time value`, crashing the entire `/today` server component.

**Correct fix:**
```ts
const daysSince = job.completed_at
  ? Math.max(0, Math.floor((todayStartMs - dateOnlyToUtcMs(getLocalDateStr(timeZone, new Date(job.completed_at)))) / 86400000))
  : null
```

Logic:
1. `new Date(job.completed_at)` — convert ISO string to `Date` (required by `getLocalDateStr`)
2. `getLocalDateStr(timeZone, date)` — convert to local calendar date string (`YYYY-MM-DD`)
3. `dateOnlyToUtcMs(dateStr)` — convert to date-only UTC milliseconds
4. Compare against `todayStartMs` (already date-only UTC ms)
5. `Math.max(0, ...)` — safety clamp against edge cases

Display: `daysSince === 0` → `"today"`; `>= 1` → `"Xd ago"`.

**Lesson:** Dynamic Supabase selects return `any`-typed fields. Always wrap ISO timestamp strings in `new Date()` before passing to helpers typed as `(date: Date)`.

#### No route/nav/schema changes

No new routes. No nav items. No schema migrations. No RLS changes. No env var changes.

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

- **Follow-up scheduling:** Follow-up visits are always manually created via `scheduleFollowUpJob()` — `completeJob()` does NOT auto-schedule. The `ScheduleFollowUpCard` component appears after completion and suggests a date based on `property.service_frequency` (+7 days weekly / +14 days biweekly), anchored from `job.completed_at` (converted to local date via `getLocalDateStr(timeZone, ...)` server-side) when available, falling back to `scheduled_date`. This prevents follow-up date drift when jobs are completed early or late. `internal_notes` from the parent job is copied to the follow-up. `property.auto_schedule_next`, `property.service_frequency`, `Property.preferred_service_day`, and `Property.schedule_anchor_date` must remain present for future auto-schedule and preferred weekday implementation.
- **Past-date guards on scheduling:** `rescheduleJob()` and `scheduleFollowUpJob()` both validate that the submitted date is not in the past (server-side, timezone-aware via `getLocalDateStr` / `resolveTimeZone`). Today is allowed; yesterday and older are rejected. Client-side `min` date inputs provide a matching UX guard. Do not remove these guards.
- **Recurrence chain:** `recurrence_source` and `next_job_created_id` must not be removed or reset.
- **`started_at` → `actual_minutes`:** `markInProgress()` sets `started_at`; `completeJob()` computes `actual_minutes`. Must stay coupled.
- **Reschedule log:** `reschedule_count` and `reschedule_log` are append-only.
- **Today page date assumptions:** `scheduled_date` as `YYYY-MM-DD`; `completed_at` as full ISO timestamp.
- **Estimate visit fields:** `visit_scheduled_date` and `visit_scheduled_time` appear on Today page.
- **`payment_status` enum:** `unpaid`, `partial`, `paid`, `not_billable` — renaming is a breaking change.
- **`amount_paid` on completion:** `completeJob()` resolves `amount_paid` based on the payment path selected at completion:
  - `paid` → `amount_paid = finalPrice`
  - `partial` → `amount_paid = Math.min(partialAmt, finalPrice)`; auto-promotes to `payment_status = 'paid'` if amount ≥ price
  - `unpaid` / `not_billable` → `amount_paid = 0`

  `markPartial()` (post-completion partial payments) is **cumulative** — adds the submitted amount to existing `amount_paid`, clamps to price, auto-promotes to `paid` when total ≥ price. `markPaid()` sets `amount_paid = price`. These behaviors must stay coupled — the invoice PDF relies on `amount_paid` being correct for its PAID banner and balance display.
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

---

## 20. Portal Invoice & Payment Behavior

### Portal Invoice Route Security

- Route: `/portal/[token]/invoice/[jobId]` — public, no auth, token-scoped
- Job is double-scoped: `customer_id` (derived from token lookup) + `business_id` (from token row)
- A manipulated `[jobId]` for a different customer or business will fail the lookup — both scopes must match
- Uses `createAdminClient()` (same as portal main page — RLS bypassed, security is in the explicit scoping)
- Do not weaken this double-scope without explicit approval

### SMS Behavior Split

Two distinct SMS paths exist at job completion and later payment. Do not merge them:

| SMS | Builder | Trigger | Notes |
|-----|---------|---------|-------|
| **Completion invoice SMS** | `buildInvoiceSms()` | Auto-shown after `completeJob()` | May reference job completion; includes portal invoice link |
| **Later payment receipt SMS** | `buildPaymentReceiptSms()` | Operator-triggered after `markPaid()` / `markPartial()` post-completion | Must NOT say "job complete" — job was already completed earlier |

### `not_billable` Job Behavior

- `not_billable` jobs never show an owed balance in the UI
- No invoice/payment SMS is shown for `not_billable` jobs — neither completion SMS nor receipt SMS
- PDF invoice download is still available for record-keeping; PAID banner and balance due section reflect zero charge

### `useActionState` Form Invariant

This invariant was established after multiple partial payment regressions. It is a permanent hard constraint:

**Never call `setState` in a submit button `onClick` that causes the form (or any ancestor wrapping the `useActionState` form) to unmount or key-remount.**

React 18 flushes batched state updates synchronously after the `onClick` handler returns, but BEFORE the browser dispatches the native `submit` event. If the form is unmounted during the flush, the `submit` event fires against nothing and the server action never receives `FormData`.

**Safe** in a submit button `onClick`:
- Side-effect state that does not affect the form's DOM presence (e.g., `setPendingReceipt({ ... })` to pre-build an SMS body)

**Forbidden** in a submit button `onClick`:
- `setPanel(null)` — collapses the panel containing the form
- `setFormKey(k => k + 1)` — key-remounts the form
- Any `setState` that hides, removes, or replaces the `<form>` element before `submit` fires

To clear a form input after a successful submission, use a deferred `useEffect`:

```tsx
useEffect(() => {
  if (!state.success) return
  const id = setTimeout(() => setInputValue(''), 0)
  return () => clearTimeout(id)
}, [state])
```

The `setTimeout(..., 0)` defers the state update to avoid the `react-hooks/set-state-in-effect` ESLint error.

### Follow-up Date Anchor

`ScheduleFollowUpCard` anchors its suggested date from:

1. `job.completed_at` → converted to `YYYY-MM-DD` using `getLocalDateStr(timeZone, new Date(job.completed_at))` computed server-side in `jobs/[id]/page.tsx`
2. Falls back to `job.scheduled_date` when `completed_at` is absent

This prevents cumulative follow-up date drift when jobs are completed early or late relative to their scheduled date. `scheduled_date` is a planning artifact; `completed_at` is ground truth.

`Property.preferred_service_day` is used in Phase 5E: the optional 💡 chip in `ScheduleFollowUpCard` snaps to the nearest matching weekday within ±4 days of the cadence target using `getClosestWeekdayNearDate`. This is a suggestion chip only — it does not force the date.

Phase 5F completed the capture loop: `/leads/new` now writes `preferred_service_day` into manually-created properties (`b90d0c3`), and the property detail summary card displays it (`fd5ecd3`). All entry paths — `/leads/new`, `PropertyForm` (create/edit) — now write the field. All read surfaces — property detail, customer detail, job detail (via chip), `ScheduleFollowUpCard` — now consume it.

`Property.schedule_anchor_date` remains in the schema for future route balancing and auto-scheduling — not yet implemented. Do not add that logic until explicitly asked.

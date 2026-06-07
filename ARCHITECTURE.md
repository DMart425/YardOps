# YardOps Architecture

> **Living document.** Future coder chats MUST update this file whenever architecture, database state,
> workflows, major feature behavior, migrations, deployment assumptions, or project status changes.
> Any handoff to a new chat must reference this file and include a reminder to keep it updated.

Last updated: 2026-06-07
Current checkpoint commit: `0cd8a60` (Link converted estimates to source follow-ups — Phase 5X.5 complete)
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
│   ├── geocode.ts                # Address geocoding helper: geocodeAddress() — Nominatim/OSM, free, no API key, 30-day cache, city/ZIP centroid fallback when street fails
│   ├── weather.ts                # Weather helper: getForecast() / getTodayForecastForCoords() — Open-Meteo, free, no API key, 30-min cache, current + daily fields
│   ├── frequency.ts              # Frequency and service interest helpers: normalizeFrequency(), formatFrequencyLabel(), parseWebsiteServiceInterests(), formatServiceInterestLabel()
│   ├── jobScope.ts               # Shared job scope helpers (Phase 5T): parseJobInputs(), formatCoreServicesForCustomer(), formatAddonsForCustomer(), resolveServiceLabel(), buildDefaultCompletionNotes() — pure TypeScript; no React; used by portal server components and JobActions client component
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
- `job_inputs` (nullable JSONB — structured service scope; added Phase 5Q migration `20260531120000_add_jobs_job_inputs.sql`)
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
- `source_job_id` (nullable uuid FK → jobs ON DELETE SET NULL) — operator-internal link to the completed job that prompted this estimate (Phase 5X.3)
- `satisfies_follow_up` (boolean NOT NULL DEFAULT false) — when true, the job created from this estimate closes the source job's follow-up slot (Phase 5X.3)
- `sets_property_defaults` (boolean NOT NULL DEFAULT false) — when true, approving this estimate updates the property's default service agreement (Phase 5X.4a); migration `20260606130000_add_estimates_sets_property_defaults.sql`
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

### `job_inputs` JSONB — Source of Truth for New Jobs (Phase 5Q+)

`jobs.job_inputs` is a nullable JSONB column added in Phase 5Q. It stores structured service scope for jobs created or converted after that migration.

```
{
  svcMowing: boolean,        svcWeedEating: boolean,
  svcEdging: boolean,        svcBlowOff: boolean,
  baggingLevel: string,      stickPickupLevel: string,
  leafCleanupLevel: string,  haulOffLevel: string,
  shrubSmallCount: number,   shrubMediumCount: number,  shrubLargeCount: number
}
```

- Written by `JobForm` on new job creation.
- Written by `convertToJob()` via `deriveJobInputsFromEstimateInputs()` on estimate conversion.
- Copied by `scheduleFollowUpJob()` from parent job when non-null.
- `null` on legacy jobs is acceptable — display falls back to `service_package`.

### Property Booleans — Property-Level Defaults

After property save, the service scope defaults are stored in four boolean columns:
- `default_mowing_enabled`
- `default_weed_eating_enabled`
- `default_edging_enabled`
- `default_blow_off_enabled`

`null` = not yet reviewed. `true`/`false` = explicitly set. These are prefill hints for new jobs — not locked scope.

`default_service_package` is **soft-retired** and must not be dropped yet. Existing values preserved on update. New properties get `null`.

### Service Display Priority (Job Detail and Today)

1. **`job.job_inputs`** (if present) → `🌿 Services`: itemized from `svcMowing`/`svcWeedEating`/`svcEdging`/`svcBlowOff`; `✨ Add-ons` row shown when any level is non-`'none'`
2. **`job.service_package`** code → friendly label (legacy fallback when `job_inputs` is null)
3. **No 🌿 line** if neither is available
4. **`job_type`** (`'recurring'`, `'one_time'`) is **never** displayed as a service label — UI should use `property.service_frequency` instead

### Helpers in `jobs/page.tsx`

- `formatServicePackage(pkg)` — maps package codes to friendly labels; handles unknown codes with underscore-replace
- `formatServiceBooleans(prop)` — builds itemized list from property boolean columns
- `serviceLabel(pkg, propRaw)` — calls `formatServiceBooleans` first; falls back to `formatServicePackage`

### Helpers in `jobs/actions.ts`

- `deriveServicePackageFromBooleans(prop)` — maps boolean columns to a `service_package` code for storage in follow-up jobs created by `scheduleFollowUpJob`

### Helpers in `estimates/actions.ts`

- `deriveJobInputsFromEstimateInputs(raw)` — maps `estimate_inputs` JSONB to a `JobInputs` object; null/non-object input returns `null` safely; individual missing keys fall back to `false` / `'none'` / `0`

### Shared helpers in `src/lib/jobScope.ts` (Phase 5T+)

Pure TypeScript module — no React imports. Used by portal server components and `JobActions` client component.

- `parseJobInputs(raw)` — null-safe JSONB parser; returns `ParsedJobInputs | null`; uses `'svcMowing' in raw` as Phase 5Q+ marker; safe defaults for all fields
- `formatCoreServicesForCustomer(inputs)` — comma-separated customer-friendly core service label (e.g., `"Mowing, Weed eating, Edging"`)
- `formatAddonsForCustomer(inputs)` — comma-separated customer-friendly add-on label; suppresses internal level detail; shows shrub total count only (e.g., `"Bagging clippings, Shrub trimming (3)"`)
- `resolveServiceLabel(jobInputs, pkg, title)` — priority: `job_inputs` core services → `SERVICE_LABELS[pkg]` → capitalised code → `title` → `'Lawn Service'`; used on portal home and portal invoice
- `buildDefaultCompletionNotes(jobInputs, servicePackage)` — operator-facing past-tense completion note autofill (Phase 5U); priority: `job_inputs` structured scope → `PKG_COMPLETION_NOTES[servicePackage]` → `'Lawn service completed'`; result is a `defaultValue` for the textarea — always editable

**Customer-facing scope display rule:** Portal and invoice surfaces must prefer `job_inputs` when present. Property default booleans (`default_mowing_enabled`, etc.) describe current property intent — they must not be used to describe what was performed on a specific historical job.

### Job Creation Paths and job_inputs Coverage

| Path | job_inputs written? | Notes |
|------|---------------------|-------|
| `/jobs/new` (JobForm) | ✅ Always | From form checkboxes/selects |
| `convertToJob()` direct estimate convert | ✅ Phase 5Q.4b+ | From `deriveJobInputsFromEstimateInputs(estimate_inputs)` |
| `/jobs/new?estimate_id=` (estimate prefill) | ✅ Phase 5Q.3b+ | Via JobForm with `estimatePrefill` props; Phase 5R: also marks estimate `converted`, promotes lead→active, clears approval notification |
| `scheduleFollowUpJob()` | ✅ Phase 5Q.2b+ | Copied from parent job when non-null |
| `/jobs/new` source selector (Estimate option) | ✅ Phase 5S | Operator selects an approved estimate via picker; hidden `estimate_id` field added; same validation + conversion side effects as `?estimate_id=` path |
| `/jobs/new` source selector (Property/Custom) | ✅ Phase 5R/5S | Estimate source not selected; `estimate_id` absent; no conversion side effects |
| Legacy jobs (pre-5Q.1) | ❌ null | Display falls back to `service_package` |

### Follow-up Job Service Carryover

`scheduleFollowUpJob` now uses a two-level strategy:
1. **`job_inputs`** copied from parent job (when non-null) — structured scope preserved
2. **`service_package`** three-level fallback (parent `service_package` → property `default_service_package` → derived from property booleans) — legacy path when `job_inputs` is null

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

### Known Migration History Drift

`20260531120000_add_jobs_job_inputs.sql` (adds `jobs.job_inputs` nullable JSONB) was applied directly to the Supabase project via `npx supabase db query --linked` rather than through Supabase CLI migration tracking. The migration file exists in `supabase/migrations/` but is **not tracked in the remote migration history**. Running `supabase db push` would attempt to replay it and fail. This is a known state — do not attempt to repair it by pushing. All future migrations must continue to use `npx supabase db query --linked --file`.

`20260606130000_add_estimates_sets_property_defaults.sql` (adds `sets_property_defaults boolean NOT NULL DEFAULT false` to `estimates`) was applied via `npx supabase db query --linked --file` and is committed in `supabase/migrations/`. Same drift caveat applies — do not `supabase db push`.

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
| Job detail Payment Summary polish | ✅ Phase 5J | `041f355` + `389fd88` — aggregate-only display; explicit per-status branches; partial shows Price + Amount paid + Balance due; `payment_method` human-readable via `PAYMENT_METHOD_LABELS`; removed duplicate partial inline text from `JobActions.tsx` |
| New Job property prefill polish | ✅ Phase 5K | `a3d990b` — `property.default_price` → price; property boolean columns → `service_package` (via `deriveServicePackageFromBooleans`); `service_frequency` → `job_type` (via `deriveJobTypeFromFrequency`); `job_type` select converted to controlled |
| Save estimate price as property default on convert | ✅ Phase 5K | `b9fa8db` + `08608eb` — opt-in checkbox in convert panel; `defaultChecked` when no existing default; best-effort `properties.update` in `convertToJob()`; shows current value when one exists |
| Missing price guardrails V1 | ✅ Phase 5L | `a28e3d1` — `markPaid()` stores `amount_paid=0` when price null; Today Unpaid shows "No price set"; Pay Reminder SMS suppressed; Complete Job panel price hint; Payment Summary "Price · Not set" |
| Customer/property navigation polish | ✅ Phase 5M | `b8444dd` + `67b9e80` — contextual `+ New Estimate` buttons on customer and property detail; `View Customer` linked row in property info card; `View Estimate →` link on job detail; clickable Customer/Property rows in estimate summary; `View Customer`/`View Property` action buttons; `Manage Estimate` card heading |
| Estimate detail state polish | ✅ Phase 5N | `e2d42a1` — per-status top banners; Schedule Visit and Send to Customer hidden for `converted`/`declined`; no action/SMS/schema changes |
| Financial summary null-price display fixes | ✅ Phase 5O | `0e91bf9` — customer detail Outstanding Balance tracks no-price unpaid jobs separately; muted note; no phantom $0 total; Today Completed Today balance null-aware; no-price jobs do not show `$0 owed`; no schema/SMS/payment-action changes |
| Job service scope inputs (job_inputs foundation) | ✅ Phase 5Q.1 | `14c3d83` + `2fa58a4` — nullable JSONB `jobs.job_inputs`; JobForm replaced package dropdown with service checkboxes + add-on fields; new jobs write structured scope |
| Job service scope display + frequency label | ✅ Phase 5Q.2 | `958e876` + `5a8b489` + `6ec4305` — job detail shows 🌿 Services from job_inputs; ✨ Add-ons row; property frequency shown instead of job_type; Today prefers property booleans |
| Estimate-linked job_inputs backfill + follow-up copy | ✅ Phase 5Q.2b | SQL applied directly + `7c1768c` — 5 historical jobs backfilled; `scheduleFollowUpJob` now copies job_inputs from parent |
| New job prefill source note | ✅ Phase 5Q.3a | `9563c76` — JobForm shows contextual note for manual entry / property defaults / estimate prefill states |
| Exact estimate prefill for /jobs/new | ✅ Phase 5Q.3b | `53c51b2` — `/jobs/new?estimate_id=` validates and prefills all scope from approved estimate |
| Lead gate for estimate conversion | ✅ Phase 5Q.4a | `0f81d6d` — approved estimate for lead customer shows Mark as Active Customer; Convert to Job hidden until active |
| Direct estimate conversion writes job_inputs | ✅ Phase 5Q.4b | `e3f241f` — `convertToJob()` now writes job_inputs from estimate_inputs via `deriveJobInputsFromEstimateInputs()` |
| Estimate conversion preferred-day default | ✅ Phase 5Q.4c | `f8f4adc` — convert panel defaults scheduled date to next preferred_service_day (maxDays: 7); operator can override |
| `createJob` from /jobs/new marks estimate converted | ✅ Phase 5R | `ee0f6e3` — `createJob()` validates `estimate_id`, marks estimate `converted`, promotes lead→active, clears approval notification; equivalent to direct `convertToJob()` outcome |
| Review & Create Job button on estimate detail | ✅ Phase 5R | `06575b2` + `13be6a0` + `5a80b37` — secondary job creation path from estimate detail; grouped with Convert to Job in `EstimateStatusActions`; lead-gated |
| New Job source selector (Estimate / Property / Custom) | ✅ Phase 5S | `ca4a01e` — radio group shown when approved estimates exist for selected property; Estimate option adds hidden `estimate_id`; switching away removes it |
| Portal/invoice service scope from job_inputs | ✅ Phase 5T | `b0d4f46` — portal home + portal invoice both prefer `job_inputs`; add-ons subline shown when selected; `src/lib/jobScope.ts` shared helper created |
| Completion notes autofill from job scope | ✅ Phase 5U | `4e2c815` — quick chips removed; textarea `defaultValue` built from `buildDefaultCompletionNotes()`; operator can edit freely before submitting |
| Today weather unavailable fallback | ✅ Phase 5V | `030fec4` — when coords exist but Open-Meteo fails, shows "Weather unavailable for this property." instead of silently hiding |
| Today weather address geocode fallback | ✅ Phase 5V | `85a9651` — when stored lat/lon is null, geocodes from `service_address + city + state + postal_code` via Nominatim; no DB write-back; 30-day cache |
| Today weather city/ZIP geocode fallback | ✅ Phase 5V | `7c08ebc` — when street-level geocode fails (rural road not in OSM), drops street number and resolves city/state/ZIP centroid |
| Today weather current conditions | ✅ Phase 5V | `43a198f` — adds `current=temperature_2m,weather_code` to Open-Meteo request; card now shows `{currentTemp}° now · {currentCondition} · High {dailyHigh}°` instead of daily dominant code |
| Approved estimate + New Job entry point integration | ⏸ Deferred | Customer/property page + New Job buttons do not yet pass `estimate_id`; source selector handles this ad-hoc when operator selects the property |
| `/jobs/new?source_job_id` reviewable follow-up creation | ⏸ Deferred | Phase 5Q deferred — follow-up scheduling continues via `ScheduleFollowUpCard` with property defaults; service/frequency/price changes route through estimates (Phase 5W product direction) |
| Package-only historical job backfill | ⏸ Deferred | No approximation backfill without estimate_inputs source |
| Follow-up job_inputs copy runtime test | ⏸ Pending | Code committed; no qualifying completed job with non-null job_inputs has been followed up in production yet |
| SMS invoice/receipt scope text | ⏸ Deferred | `buildInvoiceSms()` note uses generic "Lawn service"; detailed scope text from `job_inputs` not yet added to SMS bodies |
| PDF invoice description from job_inputs | ⏸ Deferred | `DownloadInvoiceButton.tsx` uses `job.title`; structured scope description polish deferred |
| Estimate source-job model (Phase 5X) | ✅ Complete 5X.3–5X.5 | `source_job_id`, `satisfies_follow_up`, `sets_property_defaults` — see §16 |
| Estimate detail badge for `sets_property_defaults` | ⏸ Deferred | Phase 5X.4e — visible badge/notice on estimate detail when `sets_property_defaults = true` |
| Pricing/time model audit for mowable acres | ⏸ Deferred | Phase 5X.6 candidate |

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

### Phase 5J — Payment Summary Polish ✅

**Commits:** `041f355` (payment summary card + partial row fix), `389fd88` (remove duplicate partial status text)

#### Payment Summary card (`041f355`)

`jobs/[id]/page.tsx` — completed job detail now shows a **Payment Summary** card (above `JobActions`) when `job.status === 'completed'`. Implemented as aggregate-only display. No payment event table exists — do NOT call this "payment history."

**Fields used:**
- `job.price` — the price set at job creation or update
- `job.amount_paid` — cumulative amount collected (last-write-wins for paid/partial via `markPaid()`/`markPartial()`)
- `job.payment_status` — `'unpaid'` | `'partial'` | `'paid'` | `'not_billable'`
- `job.payment_method` — last method recorded; displayed via `PAYMENT_METHOD_LABELS` map for human-readable labels

**Display branches:**

| Status | Rows shown |
|--------|-----------|
| `not_billable` | Status pill only ("No payment due") — no Price, no Amount paid, no Balance due |
| `partial` | Price · Amount paid (always) · Balance due (when `payBalance != null`) · Status · Method (if set) |
| `paid` | Price · Amount paid (when > 0) · Status · Method (if set) |
| `unpaid` | Price · Balance due (when `payBalance != null`) · Status |

`payBalance = Math.max(0, payPrice - payAmtPaid)` — never negative.

**`payment_method` display:** `PAYMENT_METHOD_LABELS` maps `cash`, `venmo`, `card`, `check`, `cashapp`, `zelle`, `other` to human-readable strings. Unknown codes fall back to title-cased code via `formatPaymentMethod()`. `payment_method` is a last-write-wins field — not a payment log.

**`not_billable` invariant:** Never show owed amount, balance due, or invoice/payment SMS for `not_billable` jobs. Enforced here and in `JobActions`.

#### Duplicate partial status text removal (`389fd88`)

`JobActions.tsx` — removed duplicate orange inline partial status text (`"Partial: $X of $Y paid — $Z remaining"`) that appeared above the Venmo payment SMS section. The Payment Summary card (added in `041f355`) already shows the same information in a cleaner format. The Venmo SMS section itself was preserved.

No new routes. No nav items. No schema migrations. No RLS changes. No env var changes.

---

### Phase 5K — New Job Prefill Polish ✅

**Commits:** `a3d990b` (New Job property prefill), `b9fa8db` (save estimate price as property default), `08608eb` (checkbox label spacing fix)

#### New Job property prefill (`a3d990b`)

When the operator selects a property in the New Job form, the form now auto-populates three fields from property defaults:

**Price:** `property.default_price` → price field. Prefilled on initial load when `defaultPropertyId` is passed. Prefilled dynamically on property change. If the property has no `default_price`, the price field is left empty with a hint ("No default price set — enter price before completing this job."). **No parcel-acreage pricing or other heuristics.** Only `property.default_price` is permitted as a prefill source.

**Service package:** `deriveServicePackageFromBooleans()` in `JobForm.tsx` maps the four boolean columns to a `service_package` code:
- All false/null → `''`
- mow only → `'mow_only'`
- mow + weed eating + blow off → `'mow_trim_blow'`
- no mow + any of weed eating/edging/blow off → `'trim_cleanup'`
- mow + any of weed eating/edging/blow off → `'full_service'`

Booleans are preferred over legacy `property.default_service_package`; `default_service_package` is fallback only.

**Job type:** `deriveJobTypeFromFrequency()` in `JobForm.tsx` maps `property.service_frequency` to `job_type`: `weekly`/`biweekly` → `'recurring'`; everything else → `'one_time'`. This matches the estimate conversion rule. The `job_type` select was **converted from uncontrolled (`defaultValue`) to controlled (`value={jobType}`)** so it updates on property change.

**Files changed:**
- `src/components/forms/JobForm.tsx` — added `deriveServicePackageFromBooleans()`, `deriveJobTypeFromFrequency()`, extended `PropertyOption` interface with boolean columns, added `jobType` state, converted `job_type` select to controlled, added price hint
- `src/app/(protected)/jobs/new/page.tsx` — extended properties query to include four boolean columns

No schema migrations. No RLS changes. No env var changes.

#### Save estimate price as property default on convert (`b9fa8db` + `08608eb`)

**Goal:** When converting an approved estimate to a job, give the operator an easy way to save the estimate total as the property's default price for future jobs.

**UI:** `EstimateStatusActions.tsx` — "Save as default price" checkbox in the convert panel. `defaultChecked={propertyDefaultPrice == null}` (checked by default when no default exists). When a default exists, the current value is shown as a muted note `"(currently $X.XX)"`. Label has an explicit `{' '}` space token to prevent JSX whitespace collapse between the `$X.XX` expression and the following text. `08608eb` fixed this spacing issue.

**Server action:** `convertToJob()` in `estimates/actions.ts` — after the job insert succeeds, reads `save_as_default_price` from `formData`. If `'on'` and `estimate.property_id` exists and `estimate.total > 0`, performs a best-effort `properties.update({ default_price: estimate.total })` scoped by `property_id` + `business_id`. Does not block conversion if the update fails. Calls `revalidatePath('/properties/[id]')` on success.

**Data flow:** `estimates/[id]/page.tsx` fetches `properties(... default_price)` in the join and passes `propertyDefaultPrice={property.default_price ?? null}` to `EstimateStatusActions`.

No schema migrations. No RLS changes. No env var changes.

---

### Phase 5L — Data Integrity Guardrails V1 ✅

**Commit:** `a28e3d1` (Add missing price guardrails)

Job `price` is nullable and intentionally optional in V1. However, null price was causing misleading displays in several places. This phase adds lightweight guardrails without blocking any operator workflows.

**No migration. No schema changes. No RLS changes. No SMS builder changes. Price remains optional.**

#### Task A — `markPaid()` data consistency (`a28e3d1`)

`jobs/actions.ts` `markPaid()` previously stored `amount_paid: job?.price ?? null`. When price is null, this produced `payment_status='paid'` + `amount_paid=null` — inconsistent aggregate state.

Fix: `amount_paid: job?.price ?? 0`. When price is null, `amount_paid = 0` is stored alongside `payment_status='paid'`. Consistent with the `completeJob()` behavior for the same case.

#### Task B — Today Unpaid "No price set" display (`a28e3d1`)

`today/page.tsx` Unpaid section previously computed `balance = (job.price ?? 0) - (job.amount_paid ?? 0)`, causing null-price unpaid jobs to show "$0 due" — misleading.

Fix:
```ts
const balance = job.price != null
  ? Math.max(0, Number(job.price) - Number(job.amount_paid ?? 0))
  : null
```
Display: `balance != null ? `${balance.toFixed(0)} due` : 'No price set'`

Pay Reminder SMS button also gated on `balance != null` — cannot construct a valid "$X balance" SMS without a known price.

Jobs with real prices display exactly as before.

#### Task C — Complete Job panel price hint (`a28e3d1`)

`JobActions.tsx` Complete Job panel: static helper text added below Final Price input:

> "Enter a price to record the correct payment amount and generate an invoice."

Always visible when panel is open. No state. No blocking. Price remains optional.

#### Task D — Payment Summary "Price · Not set" (`a28e3d1`)

`jobs/[id]/page.tsx` Payment Summary: `{payPrice != null && (...)}` changed to a ternary that shows "Price · Not set" (muted) when `payPrice === null` for non-`not_billable` jobs. Previously the payment summary was silently empty for no-price completed jobs.

`not_billable` branch is unaffected — it returns early with "No payment due" only.

No new routes. No nav items. No schema migrations. No RLS changes. No env var changes.

---

### Phase 5M — Customer/Property Navigation Polish ✅

**Commits:** `b8444dd` (Polish customer property navigation) · `67b9e80` (Rename estimate actions card)

UI/nav-only phase. No new routes, no server action changes, no schema changes, no RLS changes, no env var changes.

#### Navigation links added

| From | Link added | Target |
|------|-----------|--------|
| Customer detail header | `+ New Estimate` button | `/estimates/new?customer_id={id}` |
| Customer detail property card | `View Property` label | `/properties/{id}` (renamed from "Edit Property") |
| Property detail header | `+ New Estimate` button | `/estimates/new?customer_id={cid}&property_id={pid}` |
| Property info card | `View Customer` linked row | `/customers/{customer_id}` |
| Job detail info card | `View Estimate →` row (conditional) | `/estimates/{estimate_id}` — shown only when `job.estimate_id` exists |
| Estimate summary card | Clickable Customer row | `/customers/{customer_id}` |
| Estimate summary card | Clickable Property row | `/properties/{property_id}` |
| Estimate action buttons | `View Customer` / `View Property` | Renamed from bare "Customer" / "Property" |

#### Label standard

| Context | Label |
|---------|-------|
| Button navigating to customer detail | `View Customer` |
| Button navigating to property detail | `View Property` |
| Link navigating to estimate detail | `View Estimate →` |
| Estimate action section inner card | `Manage Estimate` (was "Actions" — redundant under "Action Center") |

#### Files changed (`b8444dd`)

- `src/app/(protected)/customers/[id]/page.tsx` — `+ New Estimate` header button; "Edit Property" → "View Property" (all property card loops)
- `src/app/(protected)/properties/[id]/page.tsx` — `+ New Estimate` header button (`flexWrap: 'wrap'` for mobile); `View Customer` linked row in info card
- `src/app/(protected)/jobs/[id]/page.tsx` — conditional `View Estimate →` row when `job.estimate_id` is set
- `src/app/(protected)/estimates/[id]/page.tsx` — clickable Customer/Property rows in summary card; `View Customer`/`View Property` action buttons

#### File changed (`67b9e80`)

- `src/app/(protected)/estimates/[id]/page.tsx` — inner card heading renamed from "Actions" to "Manage Estimate"

---

### Phase 5N — Estimate Detail State Polish ✅

**Commit:** `e2d42a1` (Polish estimate detail states)

UI/conditional-rendering-only phase. No server actions changed. No SMS behavior changed. No schema changes. No RLS changes. No route changes.

#### Per-status banner behavior

| Status | Top banner | Schedule Visit card | Send to Customer card |
|--------|-----------|--------------------|-----------------------|
| `draft` rev 1 | 📝 "Draft — not sent yet" · Send via text or mark approved if verbally confirmed | ✅ shown | ✅ shown |
| `draft` rev > 1 | ⚠️ existing revised-draft warning (unchanged) | ✅ shown | ✅ shown |
| `sent` | 📤 "Sent — waiting on customer" · Mark approved once confirmed | ✅ shown | ✅ shown |
| `approved` | ✅ existing "Customer approved — ready to schedule" banner (unchanged) | ✅ shown | ✅ shown |
| `converted` | 📋 "Converted to job" · inline `View Job →` link when `convertedJobId` exists | ❌ hidden | ❌ hidden |
| `declined` | ❌ "Declined" (danger left border) · Edit to revise and resend if needed | ❌ hidden | ❌ hidden |

#### Implementation (`e2d42a1`)

**File:** `src/app/(protected)/estimates/[id]/page.tsx`

- Six banner blocks added between the page header and Estimate Summary card, each gated by a single `estimate.status` (and `revision_number === 1` for the draft case).
- Schedule Visit card wrapped in `{estimate.status !== 'converted' && estimate.status !== 'declined' && (...)}`.
- Send to Customer card gate updated from `estimate.status !== 'converted'` to `estimate.status !== 'converted' && estimate.status !== 'declined'`.
- `convertedJobId` (fetched at page level when `status === 'converted'`) passed inline into the converted banner — no new query.
- `EstimateStatusActions.tsx`, `ScheduleVisitForm.tsx`, `SendSmsButton.tsx`, `EstimateDangerZone.tsx`, and all server actions untouched.

No new routes. No nav items. No schema migrations. No RLS changes. No env var changes.

---

### Phase 5O — Financial Summary No-Price Display Fixes ✅

**Commit:** `0e91bf9` (Fix no-price outstanding balance displays)

Lightweight display-only fixes targeting two surfaces where null-price jobs produced misleading financial output. No migration, no schema changes, no RLS changes, no SMS body changes, no payment action changes. Price remains optional.

#### Customer detail Outstanding Balance (`customers/[id]/page.tsx`)

**Problem:** `outstandingJobs` filter requires `balance > 0` (computed as `Math.max(0, price ?? 0 - amount_paid ?? 0)`). A null-price unpaid job silently produces balance = 0 and is excluded — the operator sees no Outstanding Balance section at all.

**Fix:** Added `noPriceUnpaidJobs` — a separate UI-only array of completed jobs where `payment_status` is `'unpaid'` or `'partial'` and `price == null`. This array is never used in `totalUnpaid`, never included in `outstandingJobs`, and never fed into portal token creation or SMS body construction.

**Display behavior:**

| State | Outer section shown | Dollar total header | Job balance cards | No-price note | SMS button |
|-------|--------------------|--------------------|------------------|--------------|-----------|
| `outstandingJobs` only | ✅ | ✅ ($X across N jobs) | ✅ | — | ✅ (when phone set) |
| `noPriceUnpaidJobs` only | ✅ | ❌ (suppressed) | — | ✅ (muted note) | ❌ |
| Both | ✅ | ✅ | ✅ | ✅ | ✅ (when phone set) |
| Neither | ❌ | — | — | — | — |

**No-price note text:** `+ N unpaid job(s) with no price set — set a price to include in the balance.`

**Invariants preserved:**
- `outstandingJobs` filter unchanged — calculable balances only
- `totalUnpaid` calculation unchanged
- Portal token fetch still gated on `outstandingJobs.length > 0 && customerRow.phone`
- SMS balance reminder button still gated on `outstandingJobs.length > 0 && customerRow.phone`
- `not_billable` jobs remain fully excluded — no intersection with either list

**Property pages intentionally not changed.** No property-level balance section was added in this phase.

#### Today Completed Today null-aware balance (`today/page.tsx`)

**Problem:** `const balance = Math.max(0, (job.price ?? 0) - (job.amount_paid ?? 0))` — null price was coerced to 0, producing `balance = 0`. The owed display condition `balance > 0` correctly hid the label, but the calculation was semantically wrong: null price means unknown, not zero.

**Fix:**

```ts
const balance = job.price != null
  ? Math.max(0, Number(job.price) - Number(job.amount_paid ?? 0))
  : null
```

Display condition updated from `balance > 0 && ...` to `balance != null && balance > 0 && ...`. No-price completed jobs no longer produce `$0 owed` if the condition were ever relaxed.

#### No schema/migration/SMS/payment-action changes

No routes added. No nav items added. No schema migrations. No RLS changes. No env var changes. No SMS body changes. No payment action changes.

---

### Phase 5Q — Job Service Scope (job_inputs) ✅

**Goal:** Replace the legacy `service_package` string with structured job service scope (`job_inputs`) that stores individual service flags and add-on levels. Improve the estimate → job conversion workflow end to end.

**Latest commit:** `f8f4adc` (Default estimate conversion to preferred day)

#### Phase 5Q.1 — job_inputs foundation

**Commits:** `14c3d83` (migration), `2fa58a4` (JobForm)

- Migration `20260531120000_add_jobs_job_inputs.sql` adds `job_inputs` as nullable JSONB on `jobs`. Applied directly to `lewzqavgvltzwfeypvam` via `npx supabase db query --linked` due to known remote migration history drift. Migration file committed; not in remote migration tracking history.
- `JobForm.tsx` updated: package dropdown replaced with four service checkboxes (Mowing, Weed Eating, Edging, Blow Off) + add-on selects (bagging, stick/limb pickup, leaf cleanup, haul-off, shrub counts by size).
- New jobs write `job_inputs` on creation; legacy `service_package` still derived for backward compatibility.

#### Phase 5Q.2 — Service scope display

**Commits:** `5a8b489` (frequency label), `958e876` (job detail scope), `6ec4305` (Today fix)

- Job detail shows `🌿 Services` from `job_inputs` when present; conditional `✨ Add-ons` row for non-`'none'` levels; falls back to `pkgLabel` (legacy `service_package`) for old jobs.
- Job detail shows Frequency (from property `service_frequency`) when available — internal `job_type` no longer shown as a visible service label.
- Today page `deriveServiceLabel()` now checks property boolean columns first before falling back to `service_package`.

#### Phase 5Q.2b — Historical backfill + follow-up copy

**Commits:** `7c1768c` (follow-up copy); SQL applied directly

- Estimate-linked job_inputs backfill applied directly to `lewzqavgvltzwfeypvam` for 5 historical jobs. Before: 1 of 14 jobs had `job_inputs`. After: 6 of 14. One legacy `full_service` mismatch corrected (c3fe16fd: mowing + blow off only, matching `estimate_inputs`).
- `scheduleFollowUpJob` in `jobs/actions.ts` now copies `job_inputs` from parent job when non-null.

#### Phase 5Q.3a — New job prefill source note

**Commit:** `9563c76`

- `JobForm.tsx` displays a contextual note: manual entry / property defaults / manual/no-defaults / estimate prefill states — so operator can see where the current scope came from.

#### Phase 5Q.3b — Exact estimate prefill

**Commit:** `53c51b2`

- `/jobs/new?estimate_id=[id]` validates the estimate server-side (must be approved, same business, non-null customer/property).
- Valid approved estimate prefills all fields: customer, property, price, job_type/frequency, core services, add-ons, shrub counts via `EstimatePrefill` interface.
- Invalid `estimate_id` shows a warning and does not silently fall through to property defaults.

#### Phase 5Q.4a — Active customer gate for estimate conversion

**Commit:** `0f81d6d`

- `markLeadCustomerActive` hardened with `.eq('status', 'lead')` guard — never overwrites active/inactive/archived customers.
- `estimates/[id]/page.tsx` fetches customer `status` and passes to `EstimateStatusActions`.
- `EstimateStatusActions.tsx`: when `estimate.status === 'approved'` and `customer.status === 'lead'`, amber gate card shows "Customer is still a lead" + "Mark as Active Customer" button; Convert to Job hidden.
- `markLeadCustomerActive` accepts optional `estimate_id` from formData to revalidate the estimate page immediately after activation.

#### Phase 5Q.4b — Direct conversion writes job_inputs

**Commit:** `e3f241f`

- `estimates/actions.ts`: added `deriveJobInputsFromEstimateInputs(raw: unknown)` helper — returns `null` for null/non-object input; maps keys with safe defaults for missing fields; never throws.
- `convertToJob()` now writes `job_inputs: jobInputs` alongside `service_package`. Converted job detail immediately shows structured Services/Add-ons.

#### Phase 5Q.4c — Preferred-day default on conversion

**Commit:** `f8f4adc`

- `estimates/[id]/page.tsx`: `preferred_service_day` added to properties select; `defaultScheduledDate` computed via `getClosestWeekdayNearDate(localToday, preferredServiceDay, { minDate: localToday, maxDays: 7 })`.
- `EstimateStatusActions.tsx`: convert panel date input uses `defaultValue={defaultScheduledDate ?? today}`. Operator can override.
- `maxDays: 7` ensures the next occurrence within the week is always found. `minDate: localToday` excludes past occurrences.

#### Current live DB state (Phase 5Q)

- `jobs.job_inputs` column: exists, type `jsonb`, nullable, no default, no constraints.
- 6 of 14 live jobs have `job_inputs`. 8 are legacy (`null`). Legacy jobs display `service_package` fallback.
- All new jobs and converted estimates (post-5Q) write `job_inputs`.

#### Known pending / completed in follow-on phases

- Runtime test: follow-up job `job_inputs` copy — code committed; no qualifying completed job (non-null `job_inputs`, `job_type=recurring`) has been followed up in production yet.
- `/jobs/new?estimate_id=` auto-marking estimate converted — ✅ completed in Phase 5R (`ee0f6e3`).
- Approved estimate selector for generic `/jobs/new` entry — ✅ completed in Phase 5S (`ca4a01e`).

No RLS changes. No env var changes beyond the migration.

---

### Phase 5R — Reviewed Estimate-Created Jobs ✅

**Goal:** When an operator creates a job via `/jobs/new?estimate_id=` (the "Review & Create Job" path), treat it as a full estimate conversion — equivalent in outcome to the direct "Convert to Job" panel.

**Commits:** `ee0f6e3` (core linkage) · `06575b2` (Review & Create Job button on estimate detail) · `13be6a0` (group actions in EstimateStatusActions) · `5a80b37` (remove redundant helper text)

#### Core linkage (`ee0f6e3`)

**`src/app/(protected)/jobs/actions.ts` — `createJob()`:**

1. Reads `estimate_id` from `FormData` (submitted via hidden field in `JobForm`).
2. Validates: looks up estimate by `id + business_id`; verifies `status === 'approved'`; verifies `customer_id` matches selected customer; verifies `property_id` matches selected property. Returns a hard error on any mismatch — no silent fallback.
3. Job insert includes `estimate_id: validatedEstimateId` when present.
4. Post-insert side effects (mirrors `convertToJob()`):
   - `estimates` → `status = 'converted'`
   - `customers` → `status = 'active'` where `status = 'lead'` (scoped by business — never touches non-lead customers)
   - `app_notifications` → `is_reviewed = true`, `reviewed_at = now()` where `estimate_id` matches, `is_reviewed = false`, `notification_type = 'estimate_approved'`
   - `revalidatePath('/estimates/[id]')`, `/estimates`, `/leads`

**`src/components/forms/JobForm.tsx`:**

- Hidden `<input type="hidden" name="estimate_id" value={activeEstimate!.estimateId} />` is rendered **only** when `isEstimateActive === true`.
- `isEstimateActive = source === 'estimate' && activeEstimate != null && activeEstimate.propertyId === selectedPropertyId` (Phase 5S generalization; in Phase 5R it was `estimatePrefill && selectedPropertyId === estimatePrefill.propertyId`).

#### Review & Create Job button (`06575b2` → `13be6a0` → `5a80b37`)

- Button added to `EstimateStatusActions.tsx` between Convert to Job and Mark Declined — so both job-creation choices are grouped visually.
- Only shown when `estimate.status === 'approved' && !isLeadGated` — same gate as Convert to Job.
- Link target: `/jobs/new?estimate_id=${estimate.id}`.
- Redundant banner subtext removed from approved banner in `estimates/[id]/page.tsx`; "Opens the full job form prefilled from this estimate." helper paragraph removed from `EstimateStatusActions.tsx`.

#### Conversion outcome equivalence

| Outcome | `convertToJob()` (direct) | `createJob()` from `/jobs/new` |
|---------|---------------------------|-------------------------------|
| `job_inputs` written | ✅ | ✅ (from form checkboxes) |
| `estimate.status = 'converted'` | ✅ | ✅ |
| Lead → active promotion | ✅ | ✅ |
| Approval notification cleared | ✅ | ✅ |
| Operator date/time override | ✅ | ✅ (full form) |
| Operator can review/edit scope | ❌ (locked to estimate total) | ✅ (full JobForm) |

No schema migrations. No RLS changes. No env var changes.

---

### Phase 5S — New Job Source Selector ✅

**Goal:** When creating a new job at `/jobs/new`, give the operator an explicit source selector to choose whether scope and price come from an approved estimate, from property defaults, or are manually entered.

**Commits:** `ca4a01e` (source selector)

#### Data loading (`jobs/new/page.tsx`)

- `buildEstimatePrefill(est)` helper extracted — shared by the bulk approved-estimates fetch and the explicit `?estimate_id=` validation path (no duplication).
- Third parallel fetch added to `Promise.all`: all `status = 'approved'` estimates for the business with `customer_id` and `property_id` set.
- `allApprovedEstimates: EstimatePrefill[]` passed to `JobForm` as `approvedEstimates`.

#### Source selector (`JobForm.tsx`)

**New type:**
```ts
type JobSource = 'estimate' | 'property' | 'custom'
```

**Initialization logic:**
- If `estimatePrefill` present (URL `?estimate_id=`) → `source = 'estimate'`
- Else if initial property exists and has defaults → `source = 'property'`
- Else → `source = 'custom'`

**`propertyEstimates`:** `allEstimates.filter(e => e.propertyId === selectedPropertyId)` — filtered client-side on property selection change.

**Selector visibility:** shown only when `selectedPropertyId && propertyEstimates.length > 0`. When no approved estimates exist for the property, the selector is hidden and form behaves as property defaults / custom.

**Source switching behavior:**

| Source selected | Fields applied | `estimate_id` field |
|----------------|----------------|---------------------|
| Estimate | `applyEstimateFields(ep)` — price, job_type, all 11 scope fields | ✅ hidden field emitted |
| Property defaults | `applyPropertyFields(p)` — price, job_type, service booleans; add-ons reset to `none`/`0` | ❌ removed from DOM |
| Custom / Manual | Fields left as-is; only `selectedEstimateId` cleared | ❌ removed from DOM |

**Estimate picker:** `<select>` shown below the Estimate radio when `source === 'estimate' && propertyEstimates.length > 0`. Label format: `"Estimate #N · $X · Frequency"`.

**On property change:** `selectedEstimateId` cleared; if source was `'estimate'`, source switches to `'property'` (or `'custom'` if no defaults); property fields applied.

**`isEstimateActive`:** `source === 'estimate' && activeEstimate != null && activeEstimate.propertyId === selectedPropertyId` — gates the hidden `estimate_id` input. False when property changes or source switches away from Estimate.

#### Invariants

- Property defaults and Custom sources never submit `estimate_id` — hidden field is absent from DOM.
- `createJob()` server-side validation is a hard stop regardless; the UI constraint is defense-in-depth.
- Switching to Custom leaves current form values as-is — does not reset fields the operator may have already edited.

No schema migrations. No RLS changes. No env var changes.

---

### Phase 5T — Portal and Invoice Service Scope Display ✅

**Goal:** Show actual job service scope on customer-facing portal and invoice surfaces instead of legacy `service_package`/title fallbacks or current property defaults.

**Commits:** `b0d4f46` (portal + invoice scope display)

#### New file: `src/lib/jobScope.ts`

Pure TypeScript shared helper — no React imports. Exports:

| Export | Purpose |
|--------|---------|
| `parseJobInputs(raw)` | Null-safe JSONB parser; `'svcMowing' in raw` as Phase 5Q+ marker; returns `ParsedJobInputs \| null` |
| `formatCoreServicesForCustomer(inputs)` | Comma-separated customer-friendly core service label |
| `formatAddonsForCustomer(inputs)` | Comma-separated customer-friendly add-on label; no internal level detail; shrub count as total |
| `resolveServiceLabel(jobInputs, pkg, title)` | Priority chain for a single service label string |
| `buildDefaultCompletionNotes(jobInputs, servicePackage)` | Operator-facing completion note autofill (Phase 5U) |

#### Portal home (`portal/[token]/page.tsx`)

- Added `job_inputs` to jobs SELECT
- Removed parallel properties fetch and `propertyMap` (property booleans no longer used to describe job work)
- Replaced local `serviceLabel()` / `SERVICE_LABELS` / `PropertyBooleans` with `resolveServiceLabel()` from `jobScope.ts`
- Upcoming and Service History cards: `addonsLine` (from `formatAddonsForCustomer`) shown as muted subline when non-null
- Legacy jobs (`job_inputs = null`) fall back to `service_package` → `SERVICE_LABELS` → capitalised code → `'Lawn Service'`

#### Portal invoice (`portal/[token]/invoice/[jobId]/page.tsx`)

- Added `job_inputs` to job SELECT
- Replaced local `serviceLabel()` / `SERVICE_LABELS` with `resolveServiceLabel()` from `jobScope.ts`
- Add-ons row inserted below Service row — shown only when `addonsLabel` is non-null
- `completion_notes` display, payment totals, status, Venmo, and token security unchanged

#### Deferred from Phase 5T

- SMS invoice/receipt scope text — `buildInvoiceSms()` note still generic; not updated
- PDF invoice description — `DownloadInvoiceButton.tsx` uses `job.title`; not updated

No schema migrations. No RLS changes. No env var changes.

---

### Phase 5U — Completion Note Autofill from Job Scope ✅

**Goal:** Remove legacy quick-fill chips from the Complete Job form and replace with a textarea pre-filled from actual job scope — so the operator sees an accurate draft and can edit it before submitting.

**Commits:** `4e2c815` (autofill + chip removal)

#### Changes in `src/lib/jobScope.ts`

`buildDefaultCompletionNotes(jobInputs, servicePackage)` added:

**Priority 1 — `job_inputs` (Phase 5Q+):** Builds a comma-separated past-tense list from structured scope:

| Field | Phrase |
|-------|--------|
| `svcMowing` | Mowed |
| `svcWeedEating` | weed ate |
| `svcEdging` | edged |
| `svcBlowOff` | blew off |
| `baggingLevel !== 'none'` | bagged clippings |
| `stickPickupLevel !== 'none'` | picked up sticks/limbs |
| `leafCleanupLevel !== 'none'` | cleaned up leaves |
| `haulOffLevel !== 'none'` | hauled off debris |
| `shrubTotal > 0` | trimmed shrubs |

Result: `capFirst(parts.join(', '))` — e.g., `"Mowed, weed ate, blew off, bagged clippings"`.

If `parts.length === 0` (all boxes unchecked), falls through to Priority 2.

**Priority 2 — `service_package` fallback:**

| Code | Phrase |
|------|--------|
| `mow_only` | Mowed |
| `mow_trim_blow` | Mowed, weed ate, blew off |
| `full_service` | Mowed, weed ate, edged, blew off |
| `trim_cleanup` | Weed ate, edged, blew off |

**Priority 3 — Ultimate fallback:** `"Lawn service completed"`

#### Changes in `src/components/JobActions.tsx`

- Removed `useRef` from React imports
- Added `buildDefaultCompletionNotes` import from `@/lib/jobScope`
- Removed `const notesRef = useRef<HTMLTextAreaElement>(null)`
- Removed `const NOTE_TEMPLATES = [...]` (5 legacy chip strings)
- Removed chips `<div>` block (`NOTE_TEMPLATES.map(...)` pill buttons)
- Completion notes `<textarea>`: removed `ref={notesRef}`; added `defaultValue={buildDefaultCompletionNotes(job.job_inputs, job.service_package)}`
- `completeJob` server action unchanged — reads `completion_notes` from FormData as before
- Portal receipt still displays final saved `completion_notes`

Notes remain fully editable — `defaultValue` is a starting suggestion, not a locked value.

No schema migrations. No RLS changes. No env var changes.

---

### Phase 5V — Today Weather Reliability ✅

**Goal:** Make Today's job card weather accurate and reliable for rural Alabama properties that have never been geocoded.

**Commits:** `030fec4` · `85a9651` · `7c08ebc` · `43a198f`

#### Problem chain

1. Properties commonly have `latitude = null` / `longitude = null` (never geocoded via `ApplyParcelButton`)
2. With no stored coords, Today never attempted a weather fetch → weather silently absent
3. When coords exist but Open-Meteo fails, the `{fc && (...)}` guard silently suppressed the row
4. The daily `weather_code` (dominant all-day condition, e.g., overnight fog) was displayed as the current condition

#### `030fec4` — Unavailable fallback

Changed `{fc && (...)}` to a ternary guarded by `property?.latitude != null && property.longitude != null`:
- Coordinates present + forecast available → weather row
- Coordinates present + forecast missing → `"Weather unavailable for this property."` (muted)
- No coordinates → nothing shown

#### `85a9651` — Address geocode fallback (`today/page.tsx`)

When stored coords are null, Today now geocodes transiently via `geocodeAddress()`:
- Added `state, postal_code` to the `properties(...)` sub-select
- Phase 1: collect stored lat/lon into `jobCoordMap` keyed by `job.id`
- Phase 2: `Promise.all` geocodes jobs with no stored coords from `service_address + city + state + postal_code`
- Results stored in `jobCoordMap` — **never written to Supabase**
- Card looks up `effectiveCoord = jobCoordMap.get(job.id)` and checks `effectiveCoord != null` as display guard

#### `7c08ebc` — City/ZIP centroid fallback (`geocode.ts`)

Extended `geocodeAddress()` with a third fallback after street-level and freeform both fail:
```
Structured (street + city + state + zip)  → []  (road not in OSM)
Freeform full-address                     → []  (same gap)
City/ZIP centroid: "Hartford, AL, 36344"  → (31.1020, -85.6978) ✅
```
Nominatim knows town boundaries even when individual rural roads are missing. Good enough for weather.

#### `43a198f` — Current conditions (`weather.ts`)

Added `current=temperature_2m,weather_code` to the Open-Meteo request URL.

**`DayForecast` interface additions:**

| Field | Source | Fallback |
|-------|--------|---------|
| `currentTemp` | `data.current.temperature_2m` (rounded) | daily `temperature_2m_max` |
| `currentSummary` | `data.current.weather_code` → `WMO_CODES` | daily `summary` |
| `currentEmoji` | `data.current.weather_code` → `WMO_CODES` | daily `emoji` |

**Display change (today/page.tsx):**

| Before | After |
|--------|-------|
| `{fc.emoji} 91° / 70° · Fog` | `{fc.currentEmoji} 86° now · Clear · High 91°` |

`currentTemp` / `currentSummary` / `currentEmoji` are only sourced from `data.current` for index 0 (today). Future days fall back to daily values. Rain chance and daily high remain from `daily.*` fields (correct for planning).

#### Cache and API notes

- Weather: `{ next: { revalidate: 1800 } }` — 30-min cache; successful responses only; failures are not cached
- Geocoding: `{ next: { revalidate: 60 * 60 * 24 * 30 } }` — 30-day cache; address-to-coord mapping is stable
- Both APIs: free, no API key, no env vars required

No schema migrations. No DB writes. No RLS changes. No env var changes.

---

### Phase 5W — Follow-up Scheduling Product Direction

**Status:** ✅ Clarified (product direction — no new code commits)

The `/jobs/new?source_job_id` reviewable follow-up creation path (deferred since Phase 5Q) was formally evaluated and is not being built.

**Final behavior:**
- Follow-up scheduling continues exclusively through `ScheduleFollowUpCard` on the completed job detail page. Property defaults (service booleans, frequency, price) are the starting point for follow-up jobs.
- Operators who want to change scope, frequency, or price for the next visit create a new estimate. The estimate → job conversion flow is the canonical path for agreement changes.
- `Property.schedule_anchor_date` and `property.auto_schedule_next` remain in the schema for future auto-scheduling — not yet implemented.

No new code. No migrations. No schema changes.

---

### Phase 5X — Estimate Source-Job Model

**Goal:** Link estimates back to the completed jobs that prompted them. Allow an approved estimate to replace a property's default service agreement. Propagate follow-up linkage through both conversion paths.

**Latest commit:** `0cd8a60` (Phase 5X.5 complete)

#### Phase 5X.3 — Estimate source-job awareness
**Commit:** `49524a9`

- Migration `20260604_add_estimates_source_job.sql`: adds `source_job_id` (uuid FK → jobs ON DELETE SET NULL) and `satisfies_follow_up` (boolean NOT NULL DEFAULT false) to `estimates`.
- Applied via `npx supabase db query --linked --file`.
- `EstimateForm.tsx`: locked property ternary (existing property lock); `satisfies_follow_up` checkbox shown only when `source_job_id` is set.
- `createEstimate()`: validates `source_job_id` (must be a completed job scoped by business); persists both columns.
- `src/types/database.ts`: `Estimate` interface updated with both new fields.

#### Phase 5X.4 — Estimate can replace property default service agreement

**Commits:** `909a4e3` (schema/type), `b5dcafa` (form/persistence), `d14a096` (approval-time property updates + public quote notice)

**Phase 5X.4a — Schema and type (`909a4e3`):**
- Migration `20260606130000_add_estimates_sets_property_defaults.sql`: adds `sets_property_defaults boolean NOT NULL DEFAULT false`.
- `src/types/database.ts`: `Estimate` interface updated.

**Phase 5X.4b — Form and persistence (`b5dcafa`):**
- `EstimateForm.tsx`: `sets_property_defaults` checkbox always visible; `defaultSetsPropertyDefaults` prop; wording: "When approved, apply this estimate's frequency, scope, and price as the property's new default service agreement."
- `createEstimate()` and `updateEstimate()`: read and persist `sets_property_defaults`.
- `estimates/[id]/edit/page.tsx`: passes `defaultSetsPropertyDefaults` prop.

**Phase 5X.4c/d — Approval-time property updates + public quote notice (`d14a096`):**

New shared utility `src/lib/propertyDefaultsFromEstimate.ts`:
- `AnySupabaseClient = { from: (table: string) => any }` — works with both regular and admin Supabase clients.
- `applyPropertyDefaultsFromEstimate(supabase, businessId, estimate)`: guards on `sets_property_defaults` and `property_id`; writes `service_frequency`, `default_price`, four service booleans, and `default_service_package` (derived from booleans); skips boolean block when `estimate_inputs` is null; best-effort (logs, does not throw).
- `ALLOWED_FREQUENCIES = new Set(['weekly', 'biweekly', 'one_time', 'custom', 'paused'])` — rejects out-of-range values.

**Three approval paths wired:**
1. `manuallyApproveEstimate()` (`estimates/actions.ts`) — calls helper after successful status update.
2. `updateEstimateStatus()` (`estimates/actions.ts`) — calls helper when `status === 'approved'`.
3. `acceptEstimate()` (`quote/[token]/actions.ts`) — calls helper after marking approved.

**Public quote notice (`quote/[token]/page.tsx`):**
- When `estimate.sets_property_defaults = true`, a blue-tinted notice card appears above the confirm form: "📋 This estimate updates your service agreement." — explains that accepting replaces the ongoing service plan.

#### Phase 5X.5 — Conversion follow-up linkage and conversion UI polish

**Commit:** `0cd8a60`

**Task A — `convertToJob()` linkage (`estimates/actions.ts`):**
- When `satisfies_follow_up = true` and `source_job_id` is set: writes `recurrence_source: source_job_id` on the new job insert; after job creation, updates `next_job_created_id` on the source job (guarded by `.is('next_job_created_id', null)`).

**Task B — `createJob()` linkage (`jobs/actions.ts`):**
- Same follow-up linkage when job is created via `/jobs/new?estimate_id=`. Both conversion paths are now equivalent for `satisfies_follow_up` handling.

**Task C — Cadence date from source job (`estimates/[id]/page.tsx`):**
- If `estimate.source_job_id` is set, fetches the completed source job (`status = 'completed'`, scoped by `business_id`).
- Anchor: `completed_at` converted to local date via `getLocalDateStr(timeZone, new Date(completed_at))`; falls back to `scheduled_date`.
- Cadence: weekly → anchor + 7d, biweekly → anchor + 14d; `null` for other frequencies.
- `defaultScheduledDate`: cadence date snapped to `preferred_service_day` ±4d when set; falls back to preferred-day-near-today ±7d; final fallback to `localToday`.

**Task D — `save_as_default_price` conditional (`EstimateStatusActions.tsx`):**
- When `estimate.sets_property_defaults = true`, the "Save as default price" checkbox is replaced with an informational note: "This estimate already updated the property's default service agreement when it was approved."

**Task E — `satisfies_follow_up` wording polish (`EstimateForm.tsx`):**
- Updated checkbox label: "Use the job created from this estimate as the follow-up for the completed job."
- Hint: "When the estimate is converted to a job, it will close the original job's follow-up slot."

No RLS changes. No env var changes. No public-facing schema exposure.

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

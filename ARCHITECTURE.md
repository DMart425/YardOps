# YardOps Architecture

## 1. App Purpose

**YardOps** is the private operations command center for Wicksburg Lawn Service. It is **not** customer-facing and is not the same as the public website (wicksburglawnservice.com). 

YardOps enables the business owner/operator to:
- Track leads from the website and manually-added sources
- Manage customers, properties, and recurring service schedules
- Create and send estimates (with public quote tokens for customer approval)
- Schedule and complete jobs, with optional photo logging
- Track partial and full payments
- Generate invoices and customer portals (read-only, paid-accessible)
- Send SMS reminders (day-before job reminders, payment reminders)
- Monitor daily/weekly workflow and cash flow
- Export financial data for accounting
- Manage equipment and maintenance schedules
- Track weather forecasts to warn about rain on scheduled jobs

**Key principle:** YardOps is the centralized control system. The public website is a lead funnel only. All operations happen in YardOps.

---

## 2. Tech Stack

| Component | Tech |
|-----------|------|
| **Framework** | Next.js 16+ (App Router) |
| **Runtime** | Node.js on Vercel |
| **Language** | TypeScript (strict mode) |
| **UI Framework** | React 19 |
| **Styling** | Custom global CSS (no Tailwind) |
| **Database** | PostgreSQL via Supabase |
| **Auth** | Supabase Auth (email + password) |
| **ORM** | None — direct Supabase JS SDK queries |
| **Server Logic** | Next.js Server Actions, Route Handlers |
| **Forms** | HTML forms + `useActionState` |
| **Notifications** | Web Push API (PWA) |
| **Exports** | jsPDF (PDF invoices), CSV export |
| **Geocoding** | External API calls (stored in `parcels` table) |
| **Weather** | Open-Meteo API (free, no auth) |
| **Deployment** | Vercel (GitHub integration, auto-deploy main branch) |

---

## 3. Folder Structure

```
src/
├── app/                              # Next.js App Router
│   ├── (protected)/                  # Route group: requires auth
│   │   ├── customers/                # Customer list & detail
│   │   ├── properties/               # Property list & detail
│   │   ├── jobs/                     # Job scheduler (Scheduled/Completed views)
│   │   ├── estimates/                # Estimate builder & converter
│   │   ├── leads/                    # Lead management & conversion
│   │   ├── today/                    # Daily dashboard
│   │   ├── finances/                 # Income/expense tracking & export
│   │   ├── equipment/                # Equipment list & maintenance schedule
│   │   ├── settings/                 # Pricing defaults, time zone, notifications
│   │   └── layout.tsx                # Protected layout with sidebar/nav
│   ├── api/
│   │   ├── cron/                     # Scheduled tasks (morning/evening summaries)
│   │   ├── push/                     # Web push subscription endpoints
│   │   └── parcels/                  # Parcel data search (external API)
│   ├── login/                        # Public: login page
│   ├── quote/[token]/                # Public: customer-facing estimate quote
│   ├── portal/[token]/               # Public: read-only customer account portal
│   ├── page.tsx                      # Root redirects to /today
│   ├── layout.tsx                    # Root layout (metadata, PWA, theme)
│   └── globals.css                   # Global styles (dark theme, components)
├── components/
│   ├── forms/                        # Reusable form components
│   │   ├── JobForm.tsx
│   │   ├── EstimateForm.tsx
│   │   ├── PropertyForm.tsx
│   │   ├── SettingsForm.tsx
│   │   └── ...
│   ├── JobActions.tsx                # Job status/payment actions (complete, mark paid, etc.)
│   ├── EstimateStatusActions.tsx     # Estimate approval/send logic
│   ├── DesktopSidebar.tsx            # Left sidebar navigation
│   ├── MobileNav.tsx                 # Bottom mobile nav
│   ├── Toast.tsx                     # Notification toast component
│   ├── DownloadInvoiceButton.tsx     # PDF invoice generation
│   ├── CsvExportButton.tsx           # Finance export
│   ├── BackfillCoordinatesButton.tsx # Geocode missing property coords
│   └── ...
├── lib/
│   ├── supabase/
│   │   ├── server.ts                 # SSR client (user-scoped, anon key)
│   │   ├── admin.ts                  # Service role client (bypasses RLS)
│   │   └── client.ts                 # Browser client (if needed for future)
│   ├── actions/
│   │   └── auth.ts                   # Login/logout/signup server actions
│   ├── pricing.ts                    # Estimate calculation engine
│   ├── weather.ts                    # Open-Meteo forecast fetching
│   ├── geocode.ts                    # Address geocoding helper
│   └── push.ts                       # Web push notification helper
├── types/
│   └── database.ts                   # TypeScript interfaces for all DB entities
└── middleware.ts                     # Session refresh, route protection (root level)
```

### Key Details:

- **`(protected)/`** — Route group wrapped by middleware that checks auth. Unauthenticated users redirected to `/login`.
- **`/login`** — Public page, not in route group.
- **`/quote/[token]`** — Public page for customers to review & approve estimates.
- **`/portal/[token]`** — Public, read-only view of jobs/payments for a specific customer.
- **`api/cron/*`** — Vercel cron triggers (require `CRON_SECRET` env var for security).
- **`globals.css`** — All styling; no Tailwind. Dark theme CSS custom properties (color- palette). Mobile-first responsive design.
- **No `lib/db.ts`** — All DB queries go directly through Supabase JS SDK in actions/pages.

---

## 4. Authentication & Routing

### Middleware Flow (`middleware.ts`)

1. Every request passes through middleware.ts.
2. Middleware creates a server-side Supabase client with the anon key and cookies.
3. Calls `supabase.auth.getUser()` to refresh the session and check if user is authenticated.
4. If no user and route is NOT `/login`, `/quote/`, or `/portal/`:
   - Redirect to `/login`
5. If user exists and route IS `/login`:
   - Redirect to `/today`
6. Otherwise, proceed to the route.

### Session Management

- Supabase stores session tokens in **secure HTTP-only cookies**.
- Middleware **refreshes the session on every request** by calling `getUser()`.
- **Auth client** (`/lib/supabase/server.ts`) uses the **anon key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- Row-Level Security (RLS) enforces that users can only see their own data (filtered by `created_by` or `user_id`).

### Public Routes

- **`/login`** — Login form (calls `login` server action in `lib/actions/auth.ts`).
- **`/quote/[token]`** — No auth required. Uses `createAdminClient()` to look up estimate by public token. Customer can view & accept.
- **`/portal/[token]`** — No auth required. Uses `createAdminClient()` to show customer account summary (jobs, balance, payment link).

### Protected Routes

- Everything under `(protected)/` requires authentication.
- Failing auth redirects to `/login`.

### Logout

- Log out via `/lib/actions/auth.ts`, clears Supabase session, redirects to `/login`.

---

## 5. Data Model

### Entities

#### **profiles** (1 per user)
- `id` (auth user ID)
- `business_name`, `owner_name`, `business_phone`, `business_email`
- `service_radius_miles`, `default_hourly_rate`, `minimum_visit_charge`
- `created_at`, `updated_at`

#### **pricing_settings** (1 per user)
- `id`, `user_id` (FK → auth.users)
- `target_hourly_rate`, `minimum_price`, `round_to_nearest`, `default_setup_minutes`
- `venmo_handle`, `blackout_dates` (array of "YYYY-MM-DD" strings)
- `time_zone` (e.g., "America/Chicago" — used by Jobs/Today for date calculations)
- `settings_json`, `created_at`, `updated_at`

#### **customers**
- `id`, `created_by` (FK → auth.users)
- `first_name`, `last_name`, `phone`, `email`
- `status` ('lead' | 'active' | 'inactive' | 'archived')
- `notes`, `preferred_contact_method`, `tags` (array)
- `created_at`, `updated_at`

#### **properties**
- `id`, `created_by`, `customer_id` (FK → customers)
- `service_address`, `city`, `state`, `postal_code`, `county`
- `latitude`, `longitude` (used for weather forecasts)
- `parcel_id` (FK → parcels)
- `parcel_acres`, `estimated_mowable_acres`, `estimated_lot_sqft`
- `default_service_package`, `default_price`, `service_frequency`
- `auto_schedule_next` (boolean — auto-create next job after completion)
- `gate_code`, `access_notes`, `pet_warning`, `obstacle_notes`, `parking_notes`
- `status` ('active' | 'inactive' | 'archived')
- `created_at`, `updated_at`

#### **jobs**
- `id`, `created_by`, `customer_id`, `property_id`, `estimate_id` (nullable)
- `status` ('scheduled' | 'in_progress' | 'completed' | 'skipped' | 'cancelled' | 'needs_reschedule')
- `payment_status` ('unpaid' | 'paid' | 'partial')
- `price`, `amount_paid`, `payment_method`
- `scheduled_date` (YYYY-MM-DD), `scheduled_time_window` (e.g., "08:00-10:00")
- `completed_at` (ISO timestamp), `started_at`
- `actual_minutes` (duration if tracked)
- `service_package`, `title`, `job_type` ('recurring' | 'one_time')
- `recurrence_source` (ID of job that spawned this one)
- `next_job_created_id` (ID of auto-scheduled next job)
- `completion_notes`, `internal_notes`, `customer_notes`
- `skipped_reason`, `cancelled_reason`, `rescheduled_from`
- `day_before_reminder_sent`, `day_before_reminder_sent_at`
- `created_at`, `updated_at`

#### **estimates**
- `id`, `created_by`, `customer_id`, `property_id`
- `status` ('draft' | 'sent' | 'approved' | 'converted' | 'declined' | 'expired')
- `total`, `subtotal`, `estimated_minutes`, `frequency`
- `estimate_inputs` (JSON — pricing engine inputs)
- `valid_until` (date)
- `public_token` (for public quote link)
- `notes`, `created_at`

#### **estimate_items**
- `id`, `estimate_id`, `label`, `price`

#### **message_logs**
- `id`, `user_id`, `customer_id`, `job_id`, `estimate_id`
- `message_type` (SMS type: reminder, confirmation, etc.)
- `delivery_method` ('sms', 'email', etc.)
- `recipient_phone`, `message_body`
- `sent_at`, `manually_marked_sent`

#### **parcels** (from external API, cached)
- `id`, `source`, `source_parcel_id`, `apn`
- `owner_name`, `situs_address`, `mailing_address`
- `land_use`, `lot_sqft`, `lat`, `lon`
- `raw_json` (full response from parcel API)

#### **expenses**
- `id`, `user_id`, `job_id` (nullable)
- `category` ('fuel' | 'equipment' | 'supplies' | 'repairs' | 'insurance' | 'labor' | 'other')
- `vendor`, `description`, `amount`, `purchased_at`
- `notes`, `receipt_url`

#### **equipment**
- `id`, `created_by`, `name`, `category`, `purchase_date`, `purchase_price`
- `status` ('active' | 'inactive' | 'retired')
- `last_maintenance_date`, `maintenance_interval_days`
- `notes`

#### **customer_portal_tokens** (for customer account portal)
- `token`, `customer_id`, `created_by`, `created_at`, `expires_at`

#### **push_subscriptions** (for PWA notifications)
- `id`, `user_id`, `subscription` (JSON web push subscription)
- `created_at`

### Relationships

```
auth.users
  ├→ profiles (1:1)
  ├→ pricing_settings (1:1)
  ├→ customers (1:many, via created_by)
  │  ├→ properties (1:many)
  │  │  ├→ jobs (1:many)
  │  │  │  ├→ estimates (1:many)
  │  │  │  ├→ expenses (1:many)
  │  │  │  └→ message_logs (1:many)
  │  │  └→ parcels (1:1, via parcel_id)
  ├→ equipment (1:many)
  ├→ expenses (1:many)
  ├→ message_logs (1:many)
  └→ push_subscriptions (1:many)
```

### Lead → Customer → Property → Job Flow

1. **Website lead arrives** → `customers` row with `status = 'lead'`, one or more `properties`.
2. **Convert lead** → Change customer `status` from 'lead' to 'active'; property stays.
3. **Create estimate** → Estimate references customer + property.
4. **Approve estimate** → `estimate.status = 'approved'` or `'converted'`.
5. **Convert to job** → Creates `jobs` row, sets `estimate.status = 'converted'`, promotes customer to 'active'.
6. **Complete job** → `job.status = 'completed'`, captures `completed_at` and `amount_paid`.
7. **Auto-schedule next** → If property `auto_schedule_next = true` and job is recurring, create next job automatically.

---

## 6. Core Business Workflow

### Daily Operating Flow

1. **Morning:** Open YardOps → **Today** page shows:
   - Rain warning (if Open-Meteo predicts ≥40% precip at any job location)
   - Today's jobs with customer, address, weather, payment status
   - Unpaid jobs (partial + unpaid)
   - Overdue jobs
   - Completed Today section
   - New leads count, recurring gaps, dormant customers
   - Estimate visits (if any)

2. **During day:**
   - Tap job → "Mark In Progress" → sets `started_at`
   - Take photos (stored in `job_photos`, referenced with `signed_url`)
   - On completion → "Complete Job" panel with optional manual price override
   - Optionally mark Partial Payment (amount + method)
   - Auto-schedule next job if recurring

3. **End of day:**
   - Evening cron job sends summary (jobs completed, unpaid count, earnings)
   - Review Finances page (YTD income/expenses by month/customer)

4. **Lead management:**
   - Check **Leads** page (website leads + manual adds)
   - Review lead → Parcel lookup shows lot size, owner, land use
   - Create estimate → Use pricing engine (hours + services)
   - Send estimate (SMS link to public quote page)
   - Wait for approval → Converts to 'converted' status
   - Auto-promote customer from 'lead' to 'active'

### Offline Capability

- App is PWA-installable (metadata in root `layout.tsx`)
- Does NOT sync offline data — all reads/writes require network
- (Service worker not yet implemented; flagged as enhancement)

---

## 7. Supabase Rules

### Environment Variables

| Var | Purpose | Required |
|-----|---------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✓ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (in browser) | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server only) | ✓ |
| `NEXT_PUBLIC_QUOTE_BASE_URL` | Base URL for public quote links | Optional (defaults to app.wicksburglawnservice.com) |
| `CRON_SECRET` | Secret for Vercel cron endpoint protection | ✓ |

### Client Types & RLS

| Operation | Client | Auth | RLS | Notes |
|-----------|--------|------|-----|-------|
| Read own data (jobs, customers) | `createClient()` (anon key) | ✓ User session | ✓ Enforced | Middleware refreshes session |
| Create/update/delete own data | `createClient()` (anon key) | ✓ User session | ✓ Enforced | Server actions via `useActionState` |
| Public quote lookup | `createAdminClient()` | ✗ None | ✗ Bypassed | Looks up by public_token only |
| Public portal lookup | `createAdminClient()` | ✗ None | ✗ Bypassed | Looks up by token, returns only allowed fields |
| Cron jobs (morning/evening) | `createAdminClient()` | ✗ None | ✗ Bypassed | Protected by `CRON_SECRET` header check |

### RLS Strategy

- All tables have RLS enabled (policy: users can only access rows where `created_by = auth.user_id` or `user_id = auth.user_id`).
- Public routes use `createAdminClient()` to bypass RLS, but only select public-safe fields and validate token/ID.
- No direct client-side database access; all mutations go through server actions.

### Tables & Schemas

See Supabase project `lewzqavgvltzwfeypvam` for live schema. Notable tables:
- `auth.users` — Supabase auth table (not queried directly; use `getUser()`)
- All custom tables in `public` schema (no custom schemas yet)
- View/migration history in Supabase dashboard

### Schema Drift Risks

- **RISK:** `src/types/database.ts` is manually maintained. If schema changes in Supabase, TypeScript types are NOT auto-updated.
  - **Mitigation:** After each migration, manually verify types or use `supabase gen types typescript > src/types/schema.ts` (not currently automated).
- **RISK:** Column renames or drops will silently break queries (no compile-time safety).
  - **Mitigation:** Run tests against live DB before deploying; check error logs on Vercel.

---

## 8. Important Conventions

### Mobile-First Design

- All pages designed for **mobile first** (320px+), then scaled up.
- **Sidebar hidden on mobile**, bottom nav instead.
- **Forms stack vertically**, inputs full-width.
- **Dark theme only** (CSS custom properties, no light mode).
- CSS is custom; no framework. See `src/app/globals.css` for color variables and component classes.

### Field Usage

- Fields accessed from phone (thumb-friendly, no tiny inputs).
- Time inputs: text fields with "HH:MM" format, not HTML `<input type="time">` (unreliable on mobile).
- Date inputs: use `<input type="date">` (OS date picker is mobile-friendly).
- Dropdowns: `<select>` preferred over custom dropdowns.
- Large tap targets (min 44px).

### Separation of Concerns

- **Public website** (wicksburglawnservice.com) = lead funnel only
  - Captures lead name, phone, address, frequency request
  - Leads stored in Supabase `leads` table
- **YardOps** (this app) = operations + admin
  - Converts leads to customers
  - Schedules, completes, payments
  - No public website logic here

### Design Principles

- **Simplicity over features:** Prefer durable, easy-to-understand workflows.
- **No bloat:** Only ship features that solve real problems.
- **Timezone-aware:** All date comparisons use user's configured timezone (from `pricing_settings.time_zone`).
- **Offline-friendly UI (future):** All data mutations trigger `revalidatePath()` to ensure fresh renders.

---

## 9. Open Risks & TODOs

### Known Issues

1. **No offline sync** — App requires network for all reads/writes. PWA is installable but not functional offline.
2. **Manual type maintenance** — `src/types/database.ts` is not auto-generated; risk of schema drift.
3. **Time zone not in core DB time calculations** — Cron jobs and some filters compute "today" manually; risk of UTC drift in edge cases (partially fixed, but not exhaustive).
4. **No service worker** — PWA is "installable" but caching/offline not implemented.
5. **Equipment maintenance not fully wired** — Equipment table exists but maintenance logic incomplete.
6. **Partial payment UI complex** — Manually entering amounts on completed jobs; could use better UX.

### TODOs / Future Work

- [ ] Auto-generate TypeScript types from Supabase schema (e.g., via `supabase gen types`).
- [ ] Implement service worker for offline read caching.
- [ ] Add more detailed equipment maintenance reminders.
- [ ] Add recurring job schedule preview (calendar view of next 90 days).
- [ ] Improve SMS delivery logging and retry logic.
- [ ] Add expense categorization templates.
- [ ] Add customer communication history (all SMS/email in one view).
- [ ] Add job photo gallery (currently photos are attached but not galleryized).

### Unfinished Features

- **Brief Settings** table exists but is unused.
- **Email notifications** partially implemented (message_logs exist but delivery is SMS-only).
- **Equipment maintenance schedule** shows upcoming maintenance but reminders not sent.

### Potentially Abandoned / Unclear

- `src/lib/supabase/client.ts` exists but is never imported (browser-side client not used; all DB access is server-side). Likely legacy. **Needs verification:** Should this be removed?
- Some API routes in `/api` may be stubs or unused. Check `/api/push` and `/api/parcels` for actual usage.

---

## 10. Developer Onboarding

### Prerequisites

- Node.js 18+ (test with `node --version`)
- npm or pnpm
- Git
- A Supabase account (access to project `lewzqavgvltzwfeypvam` or your own dev project)
- Vercel account for deployment (optional for local dev)

### Local Setup

1. **Clone repo:**
   ```bash
   git clone https://github.com/DMart425/YardOps.git
   cd yardops
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create `.env.local`:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://lewzqavgvltzwfeypvam.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<get from Supabase dashboard>
   SUPABASE_SERVICE_ROLE_KEY=<get from Supabase dashboard>
   CRON_SECRET=<generate a random string, e.g., `openssl rand -hex 32`>
   NEXT_PUBLIC_QUOTE_BASE_URL=http://localhost:3000
   ```

   **Note:** `.env.example` does not exist; values must be obtained from Supabase project settings.

4. **Verify Supabase CLI is linked (optional, for migrations):**
   ```bash
   npx supabase link --project-ref lewzqavgvltzwfeypvam
   ```

5. **Start dev server:**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 → redirects to `/login` (or `/today` if you're logged in).

6. **Create a test user:**
   - Go to http://localhost:3000/login
   - Supabase Auth in dev mode allows any email/password combo
   - (In production, only real email + magic link works)

### Running Tests / Linting

```bash
# Lint (ESLint)
npm run lint

# No automated tests currently configured
# Manual testing recommended (QA on `/today`, `/jobs`, `/estimates`, etc.)
```

### Building for Production

```bash
# Build optimized bundle
npm run build

# Start production server (local testing)
npm run start
```

### Key Workflows for Development

#### Adding a New Page / Feature

1. Create file in `src/app/(protected)/myfeature/page.tsx` (or `/jobs/myfeature/page.tsx` for nested).
2. If it needs a form, create server action in `src/app/(protected)/myfeature/actions.ts`.
3. Add route to sidebar/nav if needed (`src/components/DesktopSidebar.tsx`).
4. Test on mobile first (use browser DevTools device emulation).

#### Modifying the Data Model

1. **Create a migration:**
   ```bash
   cd "C:\Users\DMart\Documents\GitHub\Parcel Data"
   $env:SUPABASE_DB_PASSWORD="<db password>"
   echo Y | npx supabase db push  # Or use Supabase dashboard directly
   ```

2. **Update `src/types/database.ts`** with new/modified types.

3. **Update queries** in affected pages/actions.

4. **Test locally** before committing.

#### Deploying to Production

- Push to `main` branch → GitHub Actions triggers Vercel build
- Vercel auto-deploys (no manual `npx vercel --prod` needed)
- Check Vercel dashboard for build status / logs
- Production URL: https://app.wicksburglawnservice.com

#### Debugging Auth Issues

- Check browser DevTools → Application → Cookies → look for `sb-*` cookies (Supabase session).
- Check Vercel logs (`vercel logs`) for middleware errors.
- Test `/api/auth/callback` behavior in Supabase Auth settings.

#### Common Pitfalls

- **Using `new Date()` for time comparison:** Use timezone-aware methods (see `getLocalDate()` in `jobs/page.tsx`).
- **Accessing `est.customers` directly:** May be array or object; always normalize with `Array.isArray()`.
- **Forgetting to call `revalidatePath()`:** Cached data won't update after mutations.
- **Querying `pricing_settings` with wrong FK:** Use `user_id`, not `created_by`.
- **Payment calculation errors:** Always use `Math.max(0, price - amount_paid)` and filter `payment_status !== 'paid'`.

---

## 11. Environment Variables Reference

| Variable | Example | Notes |
|----------|---------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://lewzqavgvltzwfeypvam.supabase.co` | Visible in browser; safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGc...` | Visible in browser; safe; RLS enforces data access |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGc...` | **Secret:** server-side only; never expose |
| `CRON_SECRET` | `abc123def456` | **Secret:** verified in cron route handlers |
| `NEXT_PUBLIC_QUOTE_BASE_URL` | `https://app.wicksburglawnservice.com` | Public quote/portal base URL |

---

## 12. Deployment & Monitoring

### Vercel Deployment

- **GitHub integration:** Main branch auto-deploys.
- **Environment variables:** Set in Vercel project dashboard (Settings → Environment Variables).
- **Preview deployments:** Pull requests get preview URLs.
- **Cron jobs:** Configured in `vercel.json` (if present; check for `crons` key) — **needs verification** for current setup.
- **Logs:** View via `vercel logs` CLI or Vercel dashboard.

### Monitoring Recommendations

- Monitor **morning/evening cron** success via Vercel logs.
- Set Vercel alerts for failed deployments.
- Periodically audit Supabase RLS policies and API usage.
- Check Vercel build performance (aim for <60s build time).

---

## 13. Glossary

- **Anon Key:** Supabase public key (safe in browser); enforces RLS to prevent unauthorized access.
- **Service Role Key:** Supabase secret key (server-side only); bypasses RLS for admin operations.
- **RLS:** Row-Level Security — PostgreSQL policies that restrict row access based on user ID.
- **Server Action:** Next.js function marked `'use server'` that runs on the server and can be called from forms.
- **Revalidate:** Next.js cache invalidation — clears ISR cache for a route so fresh data is fetched.
- **Cron Job:** Scheduled task (e.g., morning summary at 6 AM) triggered by Vercel.
- **Public Token:** URL-safe string (stored in `customer_portal_tokens`) that allows unauthenticated access to customer portal.

---

## 14. Quick Reference: Important Files

| File | Purpose |
|------|---------|
| `middleware.ts` | Auth guard, session refresh |
| `src/app/layout.tsx` | Root HTML, PWA metadata, dark theme |
| `src/app/globals.css` | All styling, CSS variables |
| `src/lib/supabase/server.ts` | Anon client (protected routes) |
| `src/lib/supabase/admin.ts` | Admin client (cron, public endpoints) |
| `src/types/database.ts` | TypeScript entity interfaces |
| `src/lib/pricing.ts` | Estimate calculation engine |
| `src/components/JobActions.tsx` | Job state/payment logic |
| `src/app/(protected)/today/page.tsx` | Daily dashboard |
| `src/app/(protected)/jobs/page.tsx` | Job scheduler + filters |

---

## 15. Future Improvements (Aspirational)

- [ ] **Real-time sync:** Add Supabase Realtime subscriptions for live job updates.
- [ ] **Offline-first:** Implement service worker + local IndexedDB for offline queueing.
- [ ] **Advanced scheduling:** Calendar month/week view, drag-to-reschedule.
- [ ] **AI-powered estimation:** ML model to predict job duration based on property size + history.
- [ ] **Stripe integration:** Direct payment processing (not just Venmo links).
- [ ] **Recurring job templates:** Save common service packages as reusable templates.
- [ ] **Team expansion:** Multi-user support with role-based access (currently single-user).
- [ ] **Analytics dashboard:** Charts for revenue trends, customer acquisition, churn.

---

## Conclusion

YardOps is a focused, mobile-first operations app for a single lawn service business. It prioritizes reliability and simplicity over feature sprawl. The architecture is deliberately straightforward: Next.js + Supabase + server actions, with no ORM or complex abstractions.

**Key Principles:**
1. All data access is server-side (no direct browser DB queries).
2. Timezone-aware date handling is critical (configured per-user).
3. Mobile-first design is non-negotiable.
4. RLS enforces data isolation; trust the database layer.
5. Keep the public website separate; YardOps is operations only.

For questions, check the README.md or review recent commits. For schema changes, always test locally first and update types afterward.

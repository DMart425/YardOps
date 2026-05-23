# YardOps Handoff — Operational State

> **Living document.** Future coder chats MUST update this file whenever architecture, database state,
> workflows, major feature behavior, migrations, deployment assumptions, or project status changes.
> Any handoff to a new chat must reference this file and include a reminder to keep it updated.

Last updated: 2026-05-23 (b985bb3)

---

## Repos

| Repo | Purpose |
|------|---------|
| `DMart425/YardOps` | Private operations app — this repo |
| `DMart425/WicksburgLawnService` | Public business website + lead intake form |

**Do not casually edit WicksburgLawnService during YardOps work.**

---

## Current Checkpoint

- **Latest commit:** `b985bb3` — Anchor follow-up date to completion
- **Branch:** `main`
- **Supabase project:** `lewzqavgvltzwfeypvam` (Wicksburg Lawn Service)
- **Deployment:** Vercel, auto-deploys on push to `main`
- **Production URL:** https://app.wicksburglawnservice.com

> **Vercel note:** `b985bb3` did not appear to trigger an immediate Vercel auto-deploy after push. The docs checkpoint push may retrigger the deploy. Not confirmed resolved — check Vercel dashboard if production behavior appears stale.

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

### Approved Estimate Operator Workflow ✅

**Problem:** Three gaps in the accepted-estimate flow: (1) no Approved filter tab on `/estimates`; (2) no visible banner on the estimate detail page indicating the customer had approved and it was ready to convert; (3) approval notifications not cleared on convert, leaving stale "approved" badges/cards on Today page. Additionally, `/estimates` defaulted to All instead of Open.

**Fixes applied — three commits:**

**`f305373` — Surface approved estimates for scheduling:**
- `estimates/page.tsx` — `STATUS_FILTERS` extended with `['approved', 'Approved']` tab (between Open and Draft).
- `estimates/[id]/page.tsx` — approved-state banner added when `estimate.status === 'approved'`: green-tinted card with ✅ icon, "Customer approved — ready to schedule", and prompt to use Convert to Job.
- `estimates/actions.ts` `convertToJob()` — best-effort `app_notifications` UPDATE marks all unreviewed approval notifications for the estimate as reviewed immediately on conversion; `revalidatePath('/today')` added.

**`e7407c9` — Hide converted estimate notifications:**
- `estimates/page.tsx` — default filter changed from `'all'` to `'open'`.
- `(protected)/layout.tsx` and `today/page.tsx` — notification queries updated with `estimates!estimate_id(status)` embedded join + JS filter to exclude converted-estimate notifications from badge count and Today card.
- **SQL cleanup (manual, Supabase SQL Editor, `lewzqavgvltzwfeypvam`):**
  - Marked all unreviewed `estimate_approved` notifications whose linked estimate has `status = 'converted'` as reviewed (Cedric Thomas case).
  - Marked all unreviewed `estimate_approved` notifications with `estimate_id = null` as reviewed (Dustin Martin case — estimate was deleted, FK set to null via `ON DELETE SET NULL`).

**`1c19d44` — Ignore orphaned estimate notifications:**
- Added `.not('estimate_id', 'is', null)` to both `(protected)/layout.tsx` and `today/page.tsx` approval notification queries.
- Permanent guard: orphaned notifications (where `estimate_id = null` because the estimate was deleted) never drive the badge or Today card again.
- Root cause: `app_notifications.estimate_id` uses `ON DELETE SET NULL` — deleting an estimate nullifies the FK without removing the notification row.

No migrations. No schema changes. All three commits user-tested in production: badge gone, Today clean, Open default confirmed.

---

### Post-Estimate Workflow Audit + Today Service Label Polish ✅

**Audit findings (read-only, no changes):**
- `today/page.tsx` used `(job.service_package ?? job.job_type)!.replace(/_/g, ' ')` in Today's Jobs and Tomorrow's Jobs card sections — could show `"one time"` / `"recurring"` as a service label, and showed `"mow trim blow"` instead of `"Mow, Trim & Blow"`.
- `buildInvoiceSms()` in `JobActions.tsx` used raw `.replace(/_/g, ' ')` — completion SMS sent to customer showed `"Service: mow trim blow"`.
- `DownloadInvoiceButton.tsx` has a redundant + raw service description in the PDF line item — deferred as a follow-on.
- `scheduleFollowUpJob()` is always manual (no auto-scheduling in `completeJob()`); ARCHITECTURE.md `auto_schedule_next` note was inaccurate — corrected in docs.
- All job actions are correctly scoped by `business_id` — no concerns.

**`cb05cdd` — Polish Today service labels (user-tested):**
- `today/page.tsx` — added `SERVICE_LABELS` map and `servicePackageLabel()` helper (matching `jobs/page.tsx` / `jobs/[id]/page.tsx` pattern); replaced both `(job.service_package ?? job.job_type)!.replace(/_/g, ' ')` usages (Today's Jobs cards, Tomorrow's Jobs cards) — no `job_type` fallback; also fixed the Tomorrow section `pkg` variable used in reminder SMS body.
- `src/components/JobActions.tsx` — added `SMS_SERVICE_LABELS` map in `buildInvoiceSms()`; completion invoice SMS now shows `"Service: Mow, Trim & Blow"` instead of `"Service: mow trim blow"`.
- `DownloadInvoiceButton.tsx` intentionally not touched — PDF description cleanup is a possible follow-on.
- No scheduling, payment, or status behavior changed. No SQL/migrations.

---

### Invoice and Payment Fixes ✅

**`46fc17b` — PDF invoice service description cleanup (user-tested):**
- `DownloadInvoiceButton.tsx` — replaced multi-line `const desc` ternary (produced `"Lawn Service - Mow, Trim & Blow (mow trim blow)"`) with `const desc = data.jobTitle`. Estimate-converted job titles are already fully descriptive. No layout, payment, or banner behavior changed.

**`dd19b02` — Persist paid-at-completion amount + PDF totals alignment (user-tested):**
- `jobs/actions.ts` `completeJob()` — resolves `paymentStatus` and `finalPrice` before the DB update; now writes `amount_paid: paymentStatus === 'paid' ? finalPrice : null`. Previously, completing a job as "Paid now" set `payment_status = 'paid'` but left `amount_paid = null`, causing the PDF invoice to show a contradictory PAID banner while displaying $0 paid and full balance due. `markPaid()` and `markPartial()` unchanged.
- `DownloadInvoiceButton.tsx` — "Total:", "Paid:", and "Balance Due:" label x-positions moved from `pageWidth - margin - 80` to `pageWidth - margin - 120` to prevent "Balance Due:" (12pt bold) from overlapping the value column. PDF PAID banner condition (`paymentStatus === 'paid' || balance <= 0`) unchanged.

**One-time paid job data repair (SQL only, `lewzqavgvltzwfeypvam`):**
- After `dd19b02`, audited all Wicksburg jobs with `payment_status = 'paid' AND COALESCE(amount_paid, 0) = 0`. After targeted cleanup, query returned no rows. No remaining Wicksburg paid jobs have missing `amount_paid`. The `dd19b02` fix is forward-only for new completions.

**`2342041` — Neutral invoice business name fallback:**
- `jobs/[id]/page.tsx` — `businessName` prop changed from `profile?.business_name ?? 'Wicksburg Lawn Service'` to `profile?.business_name ?? 'Lawn Service'`. Removes hardcoded tenant name. SaaS-safe.

**`ec48565` — Invoice business name from business context (user-tested):**
- `jobs/[id]/page.tsx` — added `supabase.from('businesses').select('name').eq('id', businessId).single()` using the already-resolved `businessId` from `requireBusinessContext()`; updated `businessName` prop to `business?.name ?? profile?.business_name ?? 'Lawn Service'`.
- Invoice PDF header now uses `businesses.name` as primary source, falls back to `profiles.business_name`, then to neutral `'Lawn Service'`.
- `businessPhone` and `businessEmail` remain profile-sourced — no business-level contact columns exist yet.
- **Future SaaS direction:** business identity, contact fields, and payment branding should eventually move to a business-scoped settings/profile source. Do not re-hardcode tenant names as fallbacks.
- `DownloadInvoiceButton.tsx` not touched.

---

### Phase 4 — Operations UX / Workflow Polish ✅ Substantially Complete

**4A/4B — Today dashboard and Jobs page polish (user-tested):**
- Today stat cards are actionable links to filtered Jobs views (overdue, completed today, unpaid balance)
- Jobs page: status label polish, overdue count, weekly scheduled total, cancelled/skipped filter, completed pagination clarity
- Customer/property detail pages link to filtered Jobs views; property detail has "+ New Job" shortcut (`77aa780`)
- "Total revenue" relabeled to "Total billed" on customer/property detail pages (`46d9b6b`)

Key commits: `430782d`, `c19c507`, `94fc267`, `6efb8c6`, `2f5fcc2`, `d4a5e44`, `99d14dc`, `829e1bf`, `576dc89`, `f1512e2`, `e039c86`, `13ce8be`, `77aa780`, `dcfa1dd`, `12451f6`, `175aabb`, `c71d60f`

**4C — Follow-up scheduling improvements (user-tested):**
- Explicit property frequency selection required — no silent default
- Blow off service label aligned across app
- `unsure` frequency preserved in lead notes
- Parent job shows Follow-up Visit summary with date and status (`30df416`)
- One-time job flag shown on follow-up scheduling card (`dd7dbb6`)
- `internal_notes` carried forward to follow-up job (`7c8ead6`)
- Warning shown when suggested follow-up date is in the past (`406f727`)

Key commits: `fbe63c0`, `3f5645c`, `b93e836`, `406f727`, `dd7dbb6`, `30df416`, `7c8ead6`

**4D — Finances display polish (user-tested):**
- Uncollected receivables card on Finances page (all-time completed unpaid/partial balance; links to Jobs filter) (`4b02414`)
- Month selector uses responsive CSS grid — mobile-friendly (`0b310f3`)
- Expense list cap disclosed when truncated ("+ X more not shown") (`225b5e0`)

**Phase 3 follow-up verification bugfixes (production-verified):**
- `scheduleFollowUpJob()` now has server-side past-date guard (timezone-aware) + client `min` date (`5a26387`)
- `rescheduleJob()` now has matching server-side past-date guard + client `min` date (`89d4f6b`)
- `JobActions` calls `router.refresh()` on completion success so UI reflects new status without page reload (`5a26387`)

**Payment workflow — production-verified complete (`89d4f6b`, `6e70e61`, `e1a6b7a`):**
- Completing as unpaid writes `amount_paid = 0` — fixes NOT NULL constraint error
- Complete Job panel supports "Partial payment" option — partial amount input shown, auto-promotes to `paid` if amount ≥ price
- `markPartial()` is cumulative — adds to existing `amount_paid`, clamps to price, auto-promotes to `paid` when fully paid
- "Add Another Payment" shown on partial-status completed jobs
- SMS reflects completion payment status: unpaid shows full balance, partial shows Total / Paid / Balance due with scaled Venmo link, paid shows receipt, not_billable suppresses SMS

**Phase 4 cleanup (user-tested):**
- Customer detail header now has `+ New Job` shortcut (matching property detail) (`5acdcbb`)
- Today page overdue/unpaid capped list sections now disclose the cap with a disclosure note (`890cfcf`)
- Internal variable `overdueCount` renamed to `staleUnpaidCount` in `jobs/page.tsx` — no UI change (`c1b22b9`)
- Job detail payment summary row wording clarified for all four payment status cases: unpaid/partial/paid/not_billable (`463e762`)

---

### Phase 5A — Customer Collections / Receivables ⏸ In Progress

**Goal:** Give the operator clear visibility into outstanding customer balances and an easy path to collect payment.

**Completed:**
- Customers list unpaid balance badges — orange dollar amount badge on each customer card with outstanding balance (`53b22c0`)
- Customer detail Outstanding Balance section — unpaid/partial job list with amounts, dates, and links to job detail (`95cb0cc`)
- Customer detail Send Balance Reminder SMS — pre-filled SMS body with total balance, per-job breakdown, Venmo/cash wording, and customer portal link (`0259d1e`, `561bf76`, `7093925`)
  - Portal token generated only when `outstandingJobs.length > 0 && customerRow.phone` — no unnecessary token creation on every page load
  - Portal URL built from `NEXT_PUBLIC_QUOTE_BASE_URL ?? 'https://app.wicksburglawnservice.com'` + `/portal/${token}`
- Customer portal service history payment states clarified: shows "X due" / "X remaining" (with "Y paid" subtext) / "X paid" / "No payment due" depending on `payment_status` and `amount_paid` (`8232e4a`)

**Production-verified:**
- Customer detail `+ New Job` shortcut works
- Customer Outstanding Balance section displayed correctly
- Customers list unpaid badge displayed correctly
- Balance reminder SMS opened correctly with balance details, Venmo handle, and portal link
- Portal link opened to the correct customer portal
- Portal showed outstanding balance banner and Venmo Pay Now button
- Portal service history correctly showed `$82 remaining`, `$3 paid of $85`, and Partial pill

---

### Phase 5B — Estimate Conversion Polish & Business-Scoped Phone ✅

**Commits:** `2fd14eb`, `4f3254b`, `924dead`, `ac212ba`

**Estimate conversion polish:**
- `convertToJob()` — duplicate conversion guard added; returns error if estimate is already `converted`
- Converted estimate detail looks up linked job via `jobs.estimate_id + business_id`; renders **View Job →** button when job found
- Estimate SMS business name now uses `businesses.name` → `profiles.business_name` → `'Lawn Service'` (was profile-only, always hit fallback)

**Business-scoped phone:**
- Migration `20260522000000_add_business_phone.sql` — adds `phone text` (nullable) to `businesses`; applied and verified on `lewzqavgvltzwfeypvam`
- Settings → **Business Phone** field added; saves to `businesses.phone` via `businessId` (business-scoped, not user-scoped)
- Resolution order for all customer-facing surfaces: `businesses.phone → profiles.business_phone → null`
- Surfaces updated: estimate SMS contact line, job invoice PDF, customer portal header + contact section
- `formatPhoneInput()` applied at input (live formatting while typing) and at all display points; stored/displayed as `(xxx) xxx-xxxx`

**Deferred from this phase:**
- Job detail **View Estimate** link when `job.estimate_id` exists
- Convert-to-job date/time pre-fill polish
- Public quote page phone source (separate data path — not updated here)
- `JobActions` SMS messages — `businessPhone` not yet passed; job SMS bodies remain phone-free

**Production-verified:**
- Converted estimate shows View Job link ✅
- Estimate SMS uses correct business name ✅
- Settings → Business Phone field saves successfully ✅
- Business phone formats live as `(334) 320-7514` in Settings ✅
- Settings reload shows formatted value ✅
- Estimate SMS contact line shows formatted business phone ✅
- Customer portal displays formatted business phone ✅
- Job invoice PDF uses business-scoped phone ✅

---

### Phase 5C — Portal Invoices, Receipt SMS, and Payment Receipt Stability ✅

**Commits:** `da7e53e`, `b6ed6b3`, `453d43f`, `a70c6dc`, `0351ab6`, `b70f1b2`, `13de697`, `ba85520`, `7c5280a`

**Portal invoice page (`da7e53e`, `b6ed6b3`, `453d43f`):**
- New public route `/portal/[token]/invoice/[jobId]` — per-job invoice/receipt page, accessible without auth via portal token
- Job double-scoped by `customer_id` (via token lookup) + `business_id` (from token row) — cannot access another customer's or business's job via URL manipulation
- Portal service history rows now link to **View Invoice** for completed jobs
- Completion SMS now includes the portal invoice URL

**Receipt SMS for later payment events (`a70c6dc`, `0351ab6`):**
- `buildPaymentReceiptSms()` — operator-triggered receipt SMS after `markPaid()` / `markPartial()` post-completion
- Distinct from `buildInvoiceSms()` — receipt SMS must NOT say "job complete"
- `not_billable` jobs: no owed amount displayed, no invoice/payment SMS
- `pendingReceipt` state pre-builds SMS body in submit `onClick`; compose sheet opens after action succeeds

**Repeated partial payment stability (`b70f1b2`, `13de697`, `ba85520`, `7c5280a`):**
- Root cause: `setState` in submit button `onClick` caused form to unmount before native `submit` event fired → `markPartial()` never received `FormData`
- React 18 invariant: state updates in `onClick` flush synchronously BEFORE the browser fires `submit` — unmounting the form in `onClick` silently breaks the server action
- Correct fix (`7c5280a`): controlled input, no form-structural state in `onClick`, only side-effect `setPendingReceipt`, input cleared via deferred `useEffect` with `setTimeout`
- No SQL/migrations

**Production-verified:**
- ✅ Portal invoice page loads for completed jobs
- ✅ Portal service history shows View Invoice links
- ✅ Completion SMS includes portal invoice URL
- ✅ Receipt SMS opens after marking paid/partial post-completion
- ✅ `not_billable` jobs show no owed balance and no SMS
- ✅ Multiple partial payment submissions work reliably — `markPartial()` receives `FormData` each time

---

### Phase 5D — Follow-up Completion-Date Anchor ✅

**Commit:** `b985bb3`

- `jobs/[id]/page.tsx` — computes `completedDateLocal = getLocalDateStr(timeZone, new Date(job.completed_at))` server-side when `completed_at` is present; passes as `completedDate` prop to `ScheduleFollowUpCard`
- `ScheduleFollowUpCard.tsx` — added `completedDate?: string | null` prop; anchors `suggestedDate` from `completedDate ?? scheduledDate`
- Prevents follow-up date drift when jobs are completed early or late relative to their scheduled date
- No migration. No behavior change for jobs without `completed_at`.

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
| `20260513200000_phase2g_leads_rls_cosmetic.sql` | Phase 2G leads RLS — remove redundant NOT NULL prefix from SELECT/DELETE USING clauses |
| `20260522000000_add_business_phone.sql` | Add nullable `phone text` column to `businesses` — business-scoped contact number |

---

## Commit History (Recent, Newest First)

| Hash | Description |
|------|-------------|
| `b985bb3` | Anchor follow-up date to completion (Phase 5D) |
| `7c5280a` | Fix partial payment FormData submission (Phase 5C) |
| `ba85520` | Stabilize repeated partial payments (Phase 5C — superseded by 7c5280a) |
| `13de697` | Fix repeated partial payment entry (Phase 5C — superseded by 7c5280a) |
| `b70f1b2` | Fix partial payment receipt submission (Phase 5C — superseded by 7c5280a) |
| `0351ab6` | Fix payment receipt SMS and not billable owed display (Phase 5C) |
| `a70c6dc` | Add later payment receipt SMS (Phase 5C) |
| `453d43f` | Add portal invoice links to completion SMS (Phase 5C) |
| `b6ed6b3` | Link portal service history to invoices (Phase 5C) |
| `da7e53e` | Add portal invoice receipt page (Phase 5C) |
| `ac212ba` | Format business phone displays (Phase 5B) |
| `924dead` | Add business-scoped phone setting (Phase 5B) |
| `4f3254b` | Use business name in estimate SMS (Phase 5B) |
| `2fd14eb` | Polish estimate conversion workflow (Phase 5B) |
| `8232e4a` | Clarify portal service history payments (Phase 5A) |
| `7093925` | Add portal link to balance reminder SMS (Phase 5A) |
| `561bf76` | Polish balance reminder SMS wording (Phase 5A) |
| `0259d1e` | Add customer balance reminder SMS (Phase 5A) |
| `53b22c0` | Show unpaid balances on Customers list (Phase 5A) |
| `95cb0cc` | Show customer outstanding job balances (Phase 5A) |
| `463e762` | Clarify Job detail payment summary (Phase 4 cleanup) |
| `c1b22b9` | Rename stale unpaid count variable (Phase 4 cleanup) |
| `890cfcf` | Disclose capped Today job lists (Phase 4 cleanup) |
| `5acdcbb` | Add Customer detail New Job shortcut (Phase 4 cleanup) |
| `e1a6b7a` | Support partial payment at completion (Phase 4) |
| `6e70e61` | Support cumulative partial payments (Phase 4) |
| `89d4f6b` | Fix unpaid completion and block past reschedules (Phase 4) |
| `5a26387` | Block past follow-ups and refresh completed jobs (Phase 4) |
| `225b5e0` | Disclose capped Finances expense list (Phase 4D) |
| `0b310f3` | Improve Finances month selector layout (Phase 4D) |
| `4b02414` | Show uncollected receivables on Finances (Phase 4D) |
| `46d9b6b` | Clarify billed totals on detail pages (Phase 4B) |
| `c71d60f` | Route Today stats to Jobs views (Phase 4B) |
| `175aabb` | Link detail pages to filtered Jobs views (Phase 4B) |
| `12451f6` | Support filtered Jobs views by customer and property (Phase 4B) |
| `dcfa1dd` | Link unpaid detail stats to Jobs (Phase 4B) |
| `77aa780` | Add property New Job shortcut (Phase 4B) |
| `13ce8be` | Polish customer and property detail labels (Phase 4B) |
| `e039c86` | Clarify completed jobs pagination (Phase 4A) |
| `f1512e2` | Show cancelled and skipped jobs filter (Phase 4A) |
| `576dc89` | Show weekly scheduled total on Jobs (Phase 4A) |
| `829e1bf` | Show overdue count on Jobs filter (Phase 4A) |
| `99d14dc` | Polish Jobs status labels (Phase 4A) |
| `d4a5e44` | Polish Today status labels (Phase 4A) |
| `2f5fcc2` | Show capped Today counts clearly (Phase 4A) |
| `6efb8c6` | Polish Tomorrow jobs on Today (Phase 4A) |
| `94fc267` | Clarify unpaid job action label (Phase 4A) |
| `c19c507` | Make Today stat cards actionable (Phase 4A) |
| `430782d` | Show property service labels on Today (Phase 4A) |
| `fbe63c0` | Require explicit property frequency selection (Phase 4C) |
| `3f5645c` | Align remaining blow off service labels (Phase 4C) |
| `b93e836` | Preserve unsure frequency in lead notes (Phase 4C) |
| `30df416` | Show follow-up summary on parent job (Phase 4C) |
| `dd7dbb6` | Note one-time jobs on follow-up card (Phase 4C) |
| `406f727` | Warn on past follow-up suggestion (Phase 4C) |
| `7c8ead6` | Carry internal notes to follow-up jobs (Phase 4C) |
| `ec48565` | Use business name for invoice header (Phase 3) |
| `2342041` | Use neutral invoice business fallback (Phase 3) |
| `dd19b02` | Persist paid completion amount (Phase 3) |
| `46fc17b` | Clean PDF invoice service description (Phase 3) |
| `74500ed` | Document Today service label polish (Phase 3 docs) |
| `1a10969` | Document approved estimate workflow cleanup (Phase 3 docs) |
| `cb05cdd` | Polish Today service labels (Phase 3) |
| `1c19d44` | Ignore orphaned estimate notifications (Phase 3) |
| `e7407c9` | Hide converted estimate notifications (Phase 3) |
| `f305373` | Surface approved estimates for scheduling (Phase 3) |
| `61c5ff6` | Document job detail label polish (Phase 3 docs) |
| `e3a510e` | Polish job detail labels (Phase 3) |
| `1db4f33` | Clarify estimate property default hints (Phase 3) |
| `df491c0` | Clean frequency normalization cases (Phase 3) |
| `8b88357` | Document county prefill completion (Phase 3 docs) |
| `8966add` | Prefill county from matched parcel source (Phase 3 Patch 3) |
| `71e9d70` | Document parcel carryover and lookup fixes (Phase 3 docs) |
| `01b1d11` | Skip zero parcel acreage values (Phase 3 — Parcel Lookup fix 2) |
| `fddb06a` | Fix parcel lookup lot size fallback (Phase 3 — Parcel Lookup fix 1) |
| `4c18726` | Carry parcel id into new property flow (Phase 3 Patch 2) |
| `a1007ab` | Document acreage prefill patch (Phase 3 docs) |
| `0e724ea` | Prefill property acreage from matched parcel (Phase 3 Patch 1) |
| `5467b7b` | Document leads RLS cleanup completion (Phase 2G docs) |
| `dd80d6e` | Document lead UI polish and remaining RLS cleanup (Phase 2G docs) |
| `4001837` | Merge lead request and service setup display (Phase 3) |
| `820b053` | Align manual lead detail layout (Phase 3) |
| `1941585` | Rename lead frequency label — "Requested Service" → "Service Frequency" (Phase 3) |
| `5f9ba2d` | Fix quote page summary label — "Service Frequency — Weekly" (Phase 3) |
| `f496246` | Clean website lead notes display — strip structured intake block (Phase 3) |
| `591ca1b` | Show website lead service interests as pills (Phase 3) |
| `3cc8a77` | Format lead property frequency (Phase 3) |
| `0589026` | Format website lead frequency (Phase 3) |
| `268d814` | Document Phase 2G closeout |
| `e85cbcc` | Clean up leads RLS policies (Phase 2G) |
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
- ✅ Website lead detail page frequency now displays friendly labels via `formatFrequencyLabel()` (`0589026`)
- ✅ Lead detail property card frequency now displays friendly labels via `formatFrequencyLabel()` (`3cc8a77`)
- ✅ Website lead detail page shows parsed service interests as itemized pills before conversion (`591ca1b`)
- ✅ Website lead Customer Notes no longer shows the structured `"Website service interests:"` intake block — stripped cleanly while preserving free-form notes (`f496246`)
- ✅ Quote page summary card label changed from `"{FREQ} Lawn Service"` to `"Service Frequency — {FREQ}"` (`5f9ba2d`)
- ✅ Website lead detail `"Requested Service"` label renamed to `"Service Frequency"` — consistent with quote page wording (`1941585`)
- ✅ Manual lead detail page aligned with website lead detail visual style: `detail-section` wrappers, headings outside cards, `"Contact Info"` with icon rows and Call/Text/Email quick-action buttons, structured intake text stripped from visible notes (`820b053`)
- ✅ Manual lead detail request/property display merged: no-property case shows `"Requested Service Setup"` prominently; matching property suppresses duplicate section; differing property or multi-property shows compact `"Original website request: ..."` note (`4001837`)
- ✅ Add Property link from manual lead detail now prefills `parcel_acres` and `estimated_mowable_acres` when parcel data exists — values were already computed for the parcel card; `addPropertyHref` construction moved to after parcel calculation block so both values are in scope; `properties/new` already accepted both params (`0e724ea`)
- ✅ Add Property link now also carries `parcel_id` and `lot_size_source=parcel` when a matched parcel exists — `properties/new` updated to accept both params and pass to `PropertyForm` defaultValues; `PropertyForm`/`createProperty()` were already wired; after property save, `ApplyParcelButton` shows `✓ Parcel data already applied` on first render (`4c18726`)
- ✅ Parcel Lookup dropdown now falls back to `lot_sqft` when raw_json acreage field is `0` — fixed nullish coalescing that never bypassed zero (`fddb06a`)
- ✅ Parcel Lookup now skips zero raw acreage values so later fields like `DeededAcres` can be used — `pickFirstPositiveNumber()` added; 500 BILLINGS TRL (`CALC_ACRES=0`, `DeededAcres=0.42`) now shows acreage; 500 REDBUD CIR (all-zero source record) correctly remains "No usable lot size data" (`01b1d11`)
- ✅ Add Property link from manual lead detail now prefills `county` when a matched parcel exists — extraction tries `raw_json.attributes` county fields first; falls back to `parcel_sources.county` via `parcel.source`; no hardcoded county; `properties/new` was already wired for the `county` URL param; production test confirmed Houston County prefills correctly (`8966add`)
- ✅ `normalizeFrequency()` duplicate/unreachable cases removed — two-block structure collapsed into one; all accepted inputs preserved (`weekly`, `biweekly`, `bi-weekly`, `bi weekly`, `one_time`, `one time`, `one-time`, `one-time cut`, `one time cut`, `custom`, `paused`); unsure variants still return null; no behavior change (`df491c0`)
- ✅ EstimateForm property default hints clarified — frequency hint now uses `formatFrequencyLabel()` (shows `Bi-weekly` not `biweekly`); frequency hint suppressed for unmapped frequencies (`custom`/`paused`); service defaults hint unified — shows enabled services from property booleans for modern properties, falls back to legacy package label only when actually using package path; no pricing or submission behavior changed; user-tested (`1db4f33`)
- ✅ `leads` RLS SELECT/DELETE cosmetic cleanup applied and verified — `leads_select_business_member` and `leads_delete_business_member` USING clauses now use `is_business_member(business_id)` only; INSERT/UPDATE policies unchanged; applied via SQL Editor on `lewzqavgvltzwfeypvam` (CLI unavailable due to role permission error)
- ✅ Job detail page service package and job type labels polished — `SERVICE_LABELS` map added locally (matching `jobs/page.tsx`); `pkgLabel` now uses map with title-case fallback instead of raw replace; `job_type` now shows friendly labels (`One-time`, `Recurring`) via `JOB_TYPE_LABELS` instead of raw enum value; no pricing or data behavior changed; user-tested (`e3a510e`)
- ✅ `/estimates` page now has an Approved filter tab (between Open and Draft) — operator can quickly find estimates awaiting conversion (`f305373`)
- ✅ Approved estimate detail page shows a green-tinted banner ("Customer approved — ready to schedule") prompting operator to convert to job (`f305373`)
- ✅ `convertToJob()` auto-clears unreviewed approval notifications on conversion — Today page no longer shows stale "approved" card after a job is created (`f305373`)
- ✅ `/estimates` defaults to Open filter instead of All — list opens on actionable estimates (`e7407c9`)
- ✅ Estimates badge in nav no longer counts notifications whose linked estimate was converted — embedded join + JS filter excludes converted-estimate notifications (`e7407c9`)
- ✅ Today page approval notification cards no longer appear for converted estimates (`e7407c9`)
- ✅ Stale approval notifications cleaned up in Supabase SQL Editor (`lewzqavgvltzwfeypvam`): converted-estimate notifications marked reviewed; orphaned null-estimate notifications (Dustin Martin — estimate deleted) marked reviewed (`e7407c9` — SQL)
- ✅ Orphaned estimate notification guard added — `.not('estimate_id', 'is', null)` in both `layout.tsx` and `today/page.tsx` notification queries; deleted-estimate orphaned notifications (estimate_id = null via ON DELETE SET NULL) never drive badge or Today card; user-tested (`1c19d44`)
- ✅ Today page job cards now show friendly service labels (`"Mow, Trim & Blow"` not `"mow trim blow"`); no `job_type` fallback (`"one time"` / `"recurring"` never shown as service label); user-tested (`cb05cdd`)
- ✅ Tomorrow's Jobs cards use same friendly labels; Tomorrow reminder SMS body also uses friendly label (`cb05cdd`)
- ✅ Completion invoice SMS (`buildInvoiceSms`) now shows `"Service: Mow, Trim & Blow"` instead of `"Service: mow trim blow"` (`cb05cdd`)
- ✅ PDF invoice service description uses `job.title` directly — no more redundant `"(mow trim blow)"` parenthetical (`46fc17b`)
- ✅ Completing a job as "Paid now" now persists `amount_paid = finalPrice` in the DB — invoice no longer shows contradictory PAID banner with $0 paid and full balance due (`dd19b02`)
- ✅ PDF invoice "Balance Due:" label no longer overlaps the value column — label column width increased from 80pt to 120pt (`dd19b02`)
- ✅ All Wicksburg paid jobs confirmed to have correct `amount_paid` — post-`dd19b02` data repair verified, query for `payment_status = 'paid' AND COALESCE(amount_paid, 0) = 0` returns zero rows
- ✅ Invoice PDF business name now uses `businesses.name` first, falls back to `profiles.business_name`, then neutral `"Lawn Service"` — no hardcoded tenant names (`ec48565`)
- ✅ Follow-up scheduling works for recurring/bi-weekly jobs and for one-time jobs (`5a26387`, `dd7dbb6`)
- ✅ Internal/property/operator notes carry forward to follow-up jobs (`7c8ead6`)
- ✅ Parent job shows Follow-up Visit summary with date and status (`30df416`)
- ✅ Follow-up dates in the past are blocked — client-side `min` date + server-side timezone-aware guard (`5a26387`)
- ✅ Regular job reschedule dates in the past are blocked — matching client + server guard (`89d4f6b`)
- ✅ `JobActions` calls `router.refresh()` after job completion so UI reflects new status without page reload (`5a26387`)
- ✅ Completing a job as unpaid correctly writes `amount_paid = 0` — no more NOT NULL constraint error (`89d4f6b`)
- ✅ Multiple partial payments accumulate correctly — each payment adds to existing `amount_paid`, clamps to price, auto-promotes to `paid` when fully paid (`6e70e61`)
- ✅ "Add Another Payment" button shown on partial-status completed jobs (`6e70e61`)
- ✅ Complete Job panel supports "Partial payment" option at completion time — partial amount input shown, auto-promotes to `paid` if amount ≥ price (`e1a6b7a`)
- ✅ Completion SMS reflects payment status: unpaid shows full balance due, partial shows Total / Paid / Balance due with Venmo link scaled to remaining balance, paid shows receipt, not_billable suppresses SMS entirely (`e1a6b7a`)
- ✅ Customer detail header has `+ New Job` shortcut (matching property detail shortcut added in `77aa780`) (`5acdcbb`)
- ✅ Job detail payment summary row wording correct for all four cases: unpaid completed job shows balance due; partial shows remaining and paid; paid shows paid confirmation; not_billable shows no charge (`463e762`)
- ✅ Customers list shows orange unpaid balance badge for customers with outstanding completed jobs (`53b22c0`)
- ✅ Customer detail shows Outstanding Balance section with per-job unpaid/partial list and links to job detail (`95cb0cc`)
- ✅ Customer detail Send Balance Reminder SMS button generates correct pre-filled SMS body: balance total, per-job breakdown, Venmo handle (if set), and customer portal link (`0259d1e`, `561bf76`, `7093925`)
- ✅ Customer portal link in SMS opens to correct customer portal (`7093925`)
- ✅ Customer portal shows outstanding balance banner and Venmo Pay Now button when balance > 0 (pre-existing — verified)
- ✅ Customer portal service history correctly shows due/remaining/paid/partial/not-billable payment states with colored amounts and contextual labels; partial state shows subtext with amount paid and total (`8232e4a`)
- ✅ Converted estimate detail shows **View Job →** button linking to the created job (`2fd14eb`)
- ✅ `convertToJob()` duplicate conversion guard — returns error if estimate is already `converted`; double-trigger safe (`2fd14eb`)
- ✅ Estimate SMS uses `businesses.name` as business name source; no longer falls back to `'Lawn Service'` when `businesses.name` is populated (`4f3254b`)
- ✅ Settings → Business Phone field saves `businesses.phone` using `businessId` (business-scoped, not profile-scoped) (`924dead`)
- ✅ Business phone formats live as `(334) 320-7514` while typing in Settings (`ac212ba`)
- ✅ Settings page reload shows formatted phone value (`ac212ba`)
- ✅ Estimate SMS contact line shows `Questions? Call or text (334) 320-7514` when business phone is set (`ac212ba`)
- ✅ Customer portal header and contact section display formatted business phone (`ac212ba`)
- ✅ Job invoice PDF uses business-scoped phone (`businesses.phone → profiles.business_phone → null`) formatted as `(xxx) xxx-xxxx` (`ac212ba`)
- ✅ Portal invoice page `/portal/[token]/invoice/[jobId]` loads without auth, scoped by both `customer_id` and `business_id` — URL manipulation with a different job ID fails the lookup (`da7e53e`)
- ✅ Portal service history rows show **View Invoice** link for completed jobs (`b6ed6b3`)
- ✅ Completion SMS (`buildInvoiceSms`) includes the portal invoice URL as a clickable link (`453d43f`)
- ✅ Operator can trigger a receipt SMS after marking a job paid or partial post-completion — SMS body pre-built from `buildPaymentReceiptSms()`, compose sheet opens after action succeeds (`a70c6dc`)
- ✅ Receipt SMS does not say "job complete" — distinct wording from completion invoice SMS (`0351ab6`)
- ✅ `not_billable` jobs show no owed balance and no invoice/payment SMS prompts (`0351ab6`)
- ✅ Multiple partial payment submissions work reliably — `markPartial()` receives `FormData` each submission; form input clears after success (`7c5280a`)
- ✅ `ScheduleFollowUpCard` anchors suggested follow-up date from `completed_at` (local date) when available, falling back to `scheduled_date` — no drift when jobs complete early or late (`b985bb3`)

---

## Open / Deferred Items

| Item | Status | Notes |
|------|--------|-------|
| DB password rotation | ⏸ Pending | Schedule at a safe pause point; do not interrupt active work |
| Phase 2F — Final Multi-Business Audit | ✅ Complete | All 13 tables verified — no blockers found |
| Phase 2G — `leads` RLS SELECT/DELETE cosmetic cleanup | ✅ Complete | Applied via SQL Editor on `lewzqavgvltzwfeypvam`; SELECT/DELETE now use `is_business_member(business_id)` only; INSERT/UPDATE unchanged |
| Phase 2G — Cron routes multi-business scoping | ⏸ Deferred | Acceptable for single-business; address when multi-business support is being built |
| WicksburgLawnService phone input formatting (Patch C) | ✅ Complete | `2a7b0f8` in WicksburgLawnService — separate repo, no YardOps changes |
| B.7a website frequency/service-interest intake | ⏸ Pending | `6c8bada` in WicksburgLawnService |
| B.7b YardOps consumption of B.7a leads | ⏸ Pending | Verify normalization/carryover |
| Stale jobs with `service_package = null` and no property booleans | ℹ️ Minor | Cards show no 🌿 line — acceptable for now, data cleanup optional |
| Phase 4 — Operations UX polish (4A–4D + cleanup) | ✅ Substantially complete | Today/Jobs polish, follow-up, Finances, payment workflow, cleanup batch all done (`8232e4a`) |
| `overdueCount` → `staleUnpaidCount` rename in `jobs/page.tsx` | ✅ Complete | `c1b22b9` |
| Customer detail `+ New Job` shortcut | ✅ Complete | `5acdcbb` |
| Job detail payment row wording polish | ✅ Complete | `463e762` |
| Phase 5A — Customer collections / receivables | ✅ Complete | Balance badges, Outstanding Balance section, SMS reminder, portal clarity — all production-verified |
| Phase 5B — Estimate conversion + business phone | ✅ Complete | Duplicate guard, View Job link, businesses.name SMS, businesses.phone setting + formatting — all production-verified |
| Phase 5C — Portal invoices, receipt SMS, partial payment stability | ✅ Complete | Portal invoice page, portal service history links, completion SMS invoice URL, receipt SMS, not_billable guard, FormData fix — production-verified |
| Phase 5D — Follow-up completion-date anchor | ✅ Complete | `b985bb3` — `ScheduleFollowUpCard` anchors from `completed_at`; no migration |
| Printable/downloadable portal invoice PDF | ⏸ Future | Portal invoice page is web-only; PDF export not yet added |
| Job detail View Estimate link | ⏸ Future | When `job.estimate_id` exists — not yet added |
| Convert-to-job date/time pre-fill polish | ⏸ Future | Deferred — Phase 5 candidate |
| Public quote page phone source | ⏸ Future | Uses separate data path; not updated in Phase 5B |
| `JobActions` SMS business phone | ⏸ Future | On-my-way / day-before / job-complete SMS bodies; `businessPhone` not yet passed as prop |
| Operational weekly summary improvements | ⏸ Future | Deferred — Phase 5 candidate |
| Bulk job actions | ⏸ Future | Deferred — Phase 5 candidate |
| Revenue / expense reporting improvements | ⏸ Future | Deferred — Phase 5 candidate |

---

## Post-Phase-2E Roadmap

Full roadmap lives in Architecture.md §16. Summary:

| Phase | Goal | Status |
|-------|------|--------|
| 2F | Final end-to-end multi-business audit | ✅ Complete |
| 2G | Defense-in-depth cleanup (exports, legacy fields, scoping) | ✅ Active cleanup complete — cron multi-business scoping deferred |
| 3 | Public intake and lead workflow improvements | ✅ Complete — all listed tasks done through `ec48565`; payment bugfixes continued in Phase 4 |
| 4 | Operations UX / workflow polish | ✅ Substantially complete — 4A–4D + cleanup batch done (`463e762`) |
| 5 | Reporting, automation, and growth features | ⏸ In Progress — Phase 5A ✅, 5B ✅, 5C ✅ complete; Phase 5D follow-up anchor ✅ complete (`b985bb3`) |

**Permanent Future-Handoff Requirements** (mandatory — see Architecture.md §16):
Every future handoff must instruct the next chat to read ARCHITECTURE.md and HANDOFF.md first, remind it to update those docs after any verified/committed change, state the latest commit, current phase status, open items, workflow guardrails, and known security follow-ups (no secret values).

---

## Recommended Next Task

**Phase 5E planning — next area TBD**

Phase 5A–5C (customer collections, estimate conversion + business phone, portal invoices + receipt SMS + payment stability) and Phase 5D (follow-up completion-date anchor) are all production-verified and complete as of `b985bb3`.

**Completed Phase 5A–5D work:**
- ✅ Customers list unpaid balance badges
- ✅ Customer detail Outstanding Balance section
- ✅ Balance reminder SMS with portal link
- ✅ Portal service history payment clarity
- ✅ Estimate conversion duplicate guard + View Job link
- ✅ Estimate SMS business name from `businesses.name`
- ✅ Business-scoped phone — Settings field, formatting, all customer-facing surfaces
- ✅ Portal invoice page `/portal/[token]/invoice/[jobId]` (token-scoped, double-scoped)
- ✅ Portal service history → View Invoice links
- ✅ Completion SMS includes portal invoice URL
- ✅ Later payment receipt SMS (`buildPaymentReceiptSms`)
- ✅ `not_billable` suppresses owed display and SMS
- ✅ Repeated partial payment FormData submission fixed (permanent `useActionState` invariant)
- ✅ Follow-up date anchored from `completed_at` (prevents drift on early/late completions)

**Next Phase 5 candidates:**
1. Job detail View Estimate link — add back-link from job to its source estimate
2. `JobActions` SMS business phone — wire `businessPhone` into on-my-way / day-before / job-complete SMS
3. Portal enhancements — customer-facing UX improvements
4. Operational weekly summary — improve daily/weekly brief for the operator
5. Revenue/expense reporting — more useful Finances page analytics
6. Bulk job actions — mark multiple jobs paid, batch scheduling
7. Printable portal invoice PDF — web-only currently

**Phase 3 completed tasks (all user-tested in production — historical record):**
1. ~~Frequency display — website lead detail page~~ ✅ (`0589026`)
2. ~~Frequency display — lead detail property card~~ ✅ (`3cc8a77`)
3. ~~Show service interests on website lead detail page~~ ✅ (`591ca1b`)
4. ~~Clean website lead notes display~~ ✅ (`f496246`)
5. ~~Quote page summary frequency label fix~~ ✅ (`5f9ba2d`)
6. ~~Website lead detail frequency label rename~~ ✅ (`1941585`)
7. ~~Manual lead detail visual alignment~~ ✅ (`820b053`)
8. ~~Manual lead request/property display merge~~ ✅ (`4001837`)
9. ~~Add Property acreage prefill from matched parcel~~ ✅ (`0e724ea`)
10. ~~Add Property parcel_id carryover~~ ✅ (`4c18726`)
11. ~~Parcel Lookup lot-size fallback fix~~ ✅ (`fddb06a`)
12. ~~Parcel Lookup zero acreage skip~~ ✅ (`01b1d11`)
13. ~~Add Property county prefill from matched parcel~~ ✅ (`8966add`)
14. ~~normalizeFrequency duplicate/unreachable case cleanup~~ ✅ (`df491c0`)
15. ~~EstimateForm hint clarity — frequency label and service defaults~~ ✅ (`1db4f33`)
16. ~~Job detail service package and job type label polish~~ ✅ (`e3a510e`)
17. ~~Approved estimate operator workflow — Approved tab, approved-state banner, convertToJob notification clear~~ ✅ (`f305373`)
18. ~~Estimates default to Open; converted-estimate notification filtering; stale notification SQL cleanup~~ ✅ (`e7407c9`)
19. ~~Orphaned estimate notification guard — null estimate_id filter in layout and Today notification queries~~ ✅ (`1c19d44`)
20. ~~Post-estimate workflow audit — scheduling, completion, payment, follow-up flow~~ ✅ (read-only audit)
21. ~~Today service label polish — SERVICE_LABELS map, no job_type fallback, friendly labels in cards and SMS bodies~~ ✅ (`cb05cdd`)
22. ~~PDF invoice service description cleanup — `const desc = data.jobTitle`~~ ✅ (`46fc17b`)
23. ~~Persist paid-at-completion `amount_paid`; fix PDF totals label overlap~~ ✅ (`dd19b02`)
24. ~~SaaS-safe invoice business name fallback~~ ✅ (`2342041`)
25. ~~Invoice business name from `businesses.name`~~ ✅ (`ec48565`)

Do not run SQL or apply migrations without approval. Do not modify WicksburgLawnService unless explicitly approved.

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

- **Follow-up scheduling:** Follow-up visits are always manually created via `scheduleFollowUpJob()` — `completeJob()` does NOT auto-schedule. The `ScheduleFollowUpCard` component appears after completion and suggests a date based on `property.service_frequency`, anchored from `job.completed_at` (local date, computed server-side) when available, falling back to `scheduled_date`. `property.auto_schedule_next`, `property.service_frequency`, `Property.preferred_service_day`, and `Property.schedule_anchor_date` must remain present for future auto-schedule and preferred weekday implementation.
- **Recurrence chain:** `recurrence_source` (parent) and `next_job_created_id` (child) must not be removed or reset.
- **`started_at` → `actual_minutes`:** `markInProgress()` sets `started_at`; `completeJob()` computes `actual_minutes`. These must stay coupled.
- **Reschedule log:** `reschedule_count` and `reschedule_log` are append-only.
- **Today page date assumptions:** `scheduled_date` as `YYYY-MM-DD`; `completed_at` as full ISO timestamp.
- **Estimate visit fields:** `visit_scheduled_date` and `visit_scheduled_time` appear on Today page.
- **`payment_status` enum:** `unpaid`, `partial`, `paid`, `not_billable` — renaming any value is a breaking change.
- **`amount_paid` on completion:** `completeJob()` resolves `amount_paid` based on the selected payment path: `paid` → `finalPrice`; `partial` → `Math.min(partialAmt, finalPrice)`, auto-promotes to `paid` if amount ≥ price; `unpaid` / `not_billable` → `0`. `markPartial()` is cumulative — adds to existing `amount_paid`, clamps to price, auto-promotes to `paid` when total ≥ price. `markPaid()` sets `amount_paid = price`. These must stay coupled — the invoice PDF relies on `amount_paid` being correct for its PAID banner and balance display.
- **FK cascades:** `job_photos`, `job_visits`, `expenses` all use `job_id` as FK.

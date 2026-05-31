# YardOps Agent Instructions

These instructions are mandatory for any AI/coding agent working in this repo.

## Project Identity

YardOps is the private operations app for Wicksburg Lawn Service.

Current verified YardOps checkpoint commit:

`a28e3d1` (Add missing price guardrails — Phase 5L)

The public website repo is separate:

* `DMart425/WicksburgLawnService` = public lead funnel
* `DMart425/YardOps` = private operations app

Do not merge these responsibilities.

Current verified workflow:

Public website quote form -> Supabase public.leads -> YardOps Website Leads -> Convert to YardOps lead/contact -> Add Property with prefilled frequency/default services -> Save property -> Return to lead detail -> Build editable estimate.

## Approved Supabase Project

The only approved Supabase project for YardOps/Wicksburg is:

`lewzqavgvltzwfeypvam`

Project name:

`Wicksburg Lawn Service`

Never apply migrations, SQL, schema changes, seed data, or destructive actions to:

`kugpjudlgxhxgxnxmeli`

Before any Supabase operation that could change data or schema, print the target project ref and wait for confirmation.

## Database Change Rules

Do not apply migrations automatically unless explicitly approved.

Before writing a migration:

1. Inspect the current live schema.
2. Confirm the target project ref is `lewzqavgvltzwfeypvam`.
3. Explain what the migration changes.
4. Explain rollback risk.
5. Confirm whether it changes data, schema, RLS, functions, triggers, views, or storage.
6. Wait for approval.

Prefer review-only reports before database hardening.

Do not apply migrations without SQL review and explicit approval.

## Current Supabase Concerns

Known items requiring care:

* `leads` update/delete RLS policies may be too permissive.
* `message_logs` insert/select policies may be too broad.
* `handle_new_user()` is a SECURITY DEFINER function and should not be directly executable by anon/authenticated users if it is trigger-only.
* `schedule_upcoming` view should be reviewed before being exposed broadly.
* Missing foreign-key indexes may need cleanup.
* RLS policies using bare `auth.uid()` may need `(select auth.uid())` optimization.
* Type/schema drift must be fixed before policy hardening.

## Type/Schema Rules

Do not let `src/types/database.ts` drift from Supabase.

Known drift areas to verify:

* `Lead` type
* `MessageLog`
* `Estimate`
* `Job`
* `EstimateItem`

If possible, generate Supabase types from the real project and use those as source of truth.

## Public Route Rules

Public routes:

* `/login`
* `/quote/*`
* `/portal/*`

Everything else requires auth.

Do not weaken protected route auth.

## Product Direction

YardOps v1 workflow:

Website lead arrives -> review lead -> convert to customer/property -> create estimate -> approve/send estimate -> schedule job -> complete job -> mark paid/unpaid -> track daily/weekly workflow.

Do not add unrelated features until this loop is stable.

Additional rules:

* Website lead conversion creates a customer/contact only; do not create sparse property records there.
* Property defaults are starting assumptions, not locked quote rules.
* Estimate scope remains editable.
* Property service booleans are source of truth after property save:
	* `default_mowing_enabled`
	* `default_weed_eating_enabled`
	* `default_edging_enabled`
	* `default_blow_off_enabled`
* Website service interests are intake hints and should prefill only before property booleans exist.
* `default_service_package` is soft-retired and must not be dropped yet.
* Canonical YardOps frequencies: `weekly`, `biweekly`, `one_time`, `custom`, `paused`.
* Website frequency values: `weekly`, `biweekly`, `one_time`, `unsure`.
* `unsure` must fail safe to no prefill/null, never weekly by default.

## Change Style

Keep changes small and targeted.

Do not redesign the UI unless asked.

Do not rewrite architecture without approval.

When changing code, explain:

* files changed
* why changed
* what to test
* any env vars or migrations required

## Safety Rules

Never delete data unless explicitly asked.

Never reset the database unless explicitly asked.

Never apply SQL to an unconfirmed Supabase project.

Never assume the connected MCP/Supabase tool is pointed at the correct project. Verify first.
Never commit or push without explicit approval.

## Durable Development Rules

These rules were learned from production bugs and must be preserved across refactors:

* Do not make later-payment receipt SMS say "job complete". The later payment receipt SMS (`buildPaymentReceiptSms`) is operator-triggered after the fact. Only the completion SMS (`buildInvoiceSms`) may reference job completion.
* Do not show owed balances or payment prompts for `not_billable` jobs. No owed line, no invoice/payment SMS.
* Keep portal invoice access token-scoped (`/portal/[token]/invoice/[jobId]`) and job double-scoped to both `customer_id` and `business_id`. Do not weaken this without explicit approval.
* Do not clear, close, key-remount, or otherwise unmount a `useActionState` form in a submit button `onClick` handler. React flushes batched state updates before the native `submit` event fires — unmounting the form in `onClick` prevents the server action from receiving FormData. The only safe thing to do in a submit `onClick` is prepare side-effect state (e.g., SMS body for a receipt button) that does not affect the form's DOM presence.
* Follow-up default dates must anchor from `completed_at` (converted to local date with the business timezone) when available, not from `scheduled_date`. Stale scheduled dates drift the follow-up cadence when jobs are completed early or late. `scheduled_date` is the fallback only if `completed_at` is absent.
* `ScheduleFollowUpCard` optional scheduling helper (Phase 5E) — implemented as suggestion chips only. Manual date entry remains the authority; chips fill the field but never submit. Do not convert chips into auto-submit or forced behavior without explicit approval.
* Preferred weekday suggestions must snap to the closest matching weekday (backward OR forward) within ±4 days of the cadence target — not forward-only. Use `getClosestWeekdayNearDate` from `src/lib/date.ts`. Do not replace it with a forward-only scan.
* Do not force the preferred weekday — if no valid candidate falls within the ±maxDays window (or all candidates are in the past), suppress the chip silently.
* Suggestion chips must explain why they suggest a date (note: "7-day cadence", "Preferred day", "Lighter day (N jobs)"). Do not show a chip without a note.
* Do not add route balancing, weather-based shifting, or auto-scheduling to `ScheduleFollowUpCard` until explicitly asked. Those remain deferred. `Property.schedule_anchor_date` exists in the schema for future use and must not be dropped.
* `Property.preferred_service_day` is property-scoped and optional. It is captured on `/leads/new`, in `PropertyForm`, and displayed on the property detail page. It must never be used to force a scheduled date — it is a hint for suggestion chips only. Do not promote it to a scheduling authority without explicit approval.
* `/today` is the operator operations brief surface — the home dashboard that root redirects to. All additions to `/today` must be actionable and lightweight. Prefer links to existing action pages (e.g., `/jobs/[id]`, `/estimates/[id]`) over hidden automation or background side effects.
* `not_billable` jobs must never inflate owed balances or collected revenue metrics. `not_billable` contributes 0 to `amount_paid` sums naturally — do not add special-case overrides that change this.
* Do not add auto-scheduling, auto-follow-up creation, or any operator-bypassing automation to the Today dashboard without explicit approval. Today sections are read-only/action-link surfaces only.
* Today dashboard polish should reduce visual clutter without hiding action items. Prefer compact single-card formats over separate cards that carry the same navigational destination (e.g., count + amount on one card rather than two cards linking to the same page).
* Stat cards should be deduplicated when one compact card can carry the same meaning. Do not split count and amount into separate cards if they link to the same URL.
* The Needs Follow-up section must suppress false positives: if the same property already has an upcoming active recurring job (`scheduled_date >= today`, `status` in `scheduled`/`in_progress`/`needs_reschedule`), the old completed job must not appear in Needs Follow-up. Filter by `property_id` first; fall back to `customer_id` only when `property_id` is null. This filtering must never remove future jobs from the normal schedule, Jobs page, Tomorrow, or This Week views.
* Do not combine Needs Follow-up filter suppression with any other section. The upcoming-recurring-jobs suppression query is scoped only to the Needs Follow-up display filter.
* Estimate conversion must preserve recurring intent from `estimate.frequency`. `weekly` and `biweekly` estimates must convert to `job_type = 'recurring'` so the converted job is eligible for follow-up scheduling after completion. `one_time`, `null`, or unknown frequencies convert to `job_type = 'one_time'`. Do not hardcode `job_type = 'one_time'` in `convertToJob()`.
* Converted recurring jobs must remain eligible for the normal follow-up scheduling flow (`ScheduleFollowUpCard`, Needs Follow-up on Today). Do not gate follow-up scheduling on how a job was created (manual vs. estimate conversion).
* When calling date helpers such as `getLocalDateStr(timeZone, date)`, always pass a `Date` object as the second argument — not a raw string. Dynamic Supabase `.select()` calls often return fields typed as `any`, which means TypeScript will not catch type mismatches at build time. These bugs surface only at runtime as `RangeError: Invalid time value`. Always wrap ISO timestamp strings with `new Date()` before passing to date helpers.
* `/today` runtime crashes are production hotfixes. Keep fixes minimal and targeted — change only the broken expression, run lint and build, and push immediately after approval. Do not bundle unrelated changes into a hotfix commit.
* Do not call the aggregate payment state "payment history." `jobs.amount_paid`, `jobs.payment_status`, and `jobs.payment_method` are aggregate fields — last-write-wins. No payment event table exists. Using "history" implies an event log that is not present. If a payment event table is added in the future, update this rule.
* Payment Summary on job detail must never show owed amounts or balance-due rows for `not_billable` jobs. `not_billable` means no charge. No price row, no balance row, no owed display — only a "No payment due" status indicator.
* New Job price must not be invented or calculated. The only permitted prefill source is `property.default_price`. If the property has no default price, leave the price field empty with a hint. Do not add a parcel-acreage-based price calculation or any other heuristic price derivation without explicit approval.
* New Job `job_type` should derive from the selected property's `service_frequency` when a property is known: `weekly`/`biweekly` → `'recurring'`; everything else → `'one_time'`. This matches the estimate conversion rule in `convertToJob()`. Use a controlled React select (`value={jobType}`) so it updates dynamically on property change — `defaultValue` (uncontrolled) will not update after initial render.
* Service package prefill in New Job and Job editing must prefer property boolean columns (`default_mowing_enabled`, `default_weed_eating_enabled`, `default_edging_enabled`, `default_blow_off_enabled`) over the legacy `default_service_package` string. Property booleans are the source of truth after property save. `default_service_package` is a fallback only when all four booleans are null.
* Estimate conversion may update `property.default_price` only when the operator explicitly checks the "Save as default price" checkbox in the convert panel. Never silently update the property default price on conversion. The update is best-effort (does not block conversion if it fails) and is scoped by both `property_id` and `business_id`.
* Do not treat missing price as $0 due in operator UI. When `job.price` is null, display "No price set" rather than a calculated $0 balance. Null price means the price is unknown, not zero.
* Do not send pay reminder SMS when no balance can be calculated. The Pay Reminder SMS button must be suppressed when `job.price` is null — a $0 balance link is misleading and incorrect.
* `job.price` is nullable and optional in V1. Do not add hard validation that blocks job creation, completion, or payment actions for missing price unless an explicit approved phase adds that requirement.
* `not_billable` jobs must remain exempt from all owed/balance displays regardless of price field state. The `not_billable` branch is always first and returns early — do not merge it with price-aware logic.
* `markPaid()` must not write `amount_paid = null`. When `job.price` is null, store `amount_paid = 0`. The `payment_status = 'paid'` + `amount_paid = null` combination is inconsistent aggregate state — zero is honest when price is unknown.

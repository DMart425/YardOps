# YardOps Agent Instructions

These instructions are mandatory for any AI/coding agent working in this repo.

## Project Identity

YardOps is the private operations app for Wicksburg Lawn Service.

Current verified YardOps checkpoint commit:

`0cd8a60` (Link converted estimates to source follow-ups — Phase 5X.5 complete)

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
* Workflow polish should preserve context with query params when creating jobs/estimates from customer/property pages. `/jobs/new` and `/estimates/new` both accept `customer_id` and `property_id` params that pre-select the customer and property in the form. Always pass available context when linking to creation routes.
* Use clear navigation labels with action verbs: `View Customer`, `View Property`, `View Estimate`. Do not use bare nouns ("Customer", "Property") as button labels when the button navigates to that entity's detail page.
* Avoid redundant nested section labels. If a page section is already titled "Action Center", the inner card should not also be titled "Actions". Use a descriptive label like "Manage Estimate" instead.
* Do not add navigation polish by changing business logic, server actions, or routes unless explicitly approved. Navigation improvements are link additions and label changes only.
* Do not hide no-price unpaid/partial jobs from customer awareness when an existing balance surface is present. Track them separately as `noPriceUnpaidJobs` and display a muted note prompting the operator to set a price — do not silently omit them.
* Do not include no-price jobs in balance reminder SMS totals. The SMS button must be gated on `outstandingJobs.length > 0` (calculable priced balances only). A null-price job cannot produce a valid dollar amount for an SMS body.
* Do not show `$0 owed` or `$0 due` for null-price jobs. When `job.price` is null, the balance is unknown — not zero. Always compute balance as `job.price != null ? Math.max(0, Number(job.price) - Number(job.amount_paid ?? 0)) : null` and gate owed/due display on `balance != null`.
* Do not add property-level outstanding balance sections unless explicitly approved. Balance display is a customer-level surface (`customers/[id]`) only. Property pages intentionally do not show per-property outstanding balances in V1.
* Keep no-price display fixes separate from payment action logic unless explicitly approved. `noPriceUnpaidJobs` is a UI-only display variable — it must never feed into `outstandingJobs`, `totalUnpaid`, SMS bodies, portal token creation, or any payment action.
* Estimate detail pages must clearly communicate the estimate's current state and the correct next action. Each status (`draft`, `sent`, `approved`, `converted`, `declined`) should have a visible top-of-page banner or notice that orients the operator.
* Converted estimates should direct the operator to the job. Do not show Schedule Visit or Send to Customer cards on converted estimates — the job is the relevant record after conversion.
* Declined estimates are closed. Do not show Schedule Visit or Send to Customer cards on declined estimates. The page should be visually quiet with a clear "declined" indicator.
* Do not change estimate status-transition logic, `convertToJob()`, or SMS behavior during UI state polish phases without explicit approval. State polish is conditional rendering only.
* `jobs.job_inputs` is the structured service scope source of truth for new jobs. Always write it when creating jobs via `JobForm` or converting estimates via `convertToJob()`. Do not skip it when refactoring creation or conversion logic.
* `service_package` is a legacy fallback only. Keep writing derived `service_package` on job insert until all display paths consuming it are retired. Do not treat it as the canonical scope.
* `JobForm` does not calculate price. The only permitted price prefill source is `property.default_price`. Do not add acreage-based or other heuristic pricing without explicit approval.
* `job_type` (`recurring` / `one_time`) is an internal scheduling field. UI should show `service_frequency` from the property when available. Never expose `job_type` as a service scope label.
* Direct estimate conversion via `convertToJob()` must write `job_inputs` derived from `estimate_inputs` using `deriveJobInputsFromEstimateInputs()`. Null `estimate_inputs` safely produces null `job_inputs`; this is correct behavior — do not throw or block conversion.
* Follow-up jobs created by `scheduleFollowUpJob` must copy `job_inputs` from the parent completed job when `job_inputs` is non-null.
* Approved estimate conversion for lead-status customers must be gated behind `markLeadCustomerActive`. When `estimate.status === 'approved'` and `customer.status === 'lead'`, the Convert to Job panel must not render. Do not remove this gate without explicit approval.
* Do not invent historical service scope for jobs that have no `estimate_inputs` and no usable `service_package`. Null `job_inputs` on legacy jobs is acceptable — backfilling with guessed values is forbidden.
* Estimate conversion scheduled date should default to the next matching `property.preferred_service_day` on or after `localToday`, using `getClosestWeekdayNearDate(localToday, preferredServiceDay, { minDate: localToday, maxDays: 7 })`. Fall back to `localToday` when no preferred day is set. Operator must always be able to override.
* Supabase migration history drift is a known state. **Do not run `supabase db push`** — it will fail or produce unexpected results. Always use `npx supabase db query --linked --file "<file>"` with explicit project-ref confirmation.
* The Estimate source in the New Job source selector (`JobSource = 'estimate' | 'property' | 'custom'`) is the **only** source that may submit `estimate_id` to `createJob`. The hidden `estimate_id` input must only be rendered when `source === 'estimate' && activeEstimate != null && activeEstimate.propertyId === selectedPropertyId`. Do not render it for Property defaults or Custom sources.
* Switching away from the Estimate source (to Property defaults or Custom) must clear `selectedEstimateId` and cause the `estimate_id` hidden field to be removed from the DOM before the form submits. `createJob` performs server-side validation regardless, but the UI must not leave a stale `estimate_id` in the form.
* Property defaults and Custom sources in `JobForm` must never trigger estimate conversion side effects (`status = 'converted'`, lead→active promotion, notification clear). Those side effects are only valid when `estimate_id` is present, validated, and matches the selected customer + property.
* The New Job source selector should only be shown when it is useful: display the Estimate radio option only when `propertyEstimates.length > 0` (approved estimates exist for the currently selected property). When no approved estimates exist for the property, suppress the entire source selector; the form behaves as if Property defaults or Custom is selected.
* The "Review & Create Job" path (`/jobs/new?estimate_id=`) and the direct "Convert to Job" path (`convertToJob()`) must be equivalent in conversion outcomes: both write `job_inputs`, mark the estimate `converted`, promote lead customers to `active`, and clear unreviewed `estimate_approved` notifications. Do not introduce asymmetry between these two conversion paths without explicit approval.
* Keep helper text minimal on estimate detail pages. Avoid adding explanatory paragraphs beneath buttons when the button label is already self-explanatory. The "Review & Create Job" button and the "Convert to Job" panel do not need helper text that re-states what the button does.
* Customer-facing service scope must prefer `job_inputs` when present. Do not use `service_package` alone when `job_inputs` data is available for the same job.
* Do not use current property default booleans (`default_mowing_enabled`, etc.) to describe historical job work on public-facing surfaces. Property defaults reflect current intent, not what was actually performed on a specific past job. `job_inputs` is the per-job record of what was done.
* Add-ons should be shown only when selected. Do not show an add-ons row or label when all add-on levels are `'none'` and all shrub counts are `0`.
* Customer-facing add-on labels must not expose internal level detail (light / basic / full) unless explicitly required. Labels like "Bagging clippings" and "Leaf cleanup" are correct; "Bagging clippings (basic)" is not.
* Completion notes (`jobs.completion_notes`) are customer-visible and must remain intentional. The Complete Job form autofills the textarea from `buildDefaultCompletionNotes()` (`src/lib/jobScope.ts`) so the operator can review and edit before submitting. Do not bypass or suppress this autofill without approval.
* Do not reintroduce package-style quick chips in the completion notes form. The quick-chip pattern was removed in Phase 5U because it did not reflect actual job scope. `buildDefaultCompletionNotes()` with a structured source is the replacement.
* `completion_notes` is the canonical customer-visible work summary. Do not expose `internal_notes` or `customer_notes` fields on the public portal without explicit approval.
* `src/lib/jobScope.ts` is a pure TypeScript shared helper — no React imports. It is used by server components (portal, invoice) and client components (JobActions) alike. Do not add React or Next.js imports to it. Do not duplicate its parse/format logic inline at call sites.
* Today weather should resolve coordinates in priority order: stored `property.latitude`/`property.longitude` first → transient `geocodeAddress()` from `service_address + city + state + postal_code` → city/ZIP centroid fallback (`city, state, postalCode` only). Do not skip the stored-coords check.
* Do not write geocoded coordinates back to Supabase from the Today page or any read-only server component. Geocoding on Today is transient and display-only.
* Today weather must display current/near-now conditions from Open-Meteo `current=temperature_2m,weather_code`, not the daily dominant `weather_code`. Daily `weather_code` represents the worst condition across the entire day (including overnight) and must not be shown as the live condition.
* When effective coordinates exist (stored or geocoded) but the Open-Meteo fetch returns null, show `"Weather unavailable for this property."` so the operator sees that weather was attempted. Do not silently suppress it.
* Completed Today cards do not show weather. Weather is relevant to jobs the operator is about to drive to. Do not add weather to Completed Today cards without explicit approval.
* `estimates.source_job_id`, `estimates.satisfies_follow_up`, and `estimates.sets_property_defaults` are operator-internal fields. Do not expose them on the public quote page (`/quote/[token]`). The public quote page may show a disclosure notice when `sets_property_defaults` is true, but must never expose the source job ID or follow-up linkage details.
* Approval is the single write point for property defaults from an estimate. When `estimates.sets_property_defaults = true`, the `applyPropertyDefaultsFromEstimate()` helper is called at customer acceptance, manual approval, and status approval. Conversion (`convertToJob()` and `createJob()`) must never re-apply property defaults regardless of this flag.
* `estimates.satisfies_follow_up` linkage must be equivalent between the two conversion paths. Both `convertToJob()` (direct) and `createJob()` via `/jobs/new?estimate_id=` must write `recurrence_source` on the new job and update `next_job_created_id` on the source job when `satisfies_follow_up = true` and `source_job_id` is set. Do not introduce asymmetry between these paths.
* The `next_job_created_id` update from `satisfies_follow_up` must be guarded by `.is('next_job_created_id', null)` to prevent double-write if the field was already set by a prior follow-up.
* Do not infer follow-up satisfaction from arbitrary future jobs. `satisfies_follow_up` is an explicit operator intent flag on the estimate — it is not automatically inferred from job dates, frequencies, or customer matches.
* Do not store `satisfies_follow_up` linkage in `internal_notes`, `completion_notes`, or `estimate_inputs`. Linkage is stored in `jobs.recurrence_source` (on the new job) and `jobs.next_job_created_id` (on the source job) only.
* When `sets_property_defaults = true` on a converted estimate, the "Save as default price" checkbox in the Convert to Job panel must be replaced with an informational note stating the property agreement was already updated at approval. Do not show the checkbox — it implies the update hasn't happened yet.
* Estimate conversion scheduled date may default from source job cadence: if `source_job_id` is set and the source job has `status = 'completed'`, use `completed_at` (converted to local date) as the anchor. weekly estimate → anchor + 7d; biweekly → anchor + 14d. Snap to `preferred_service_day` ±4d when set. Fall back to preferred-day-near-today or today when no source/cadence exists. Always wrap ISO strings in `new Date()` before passing to date helpers.
* The public quote page must display a visible agreement-replacement notice when `estimate.sets_property_defaults = true`. This notice must state that accepting the estimate will replace the property's ongoing service plan. Do not remove this notice without explicit approval.

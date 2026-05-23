# YardOps Agent Instructions

These instructions are mandatory for any AI/coding agent working in this repo.

## Project Identity

YardOps is the private operations app for Wicksburg Lawn Service.

Current verified YardOps checkpoint commit:

`b985bb3` (Anchor follow-up date to completion)

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
* Do not add preferred weekday snapping or route balancing to `ScheduleFollowUpCard` until explicitly asked. Those features are planned but deferred. `Property.preferred_service_day` and `Property.schedule_anchor_date` exist in the schema for that future use.

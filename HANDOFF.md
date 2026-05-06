# YardOps Handoff (Source of Truth)

Last updated: 2026-05-06

## Official Source of Truth

- Repo: DMart425/YardOps
- Branch: main
- Official commits:
  - 124c22a - B.6: distinguish customer quote acceptance vs manual approval + persistent notifications
  - 628d77a - customer/property cleanup, reassignment, restore, archived-property separation
  - a306d6b - safe estimate delete control
  - 745fa01 - customer quick actions
  - 9c1915c - parcel source metadata and property parcel import
  - 4642128 - hardened/aligned lead cleanup controls
  - d02df30 - feat: show imported parcel summary on estimates (zero-acre normalization + EstimateForm summary card)
- Pending commits:
  - B.7a: Website B.7a (6c8bada in DMart425/WicksburgLawnService) - canonical frequency values + service interests in lead notes
  - B.7b: YardOps consumes website B.7a leads - normalize frequency, parse service interests, apply estimate defaults

## Standing Coding Workflow

- This ChatGPT thread is for audit/planning/review.
- Coder makes local changes only.
- Coder does not commit or push until approved.
- Coder must read AGENTS.md and ARCHITECTURE.md before each phase.
- Coder must keep changes scoped.
- Coder must run:
  - npm run lint
  - npm run build
  - npm test if it exists; if not, report no test script exists.
- Coder must return:
  - changed file list
  - full diff
  - exact validation outputs
  - manual tests run
  - known issues or uncertainty
- Commit/push only after approval.

## Supabase Migration Workflow

- Coder creates migration files only.
- Coder does not apply migrations to live Supabase.
- Coder returns migration SQL/diff.
- Migration is reviewed in ChatGPT.
- Assistant applies approved migration to the confirmed Supabase project.
- App is tested against real DB before commit/push.

Current confirmed Supabase project ref:
- lewzqavgvltzwfeypvam

Applied migration:
- 20260505203500_create_parcel_sources.sql

Confirmed parcel_sources seed:
- houston_county_al_parcels -> Houston County, AL

## Current Architecture Decisions

- Customers are people/contacts/billing relationship.
- Properties are first-class records and remain their own section.
- Jobs represent scheduled/completed work.
- Estimates represent quoted/proposed work.
- Website leads live in public.leads.
- Manual leads live in customers with status = 'lead'.
- Manual leads may own properties before becoming active customers.
- Lead-status customers should display as "(Lead)" in property dropdowns.
- Website Lead -> Manual Lead/customer record -> Active Customer is the intended lead lifecycle.

## Cleanup/Delete Rules

- Customer and property delete controls exist but require typed confirmation.
- Safe deletes block real business history.
- Test cleanup exists for customer-linked fake/test records.
- Estimate delete requires typed DELETE and deletes only estimate_items + estimate.
- Website lead delete requires typed DELETE and redirects to /leads.
- Website lead quick red X and Clear All were removed.
- Manual lead cleanup uses the Customer Danger Zone.

## Parcel Architecture

- parcels.source matches parcel_sources.source_key.
- parcel_sources provides source metadata such as county/state.
- Parcel lookup imports raw parcel fields such as PhysAddr, CityName, StateAbbr, ZipCode when present.
- County/state fallback comes from parcel_sources metadata.
- City/ZIP are not guessed.
- PropertyForm requires service_address, city, state, and county.
- PropertyForm supports parcel import and manual override.
- EstimateForm uses parcel lookup for mowing-time inputs and now shows the imported parcel summary display.

## Known Next Candidates

- ~~Estimate parcel summary display.~~ (completed: d02df30)
- Lead page polish if more inconsistencies appear.
- Better archived/customer/lead filters.
- Duplicate property/address detection.
- Future parcel county imports using parcel_sources.
- Eventually move toward company roles/Owner vs field operator permissions.
- Workflow refactor: unify lead/customer/property/estimate creation paths (see Workflow Refactor Checkpoint below).

## Guardrails

- Do not redesign the whole app unless explicitly asked.
- Do not add schema/migration/RLS/env changes unless explicitly approved.
- Do not remove lead-status customers from property assignment.
- Do not make destructive actions one-click.
- Do not hardcode county/state defaults in UI/forms.
- Keep changes phase-scoped and reviewable.

---

## Workflow Refactor Checkpoint

Last updated: 2026-05-05

### Phase A Status

Phase A current workflow audit was completed on 2026-05-05. No code was changed. No commits or pushes were made. The audit produced a full workflow map and creation path matrix.

### Phase B.2 Status

Phase B.2 (lead-first creation hardening) was completed after Phase B.1.

- `createLead()` now creates only a lead/contact (`customers.status = 'lead'`) and does not create a property row.
- `convertWebsiteLead()` now creates only a lead/contact (`customers.status = 'lead'`), marks the website lead as converted, and does not create a property row.
- Website/manual intake address and requested frequency are preserved in customer notes so details are not lost before full property creation.
- Property creation now happens afterward from lead/contact/customer context via `/properties/new?customer_id=...`.

### Phase B.3 Status

Phase B.3 (estimate workflow hardening + lightweight revisions) was completed after Phase B.2.

- `/estimates/new` no longer supports inline customer creation or inline property creation.
- Estimate creation now requires selecting an existing contact/customer and an existing property.
- Editing a `sent` or `approved` estimate now increments `revision_number`, sets `last_revised_at`, resets `status` to `draft`, and clears `accepted_at`.
- Marking an estimate as sent now sets `last_sent_at`.
- Converted estimates are locked from editing.
- Public quote and internal estimate detail now show revision context when `revision_number > 1`.

### Phase B.4 Status

Phase B.4 (estimate revision UX polish) was completed after Phase B.3.

- Internal estimate detail: revised draft estimates now show a warning banner — "This estimate was revised and must be sent again before approval."
- Internal estimate detail: SMS preview first line now reads "here is your revised lawn service estimate" when `revision_number > 1`.
- Estimate edit page: editing a `sent` estimate shows an inline warning — "Saving changes will mark this estimate as draft and it must be sent again."
- Estimate edit page: editing an `approved` estimate shows a stronger inline warning — "Saving changes will revoke the prior approval. The customer will need to approve the revised estimate again."
- Status actions: "Mark as Sent" button label changes to "Send Revised Estimate" when `revision_number > 1`.
- Public quote page: already showed "Revised Estimate v{N}" and "Updated <date>" from Phase B.3; no additional changes needed.

### Phase B.5 Status

Phase B.5 (lead -> property -> estimate handoff fixes) was completed after Phase B.4.

- Manual `/leads/new` now captures full property data up front and creates both `customers(status='lead')` and a complete `properties` row in one flow.
- Manual lead creation now supports parcel import on `/leads/new` so address + acreage can be imported before save.
- If property creation fails after customer insert in manual lead flow, customer insert is rolled back and a clear error is returned.
- Lead detail no longer shows duplicate Add Property actions when no property exists; only one clear Add Property path remains.
- Converted/manual lead Add Property path now prefills available intake data (address/frequency/package) into `/properties/new` via query params.
- `/properties/new` now accepts prefill query params for address/frequency/package/acres and applies them to `PropertyForm` defaults.
- Estimate property queries for `/estimates/new` and `/estimates/[id]/edit` now include `service_frequency` and `default_service_package`.
- Estimate form now auto-applies selected property defaults for mow-time (from acres), frequency, and service package-derived service levels, while parcel lookup remains available as an override tool.

### Phase B.6 Status

Phase B.6 (estimate approval source tracking + persistent in-app notifications) was completed after Phase B.5.

- `estimates` approval metadata is now tracked with `approved_by_source`, `manually_approved_at`, and `approval_note` in the local code and migration file.
- Public quote acceptance now records `approved_by_source = 'customer_quote'`, preserves push behavior, and attempts to create an `app_notifications` row for the estimate owner without failing the customer flow if notification creation fails.
- Manual approval from estimate detail now requires an approval note and records `approved_by_source = 'manual'`, `manually_approved_at`, and `approval_note`.
- Revising a sent/approved estimate back to draft now also clears approval metadata in addition to clearing `accepted_at`.
- Today page now shows a compact approved-estimate notification card for unreviewed notifications, and marking one reviewed clears it for that user.
- Protected navigation now shows an Estimates badge count for unreviewed approved-estimate notifications.
- Migration file was created locally only and was not applied to Supabase.

### Current Workflow Drift (Confirmed in Phase A Audit)

1. **Website lead conversion previously created sparse property records (resolved in Phase B.2).** `convertWebsiteLead()` no longer inserts properties during conversion.

2. **Manual Add Lead now creates a full property record (updated in Phase B.5).** `createLead()` now creates a lead contact and complete property together using required property validation fields.

3. **Add Property via `/properties/new` uses full `PropertyForm` validation.** This path correctly requires all address fields, parcel import support, and geocoding. It is the only path that creates complete property records.

4. **Estimate inline new customer/property creation paths were removed in Phase B.3.** Estimate creation now requires existing contact/customer + existing property, and no longer creates customers/properties inline.

5. **Parcel lookup exists in multiple different patterns.** Four places, three implementation patterns: website lead detail uses direct `ilike` on `parcels`; property detail uses the same direct `ilike`; EstimateForm inline new-property uses a raw fetch with manual math; PropertyForm and EstimateForm parcel display use the shared `ParcelLookup` component.

6. **Lead/customer/property creation flows are scattered.** There is no single entry point that walks through contact → property → estimate. Each section creates records independently, producing structural inconsistencies over time.

7. **`normalized_address` and `full_address` columns exist in the `Property` type but are never written.** No create or update path populates these fields.

8. **Jobs and Today page wiring must be protected during any refactor.** These sections have complex dependencies (see Job Preservation Warnings below).

### Intended Target Lifecycle

```
Lead / Contact
  → Property (with full address + optional parcel import)
    → Estimate (quoted scope and price, sent to customer)
      → Job (scheduled work execution)
        → Completion / Payment / Next Scheduled Job (via auto-schedule or manual)
```

### Working Business Rules

- Estimate is the normal agreement / contract-like step before service begins.
- Active customer status should usually mean an estimate was approved or service terms were otherwise agreed to.
- Manual "Mark Active" (via `markLeadCustomerActive()`) can remain but should be treated as an exception / manual override path, not the normal promotion path.
- Jobs are the schedule and work execution layer and must remain central.
- Jobs can record same-day operational changes and small add-ons.
- New recurring scope or major quoted work should go through an estimate first.

### Likely Refactor Direction (Not Yet Implemented)

- Lead/customer/contact workspace should become the center of the app — the starting point for the full lifecycle.
- Properties should belong to a lead/customer/contact and be created from that context.
- Property creation from `/properties/new` standalone should remain but should not be the primary creation-first entry point.
- Top-level Properties page should remain as search, reference, and management — not a random creation-first starting point.
- Estimates should normally be launched from a lead/customer/property context.
- Estimates page should remain as reference and management.
- Jobs page remains the **primary** schedule and work execution center. It should not be demoted, hidden, or reduced in scope during any refactor.
- Today page remains the daily operational view and must not change behavior during refactor.

### Job Preservation Warnings

These must not break during any refactor:

- **Recurring auto-schedule:** `completeJob()` checks `property.auto_schedule_next`, `service_frequency`, and `scheduled_date`. All three must remain present and non-null for next-job creation.
- **Recurrence chain:** `recurrence_source` (parent job ID) and `next_job_created_id` (child job ID) form the recurring chain. These columns and their values must not be removed or reset.
- **`started_at` → `actual_minutes`:** `markInProgress()` sets `started_at`; `completeJob()` consumes it to compute `actual_minutes`. These must stay coupled.
- **Reschedule log:** `reschedule_count` and `reschedule_log` are append-only. No edit path may reset them.
- **Today page date assumptions:** Today page compares `scheduled_date` as a plain `YYYY-MM-DD` string and `completed_at` as a full ISO timestamp. Both formats must stay stable.
- **Estimate visit fields:** `visit_scheduled_date` and `visit_scheduled_time` appear on Today page under a separate section. These must survive any estimate schema changes.
- **`payment_status` enum:** Values `unpaid`, `partial`, `paid`, `not_billable` are used across Jobs, Today, and Finances. Renaming any value is a breaking change and requires a deliberate migration.
- **FK cascades:** `job_photos`, `job_visits`, and `expenses` all use `job_id` as FK. Any job delete or merge must handle cascades correctly.

### Backup Status

- User created a zipped repo backup locally before the refactor planning phase.
- A Supabase backup **script** ZIP was created. The in-database snapshot does **not** exist until the `create_backup` SQL inside that ZIP is executed directly in Supabase.
- The backup script excludes `public.parcels` because parcel data is backed up separately.
- These backups are not Supabase-managed PITR or project-level backups. They are manual snapshots.
- **Before starting any refactor code changes:** open the backup ZIP, run the `create_backup` SQL in the Supabase SQL editor, and confirm the snapshot table was created successfully.

### Next-Session Recommendation

- Start a new chat/session for the workflow refactor planning.
- Begin with Phase B: decide target workflow and page roles before writing any code.
- Do not start coding the refactor until the target workflow is approved.
- Do **not** start by coding helpers, abstractions, or duplicate detection — those come after the core paths are working.
- Refactor one small path at a time. Each path must be validated (lint + build) and committed before starting the next.
- Do not remove or break existing Jobs functionality at any point during the refactor.
- Keep HANDOFF.md updated at each checkpoint.

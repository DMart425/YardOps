# YardOps Handoff (Source of Truth)

Last updated: 2026-05-05

## Official Source of Truth

- Repo: DMart425/YardOps
- Branch: main
- Official commits:
  - 628d77a - customer/property cleanup, reassignment, restore, archived-property separation
  - a306d6b - safe estimate delete control
  - 745fa01 - customer quick actions
  - 9c1915c - parcel source metadata and property parcel import
  - 4642128 - hardened/aligned lead cleanup controls

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
- EstimateForm currently uses ParcelLookup only to fill mowing time; it does not yet show full parcel summary.

## Known Next Candidates

- Estimate parcel summary display.
- Lead page polish if more inconsistencies appear.
- Better archived/customer/lead filters.
- Duplicate property/address detection.
- Future parcel county imports using parcel_sources.
- Eventually move toward company roles/Owner vs field operator permissions.

## Guardrails

- Do not redesign the whole app unless explicitly asked.
- Do not add schema/migration/RLS/env changes unless explicitly approved.
- Do not remove lead-status customers from property assignment.
- Do not make destructive actions one-click.
- Do not hardcode county/state defaults in UI/forms.
- Keep changes phase-scoped and reviewable.

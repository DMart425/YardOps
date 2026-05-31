# YardOps

Private operations app for Wicksburg Lawn Service.

Verified checkpoint commit: `fd5ecd3` (Show preferred day on property detail — Phase 5F).

## Read First

Before making changes, read:

- [AGENTS.md](AGENTS.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)

## Project Boundaries

- `DMart425/YardOps` is the private ops system.
- `DMart425/WicksburgLawnService` is the public marketing + lead funnel.
- Approved Supabase project: `lewzqavgvltzwfeypvam`.

## Current Verified Workflow

1. Public website quote form saves to Supabase `public.leads`.
2. YardOps Website Leads reviews that intake.
3. Website lead conversion creates a YardOps lead/contact (`customers.status='lead'`) only.
4. Property is added from lead context with prefilled frequency/default services.
5. Saving property from lead context returns to lead detail.
6. Estimate is built from that lead/customer + property and remains editable.

## Defaults + Frequency Rules

- Property service booleans are source of truth after property save:
	- `default_mowing_enabled`
	- `default_weed_eating_enabled`
	- `default_edging_enabled`
	- `default_blow_off_enabled`
- Website service interests are intake hints and only prefill before property booleans exist.
- `default_service_package` is soft-retired and must not be dropped yet.

Canonical YardOps frequencies:

- `weekly`
- `biweekly`
- `one_time`
- `custom`
- `paused`

Website frequency values:

- `weekly`
- `biweekly`
- `one_time`
- `unsure`

`unsure` must fail safe to no prefill/null (never weekly by default).

## Safety Rules

- Do not apply migrations without SQL review and explicit approval.
- Do not commit/push without explicit approval.

## Local Development

```bash
npm install
npm run dev
```

Validation:

```bash
npm run lint
npm run build
# npm test (if script exists)
```

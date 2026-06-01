# YardOps

Private operations app for Wicksburg Lawn Service.

Verified checkpoint commit: `4e2c815` (Portal/invoice job scope display + completion note autofill — Phase 5T/5U complete).

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

## Service Scope Model

Jobs store structured service scope in `jobs.job_inputs` (nullable JSONB — added Phase 5Q):

```
{ svcMowing, svcWeedEating, svcEdging, svcBlowOff,
  baggingLevel, stickPickupLevel, leafCleanupLevel, haulOffLevel,
  shrubSmallCount, shrubMediumCount, shrubLargeCount }
```

- `job_inputs` is the source of truth for new jobs and converted estimates.
- `service_package` is a legacy fallback — still written but not the primary source.
- `JobForm` does not calculate price — only `property.default_price` is a permitted prefill.
- `/jobs/new` source selector (Phase 5S): when approved estimates exist for the selected property, a radio group offers **Estimate / Property defaults / Custom**. Selecting Estimate adds a hidden `estimate_id` field; the `createJob` action validates it and marks the source estimate `converted`. Switching away from Estimate removes `estimate_id` — Property defaults and Custom never convert estimates.

### Shared scope helper — `src/lib/jobScope.ts` (Phase 5T)

`src/lib/jobScope.ts` is a pure TypeScript module (no React) used by all customer-facing surfaces:

- `parseJobInputs(raw)` — null-safe JSONB parser; returns `ParsedJobInputs | null`; uses `'svcMowing' in raw` as Phase 5Q+ marker
- `formatCoreServicesForCustomer(inputs)` — comma-separated friendly label for customer display
- `formatAddonsForCustomer(inputs)` — comma-separated add-on label; suppresses internal level detail
- `resolveServiceLabel(jobInputs, pkg, title)` — priority: `job_inputs` core services → `SERVICE_LABELS[pkg]` → capitalised code → `title` → `'Lawn Service'`
- `buildDefaultCompletionNotes(jobInputs, servicePackage)` — operator-facing past-tense autofill for the completion notes textarea (Phase 5U)

Customer-facing surfaces (`/portal/[token]` and `/portal/[token]/invoice/[jobId]`) use `job_inputs` first and fall back to `service_package`/`title`. Property default booleans are **not** used to describe historical job work on public surfaces.

## Defaults + Frequency Rules

- Property service booleans are source of truth after property save:
	- `default_mowing_enabled`
	- `default_weed_eating_enabled`
	- `default_edging_enabled`
	- `default_blow_off_enabled`
- Website service interests are intake hints and only prefill before property booleans exist.
- `default_service_package` is soft-retired and must not be dropped yet.
- `job_type` (`recurring`/`one_time`) is an internal scheduling field — never display it as a service label.

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

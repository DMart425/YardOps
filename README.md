# YardOps

Private operations app for Wicksburg Lawn Service.

Verified checkpoint commit: `0cd8a60` (Link converted estimates to source follow-ups — Phase 5X.5 complete).

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

## Estimate Source-Job Model (Phase 5X)

Three operator-internal columns on `estimates` link an estimate to the job that prompted it and control property default updates:

| Column | Type | Meaning |
|--------|------|---------|
| `source_job_id` | uuid FK → jobs | Completed job that prompted this estimate |
| `satisfies_follow_up` | boolean | When true, the converted job closes the source job's follow-up slot |
| `sets_property_defaults` | boolean | When true, approving the estimate updates the property's default service agreement |

**Approval is the write point for property defaults.** When `sets_property_defaults = true`, approving the estimate (customer acceptance, manual approval, or status approval) calls `applyPropertyDefaultsFromEstimate()` — writes `service_frequency`, `default_price`, service booleans, and `default_service_package`. Conversion does **not** re-apply property defaults.

**Follow-up linkage:** When `satisfies_follow_up = true` and `source_job_id` is set, converting the estimate (either via `convertToJob()` or `/jobs/new?estimate_id=`) writes `recurrence_source` on the new job and `next_job_created_id` on the source job (guarded by `.is('next_job_created_id', null)`).

**Conversion date default:** If `source_job_id` is set and the source job is completed, the convert panel defaults the scheduled date to the source job's `completed_at` (local date) + cadence offset (weekly +7d, biweekly +14d), snapped to `preferred_service_day` ±4d when set.

### Shared scope helper — `src/lib/jobScope.ts` (Phase 5T)

`src/lib/jobScope.ts` is a pure TypeScript module (no React) used by all customer-facing surfaces:

- `parseJobInputs(raw)` — null-safe JSONB parser; returns `ParsedJobInputs | null`; uses `'svcMowing' in raw` as Phase 5Q+ marker
- `formatCoreServicesForCustomer(inputs)` — comma-separated friendly label for customer display
- `formatAddonsForCustomer(inputs)` — comma-separated add-on label; suppresses internal level detail
- `resolveServiceLabel(jobInputs, pkg, title)` — priority: `job_inputs` core services → `SERVICE_LABELS[pkg]` → capitalised code → `title` → `'Lawn Service'`
- `buildDefaultCompletionNotes(jobInputs, servicePackage)` — operator-facing past-tense autofill for the completion notes textarea (Phase 5U)

Customer-facing surfaces (`/portal/[token]` and `/portal/[token]/invoice/[jobId]`) use `job_inputs` first and fall back to `service_package`/`title`. Property default booleans are **not** used to describe historical job work on public surfaces.

## Today Page Weather

Active job cards on `/today` show current weather conditions when effective coordinates are available.

**Coordinate resolution (priority order):**
1. Stored `properties.latitude` / `properties.longitude` (set via the parcel/geocode workflow)
2. Transient geocode via `geocodeAddress()` (`src/lib/geocode.ts`) using `service_address + city + state + postal_code` — 30-day Next.js fetch cache; no DB write-back
3. City/ZIP centroid fallback — if street-level geocode fails (rural road not in OSM), drops the street number and resolves `city, state, postalCode`

**Weather display** (`src/lib/weather.ts` → Open-Meteo, free, no API key):
- `{emoji} {currentTemp}° now · {currentCondition} · High {dailyHigh}° · {rainChance}% rain`
- Current temperature and condition come from Open-Meteo `current=` endpoint
- Daily high and rain-chance provide planning context
- 30-minute Next.js fetch cache

**Fallback:** when effective coordinates exist but Open-Meteo fails, shows "Weather unavailable for this property." Completed Today cards do not show weather (working by design).

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

/**
 * Customer-facing job scope helpers (Phase 5T).
 *
 * These helpers parse and format jobs.job_inputs (added Phase 5Q) for display
 * on customer-facing portal/invoice surfaces.  They are intentionally separate
 * from the operator-facing helpers in jobs/[id]/page.tsx so customer labels can
 * differ (e.g., no add-on level detail shown to customers).
 *
 * Usage:
 *   import { parseJobInputs, resolveServiceLabel, formatAddonsForCustomer } from '@/lib/jobScope'
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedJobInputs {
  svcMowing: boolean
  svcWeedEating: boolean
  svcEdging: boolean
  svcBlowOff: boolean
  baggingLevel: string
  stickPickupLevel: string
  leafCleanupLevel: string
  haulOffLevel: string
  shrubSmallCount: number
  shrubMediumCount: number
  shrubLargeCount: number
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

/**
 * Safely parses a raw JSONB value from Supabase into a typed ParsedJobInputs
 * struct.  Returns null for:
 *  - null / undefined values (legacy jobs pre-dating Phase 5Q)
 *  - non-object values (arrays, strings, numbers)
 *  - objects that lack the `svcMowing` marker key (not a Phase 5Q+ shape)
 *
 * All individual fields fall back to safe defaults when missing or wrong type.
 */
export function parseJobInputs(
  raw: Record<string, unknown> | null | undefined,
): ParsedJobInputs | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  // Phase 5Q.2+ marker — the presence of svcMowing distinguishes job_inputs
  // from any other JSONB that might be stored.
  if (!('svcMowing' in raw)) return null
  return {
    svcMowing:        Boolean(raw.svcMowing),
    svcWeedEating:    Boolean(raw.svcWeedEating),
    svcEdging:        Boolean(raw.svcEdging),
    svcBlowOff:       Boolean(raw.svcBlowOff),
    baggingLevel:     typeof raw.baggingLevel     === 'string' ? raw.baggingLevel     : 'none',
    stickPickupLevel: typeof raw.stickPickupLevel === 'string' ? raw.stickPickupLevel : 'none',
    leafCleanupLevel: typeof raw.leafCleanupLevel === 'string' ? raw.leafCleanupLevel : 'none',
    haulOffLevel:     typeof raw.haulOffLevel     === 'string' ? raw.haulOffLevel     : 'none',
    shrubSmallCount:  typeof raw.shrubSmallCount  === 'number' ? raw.shrubSmallCount  : 0,
    shrubMediumCount: typeof raw.shrubMediumCount === 'number' ? raw.shrubMediumCount : 0,
    shrubLargeCount:  typeof raw.shrubLargeCount  === 'number' ? raw.shrubLargeCount  : 0,
  }
}

// ---------------------------------------------------------------------------
// Format — customer-facing
// ---------------------------------------------------------------------------

/**
 * Returns a comma-separated list of core service names for customer display,
 * or null when no core services are selected.
 *
 * Example: "Mowing, Weed eating, Edging"
 * Returns null (not "None selected") so the caller controls the empty state.
 */
export function formatCoreServicesForCustomer(inputs: ParsedJobInputs): string | null {
  const services: string[] = []
  if (inputs.svcMowing)     services.push('Mowing')
  if (inputs.svcWeedEating) services.push('Weed eating')
  if (inputs.svcEdging)     services.push('Edging')
  if (inputs.svcBlowOff)    services.push('Blow off')
  return services.length > 0 ? services.join(', ') : null
}

/**
 * Returns a comma-separated list of customer-friendly add-on descriptions,
 * or null when no add-ons are selected.
 *
 * Internal level detail (light / basic / full) is intentionally suppressed for
 * customer-facing display.  Shrub counts are shown as "Shrub trimming (N)"
 * where N is the total across all sizes.
 *
 * Example: "Bagging clippings, Leaf cleanup, Shrub trimming (3)"
 */
export function formatAddonsForCustomer(inputs: ParsedJobInputs): string | null {
  const parts: string[] = []
  if (inputs.baggingLevel     && inputs.baggingLevel     !== 'none') parts.push('Bagging clippings')
  if (inputs.stickPickupLevel && inputs.stickPickupLevel !== 'none') parts.push('Stick pickup')
  if (inputs.leafCleanupLevel && inputs.leafCleanupLevel !== 'none') parts.push('Leaf cleanup')
  if (inputs.haulOffLevel     && inputs.haulOffLevel     !== 'none') parts.push('Haul-off')
  const shrubTotal = (inputs.shrubSmallCount ?? 0) + (inputs.shrubMediumCount ?? 0) + (inputs.shrubLargeCount ?? 0)
  if (shrubTotal > 0) parts.push(`Shrub trimming (${shrubTotal})`)
  return parts.length > 0 ? parts.join(', ') : null
}

// ---------------------------------------------------------------------------
// Resolve — combined label for a single "Service" display row
// ---------------------------------------------------------------------------

const SERVICE_LABELS: Record<string, string> = {
  mow_only:      'Mow Only',
  mow_trim_blow: 'Mow, Trim & Blow',
  trim_cleanup:  'Trim & Cleanup',
  full_service:  'Full Service',
}

/**
 * Returns the best available service label for customer-facing display.
 *
 * Priority order:
 *  1. job_inputs core services (Phase 5Q+ structured scope)
 *  2. service_package friendly label (legacy code → SERVICE_LABELS map → capitalised code)
 *  3. title (static job title string)
 *  4. 'Lawn Service' (ultimate fallback)
 *
 * @param jobInputs  Raw JSONB value from jobs.job_inputs
 * @param pkg        Value of jobs.service_package
 * @param title      Value of jobs.title
 */
export function resolveServiceLabel(
  jobInputs: Record<string, unknown> | null | undefined,
  pkg:       string | null | undefined,
  title:     string | null | undefined,
): string {
  const parsed = parseJobInputs(jobInputs)
  if (parsed) {
    const label = formatCoreServicesForCustomer(parsed)
    if (label) return label
  }
  if (pkg) return SERVICE_LABELS[pkg] ?? pkg.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  return title ?? 'Lawn Service'
}

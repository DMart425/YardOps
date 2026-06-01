/**
 * Job scope helpers — customer-facing display (Phase 5T) and operator
 * completion note autofill (Phase 5U).
 *
 * Customer-facing helpers are intentionally separate from the operator helpers
 * in jobs/[id]/page.tsx so customer labels can differ (e.g., no add-on level
 * detail exposed to customers).
 *
 * Usage:
 *   import { parseJobInputs, resolveServiceLabel, formatAddonsForCustomer,
 *            buildDefaultCompletionNotes } from '@/lib/jobScope'
 */

// ---------------------------------------------------------------------------
// Internal utility
// ---------------------------------------------------------------------------

function capFirst(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

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

// ---------------------------------------------------------------------------
// Operator-facing — completion note autofill (Phase 5U)
// ---------------------------------------------------------------------------

/** service_package → default completion note (legacy fallback) */
const PKG_COMPLETION_NOTES: Record<string, string> = {
  mow_only:      'Mowed',
  mow_trim_blow: 'Mowed, weed ate, blew off',
  full_service:  'Mowed, weed ate, edged, blew off',
  trim_cleanup:  'Weed ate, edged, blew off',
}

/**
 * Returns a short, editable completion note pre-filled from job scope.
 *
 * Priority:
 *  1. job_inputs (Phase 5Q+) — builds a comma-separated past-tense list
 *     from whichever services and add-ons were selected.
 *     e.g. "Mowed, weed ate, blew off, cleaned up leaves"
 *  2. service_package — maps legacy package codes to a fixed phrase.
 *     e.g. mow_trim_blow → "Mowed, weed ate, blew off"
 *  3. Ultimate fallback — "Lawn service completed"
 *
 * The returned string is used as the textarea defaultValue so the operator
 * can freely edit or delete it before submitting.
 */
export function buildDefaultCompletionNotes(
  jobInputs:      Record<string, unknown> | null | undefined,
  servicePackage: string | null | undefined,
): string {
  const parsed = parseJobInputs(jobInputs)
  if (parsed) {
    const parts: string[] = []
    // Core services — past-tense, lowercase (first word capped by capFirst below)
    if (parsed.svcMowing)     parts.push('Mowed')
    if (parsed.svcWeedEating) parts.push('weed ate')
    if (parsed.svcEdging)     parts.push('edged')
    if (parsed.svcBlowOff)    parts.push('blew off')
    // Add-ons
    if (parsed.baggingLevel     && parsed.baggingLevel     !== 'none') parts.push('bagged clippings')
    if (parsed.stickPickupLevel && parsed.stickPickupLevel !== 'none') parts.push('picked up sticks/limbs')
    if (parsed.leafCleanupLevel && parsed.leafCleanupLevel !== 'none') parts.push('cleaned up leaves')
    if (parsed.haulOffLevel     && parsed.haulOffLevel     !== 'none') parts.push('hauled off debris')
    const shrubTotal = (parsed.shrubSmallCount ?? 0) + (parsed.shrubMediumCount ?? 0) + (parsed.shrubLargeCount ?? 0)
    if (shrubTotal > 0) parts.push('trimmed shrubs')
    // Only use job_inputs result when at least one flag was set; otherwise fall
    // through to service_package (e.g. a job saved with all boxes unchecked).
    if (parts.length > 0) return capFirst(parts.join(', '))
  }
  if (servicePackage && PKG_COMPLETION_NOTES[servicePackage]) {
    return PKG_COMPLETION_NOTES[servicePackage]
  }
  return 'Lawn service completed'
}

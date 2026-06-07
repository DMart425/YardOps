// Shared server-side utility — no React imports.
// Used by both protected estimates/actions.ts and public quote/[token]/actions.ts
// to apply property default service agreement when an estimate is approved.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = { from: (table: string) => any }

const ALLOWED_FREQUENCIES = new Set(['weekly', 'biweekly', 'one_time', 'custom', 'paused'])

function derivePackageFromBooleans(
  mowing: boolean,
  weedEating: boolean,
  edging: boolean,
  blowOff: boolean,
): string | null {
  if (mowing && !weedEating && !edging && !blowOff) return 'mow_only'
  if (mowing && weedEating && !edging && blowOff)   return 'mow_trim_blow'
  if (!mowing && (weedEating || edging || blowOff))  return 'trim_cleanup'
  if (mowing && (weedEating || edging || blowOff))   return 'full_service'
  return null
}

export type EstimateForDefaults = {
  property_id: string | null | undefined
  frequency: string | null | undefined
  total: number | null | undefined
  estimate_inputs: Record<string, unknown> | null | undefined
  sets_property_defaults: boolean
}

/**
 * Applies property defaults from an approved estimate when sets_property_defaults = true.
 *
 * - Best-effort: logs on failure but does not throw or block the caller.
 * - Must be called only after the estimate has been successfully marked 'approved'.
 * - Must NOT be called for draft / sent / declined transitions.
 * - Does not write preferred_service_day, access notes, or customer fields.
 * - Does not change estimate status.
 *
 * Works with both the regular Supabase client and the admin client.
 */
export async function applyPropertyDefaultsFromEstimate(
  supabase: AnySupabaseClient,
  businessId: string,
  estimate: EstimateForDefaults,
): Promise<void> {
  if (!estimate.sets_property_defaults) return
  if (!estimate.property_id) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {}

  // Frequency — only write canonical YardOps values; skip unrecognized/null
  if (estimate.frequency && ALLOWED_FREQUENCIES.has(estimate.frequency)) {
    update.service_frequency = estimate.frequency
  }

  // Price — skip null or zero
  if (estimate.total != null && Number(estimate.total) > 0) {
    update.default_price = estimate.total
  }

  // Service scope booleans + legacy package — only when estimate_inputs is present.
  // When estimate_inputs is null (legacy estimate), skip the boolean block entirely.
  if (estimate.estimate_inputs) {
    const ei = estimate.estimate_inputs
    const mowing     = ((ei.mowingMinutes   as number  ?? 0)      > 0)
    const weedEating = ((ei.weedEatingLevel as string  ?? 'none') !== 'none')
    const edging     = ((ei.edgingLevel     as string  ?? 'none') !== 'none')
    const blowOff    = ((ei.blowOffLevel    as string  ?? 'none') !== 'none')

    update.default_mowing_enabled      = mowing
    update.default_weed_eating_enabled = weedEating
    update.default_edging_enabled      = edging
    update.default_blow_off_enabled    = blowOff
    update.default_service_package     = derivePackageFromBooleans(mowing, weedEating, edging, blowOff)
  }

  if (Object.keys(update).length === 0) return

  const { error } = await supabase
    .from('properties')
    .update(update)
    .eq('id', estimate.property_id)
    .eq('business_id', businessId)

  if (error) {
    console.error('[applyPropertyDefaultsFromEstimate] Failed to update property defaults:', error)
  }
}

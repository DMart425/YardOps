import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { JobForm, type EstimatePrefill } from '@/components/forms/JobForm'
import { createJob } from '../actions'
import { getLocalDateStr, resolveTimeZone } from '@/lib/date'
import { requireBusinessContext } from '@/lib/business/context'

// ---------------------------------------------------------------------------
// Maps a raw estimate DB row into the EstimatePrefill shape used by JobForm.
// Shared by the explicit ?estimate_id= validation path and the bulk approved-
// estimates fetch so the mapping logic is not duplicated.
// ---------------------------------------------------------------------------
function buildEstimatePrefill(est: {
  id: unknown
  estimate_number: unknown
  customer_id: unknown
  property_id: unknown
  total: unknown
  frequency: unknown
  estimate_inputs: unknown
}): EstimatePrefill {
  const ei = (est.estimate_inputs as Record<string, unknown> | null) ?? null
  return {
    estimateId:       est.id as string,
    estimateNumber:   (est.estimate_number as string | null) ?? null,
    customerId:       est.customer_id as string,
    propertyId:       est.property_id as string,
    price:            est.total != null ? Number(est.total) : null,
    frequency:        (est.frequency as string | null) ?? null,
    svcMowing:        ei ? ((ei.mowingMinutes   as number ?? 0)      > 0)                    : false,
    svcWeedEating:    ei ? ((ei.weedEatingLevel as string ?? 'none') !== 'none')              : false,
    svcEdging:        ei ? ((ei.edgingLevel     as string ?? 'none') !== 'none')              : false,
    svcBlowOff:       ei ? ((ei.blowOffLevel    as string ?? 'none') !== 'none')              : false,
    baggingLevel:     (ei?.baggingLevel     as string) ?? 'none',
    stickPickupLevel: (ei?.stickPickupLevel as string) ?? 'none',
    leafCleanupLevel: (ei?.leafCleanupLevel as string) ?? 'none',
    haulOffLevel:     (ei?.haulOffLevel     as string) ?? 'none',
    shrubSmallCount:  (ei?.shrubSmallCount  as number) ?? 0,
    shrubMediumCount: (ei?.shrubMediumCount as number) ?? 0,
    shrubLargeCount:  (ei?.shrubLargeCount  as number) ?? 0,
  }
}

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ customer_id?: string; property_id?: string; estimate_id?: string }>
}) {
  const { customer_id, property_id, estimate_id } = await searchParams
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('time_zone')
    .eq('user_id', userId)
    .maybeSingle()
  const localToday = getLocalDateStr(resolveTimeZone(settings?.time_zone))

  // Fetch customers, properties, and all approved estimates in parallel.
  // The approved estimates list is passed to JobForm so the source selector
  // can offer available estimates for whichever property the operator selects.
  const [
    { data: customers },
    { data: properties },
    { data: rawApprovedEstimates },
  ] = await Promise.all([
    supabase
      .from('customers')
      .select('id, first_name, last_name, status')
      .eq('business_id', businessId)
      .neq('status', 'archived')
      .order('first_name'),
    supabase
      .from('properties')
      .select('id, customer_id, property_name, service_address, city, default_price, default_service_package, service_frequency, auto_schedule_next, default_mowing_enabled, default_weed_eating_enabled, default_edging_enabled, default_blow_off_enabled')
      .eq('business_id', businessId)
      .eq('status', 'active')
      .order('service_address'),
    supabase
      .from('estimates')
      .select('id, estimate_number, status, customer_id, property_id, total, frequency, estimate_inputs')
      .eq('business_id', businessId)
      .eq('status', 'approved'),
  ])

  // Build EstimatePrefill list for all currently approved estimates.
  // Filtered to rows that have both customer_id and property_id set.
  const allApprovedEstimates: EstimatePrefill[] = (rawApprovedEstimates ?? [])
    .filter(est => est.customer_id && est.property_id)
    .map(est => buildEstimatePrefill(est))

  // ── Explicit ?estimate_id= validation ────────────────────────────────────
  // When ?estimate_id= is present, validate that exact estimate separately.
  // Invalid estimates show a warning; they do not silently fall back to
  // property defaults. The validated estimate is also already in
  // allApprovedEstimates (same status=approved query) so no duplication.
  let estimatePrefill: EstimatePrefill | null = null
  let estimateWarning: string | null = null

  if (estimate_id) {
    const { data: est } = await supabase
      .from('estimates')
      .select('id, estimate_number, status, business_id, customer_id, property_id, total, frequency, estimate_inputs')
      .eq('id', estimate_id)
      .maybeSingle()

    if (!est) {
      estimateWarning = 'Estimate not found or does not belong to this account.'
    } else if (est.business_id !== businessId) {
      estimateWarning = 'This estimate cannot be used for prefill — it belongs to a different account.'
    } else if (est.status !== 'approved') {
      estimateWarning = `This estimate cannot be used for prefill because its status is "${est.status}".`
    } else if (!est.customer_id || !est.property_id) {
      estimateWarning = 'This estimate cannot be used for prefill — it is missing customer or property data.'
    } else {
      estimatePrefill = buildEstimatePrefill(est)
    }
  }

  // When a valid estimate is active, it provides the customer/property selection.
  // Otherwise fall through to the URL params (property/customer page shortcuts).
  const resolvedCustomerId = estimatePrefill?.customerId ?? customer_id
  const resolvedPropertyId = estimatePrefill?.propertyId ?? property_id

  return (
    <div className="page">
      <Link href="/jobs" className="back-link">← Jobs</Link>
      <div className="page-header">
        <h1 className="page-title">New Job</h1>
      </div>
      <div className="card">
        <JobForm
          action={createJob}
          submitLabel="Create Job"
          cancelHref="/jobs"
          customers={customers ?? []}
          properties={properties ?? []}
          defaultCustomerId={resolvedCustomerId}
          defaultPropertyId={resolvedPropertyId}
          localToday={localToday}
          estimatePrefill={estimatePrefill}
          estimateWarning={estimateWarning}
          approvedEstimates={allApprovedEstimates}
        />
      </div>
    </div>
  )
}

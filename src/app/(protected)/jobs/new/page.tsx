import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { JobForm, type EstimatePrefill, type SourceJobPrefill } from '@/components/forms/JobForm'
import { createJob } from '../actions'
import { addDays, getLocalDateStr, resolveTimeZone } from '@/lib/date'
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
  searchParams: Promise<{ customer_id?: string; property_id?: string; estimate_id?: string; source_job_id?: string }>
}) {
  const { customer_id, property_id, estimate_id, source_job_id } = await searchParams
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

  // ── Source job (previous completed job) prefill ──────────────────────────
  // When ?source_job_id= is present, validate and build a SourceJobPrefill so
  // the operator can review/edit scope before creating the follow-up job.
  // Conflicts with estimate_id are handled by source selector precedence in JobForm.
  let sourcePrefill: SourceJobPrefill | null = null
  let sourceJobWarning: string | null = null

  if (source_job_id) {
    const { data: srcJob } = await supabase
      .from('jobs')
      .select('id, status, customer_id, property_id, price, job_type, service_package, job_inputs, completed_at, scheduled_date, next_job_created_id')
      .eq('id', source_job_id)
      .eq('business_id', businessId)
      .maybeSingle()

    if (!srcJob) {
      sourceJobWarning = 'Source job not found or does not belong to this account.'
    } else if (srcJob.status !== 'completed') {
      sourceJobWarning = `Source job cannot be used for a follow-up — its status is "${srcJob.status}", not "completed".`
    } else if (!srcJob.customer_id || !srcJob.property_id) {
      sourceJobWarning = 'Source job is missing customer or property data.'
    } else {
      // Warn (but still prefill) when a follow-up already exists.
      if (srcJob.next_job_created_id) {
        sourceJobWarning = 'A follow-up visit already exists for this job. Creating another will add a second linked job.'
      }

      // Parse job_inputs when present; fall back to service_package for legacy jobs.
      const ji = srcJob.job_inputs as Record<string, unknown> | null
      const coreFromInputs = ji != null
      const svcMowing    = coreFromInputs ? Boolean(ji!.svcMowing)     : ['mow_only', 'mow_trim_blow', 'full_service'].includes(srcJob.service_package ?? '')
      const svcWeedEating = coreFromInputs ? Boolean(ji!.svcWeedEating) : ['mow_trim_blow', 'trim_cleanup', 'full_service'].includes(srcJob.service_package ?? '')
      const svcEdging    = coreFromInputs ? Boolean(ji!.svcEdging)     : ['trim_cleanup', 'full_service'].includes(srcJob.service_package ?? '')
      const svcBlowOff   = coreFromInputs ? Boolean(ji!.svcBlowOff)    : ['mow_trim_blow', 'full_service'].includes(srcJob.service_package ?? '')

      sourcePrefill = {
        sourceJobId:      srcJob.id as string,
        customerId:       srcJob.customer_id as string,
        propertyId:       srcJob.property_id as string,
        price:            srcJob.price != null ? Number(srcJob.price) : null,
        jobType:          (srcJob.job_type as string) ?? 'recurring',
        svcMowing,
        svcWeedEating,
        svcEdging,
        svcBlowOff,
        baggingLevel:     coreFromInputs ? ((ji!.baggingLevel as string) || 'none') : 'none',
        stickPickupLevel: coreFromInputs ? ((ji!.stickPickupLevel as string) || 'none') : 'none',
        leafCleanupLevel: coreFromInputs ? ((ji!.leafCleanupLevel as string) || 'none') : 'none',
        haulOffLevel:     coreFromInputs ? ((ji!.haulOffLevel as string) || 'none') : 'none',
        shrubSmallCount:  coreFromInputs ? ((ji!.shrubSmallCount as number) ?? 0) : 0,
        shrubMediumCount: coreFromInputs ? ((ji!.shrubMediumCount as number) ?? 0) : 0,
        shrubLargeCount:  coreFromInputs ? ((ji!.shrubLargeCount as number) ?? 0) : 0,
      }
    }
  }

  // Compute default scheduled date from source job cadence.
  // Anchors from completed_at (local date) when available, else scheduled_date.
  let defaultScheduledDate: string | undefined
  if (sourcePrefill) {
    const srcJobRaw = source_job_id ? await supabase
      .from('jobs')
      .select('completed_at, scheduled_date, properties(service_frequency)')
      .eq('id', source_job_id)
      .eq('business_id', businessId)
      .maybeSingle()
      .then(r => r.data) : null

    const freq = srcJobRaw
      ? ((Array.isArray(srcJobRaw.properties) ? srcJobRaw.properties[0] : srcJobRaw.properties) as { service_frequency?: string | null } | null)?.service_frequency ?? null
      : null
    const anchor = srcJobRaw?.completed_at
      ? getLocalDateStr(resolveTimeZone(settings?.time_zone), new Date(srcJobRaw.completed_at))
      : (srcJobRaw?.scheduled_date ?? localToday)
    defaultScheduledDate = freq === 'weekly' ? addDays(anchor, 7)
      : freq === 'biweekly' ? addDays(anchor, 14)
      : localToday
  }
  // ─────────────────────────────────────────────────────────────────────────

  // When a valid estimate is active, it provides the customer/property selection.
  // Otherwise fall through to the URL params (property/customer page shortcuts).
  const resolvedCustomerId = estimatePrefill?.customerId ?? sourcePrefill?.customerId ?? customer_id
  const resolvedPropertyId = estimatePrefill?.propertyId ?? sourcePrefill?.propertyId ?? property_id

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
          defaultValues={defaultScheduledDate ? { scheduled_date: defaultScheduledDate } : undefined}
          estimatePrefill={estimatePrefill}
          estimateWarning={estimateWarning}
          approvedEstimates={allApprovedEstimates}
          sourcePrefill={sourcePrefill}
          sourceJobWarning={sourceJobWarning}
        />
      </div>
    </div>
  )
}

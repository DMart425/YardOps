import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { EstimateForm } from '@/components/forms/EstimateForm'
import { createEstimate } from '../actions'
import { formatDateOnly, getLocalDateStr, resolveTimeZone } from '@/lib/date'
import { requireBusinessContext } from '@/lib/business/context'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function NewEstimatePage({
  searchParams,
}: {
  searchParams: Promise<{ customer_id?: string; property_id?: string; source_job_id?: string }>
}) {
  const { customer_id, property_id, source_job_id } = await searchParams
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const [{ data: customers }, { data: properties }, { data: pricingSettings }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, first_name, last_name, phone, status, notes')
      .eq('business_id', businessId)
      .neq('status', 'archived')
      .order('first_name'),
    supabase
      .from('properties')
      .select('id, customer_id, property_name, service_address, city, parcel_acres, estimated_mowable_acres, service_frequency, default_service_package, default_mowing_enabled, default_weed_eating_enabled, default_edging_enabled, default_blow_off_enabled')
      .eq('business_id', businessId)
      .eq('status', 'active')
      .order('service_address'),
    supabase
      .from('pricing_settings')
      .select('target_hourly_rate, minimum_price, time_zone')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const timeZone = resolveTimeZone(pricingSettings?.time_zone)
  const localToday = getLocalDateStr(timeZone)

  // ── Source job resolution ───────────────────────────────────────────────────
  // Only fires when source_job_id is a valid UUID. Falls back gracefully on
  // any validation failure — does not crash the page.
  type SourceJobRow = {
    id: string
    title: string | null
    scheduled_date: string | null
    completed_at: string | null
    customer_id: string
    property_id: string
  }
  let sourceJob: SourceJobRow | null = null
  let sourceJobWarning: string | null = null

  if (source_job_id && UUID_RE.test(source_job_id)) {
    const { data: fetchedJob } = await supabase
      .from('jobs')
      .select('id, title, scheduled_date, completed_at, customer_id, property_id, status')
      .eq('id', source_job_id)
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .maybeSingle()

    if (!fetchedJob) {
      sourceJobWarning = 'Source job not found or not completed — customer and property pre-fill removed.'
    } else if (!fetchedJob.customer_id || !fetchedJob.property_id) {
      sourceJobWarning = 'Source job is missing customer or property links — pre-fill removed.'
    } else {
      sourceJob = fetchedJob as SourceJobRow
    }
  }

  // Date label for the source job banner — prefer scheduled_date (date-only string),
  // fall back to completed_at converted to local date so it matches the operator's timezone.
  const sourceJobDateLabel: string | null = sourceJob
    ? (sourceJob.scheduled_date
        ? formatDateOnly(sourceJob.scheduled_date, { weekday: 'short', month: 'short', day: 'numeric' })
        : sourceJob.completed_at
          ? formatDateOnly(
              getLocalDateStr(timeZone, new Date(sourceJob.completed_at)),
              { weekday: 'short', month: 'short', day: 'numeric' }
            )
          : null)
    : null

  // When a valid source job exists, force customer/property to match it.
  // URL params customer_id/property_id are used only when there is no source job.
  const effectiveCustomerId = sourceJob?.customer_id ?? customer_id
  const effectivePropertyId = sourceJob?.property_id ?? property_id

  return (
    <div className="page">
      <Link href="/estimates" className="back-link">← Estimates</Link>
      <div className="page-header">
        <h1 className="page-title">New Estimate</h1>
      </div>
      <EstimateForm
        action={createEstimate}
        customers={customers ?? []}
        properties={properties ?? []}
        defaultCustomerId={effectiveCustomerId}
        defaultPropertyId={effectivePropertyId}
        defaultHourlyRate={pricingSettings?.target_hourly_rate ?? undefined}
        defaultMinimumPrice={pricingSettings?.minimum_price ?? undefined}
        localToday={localToday}
        defaultSourceJobId={sourceJob?.id ?? null}
        sourceJobTitle={sourceJob?.title ?? null}
        sourceJobDateLabel={sourceJobDateLabel}
        sourceJobWarning={sourceJobWarning}
      />
    </div>
  )
}

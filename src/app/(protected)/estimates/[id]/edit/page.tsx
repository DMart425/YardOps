import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { EstimateForm } from '@/components/forms/EstimateForm'
import { updateEstimate } from '../../actions'
import type { EstimateInputs } from '@/lib/pricing'
import { getLocalDateStr, resolveTimeZone } from '@/lib/date'
import { requireBusinessContext } from '@/lib/business/context'

type CustomerOption = { id: string; first_name: string; last_name: string | null }
type PropertyOption = {
  id: string
  customer_id: string
  property_name: string | null
  service_address: string
  city: string | null
  parcel_acres: number | null
  estimated_mowable_acres: number | null
  service_frequency: string | null
  default_service_package: string | null
  default_mowing_enabled: boolean | null
  default_weed_eating_enabled: boolean | null
  default_edging_enabled: boolean | null
  default_blow_off_enabled: boolean | null
}

export default async function EditEstimatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const { data: estimate } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', id)
    .eq('business_id', businessId)
    .single()

  if (!estimate) notFound()

  if (estimate.status === 'converted') {
    return (
      <div className="page">
        <Link href={`/estimates/${id}`} className="back-link">← Estimate</Link>
        <div className="card">
          <p className="text-small text-muted">Converted estimates are locked and cannot be edited.</p>
        </div>
      </div>
    )
  }

  const [{ data: customersRaw }, { data: propertiesRaw }, { data: pricingSettings }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, first_name, last_name, status')
      .eq('business_id', businessId)
      .neq('status', 'archived')
      .order('first_name'),
    supabase
      .from('properties')
      .select('id, customer_id, property_name, service_address, city, parcel_acres, estimated_mowable_acres, service_frequency, default_service_package, default_mowing_enabled, default_weed_eating_enabled, default_edging_enabled, default_blow_off_enabled, status')
      .eq('business_id', businessId)
      .order('service_address'),
    supabase
      .from('pricing_settings')
      .select('target_hourly_rate, minimum_price, time_zone')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const localToday = getLocalDateStr(resolveTimeZone(pricingSettings?.time_zone))

  let customers = (customersRaw ?? []) as Array<CustomerOption & { status?: string | null }>
  if (!customers.some(customer => customer.id === estimate.customer_id)) {
    const { data: currentCustomer } = await supabase
      .from('customers')
      .select('id, first_name, last_name')
      .eq('id', estimate.customer_id)
      .eq('business_id', businessId)
      .single()
    if (currentCustomer) customers = [currentCustomer as CustomerOption, ...customers]
  }

  let properties = (propertiesRaw ?? []).filter(property => property.status === 'active' || property.id === estimate.property_id) as Array<PropertyOption & { status?: string | null }>
  if (!properties.some(property => property.id === estimate.property_id)) {
    const { data: currentProperty } = await supabase
      .from('properties')
      .select('id, customer_id, property_name, service_address, city, parcel_acres, estimated_mowable_acres, service_frequency, default_service_package, default_mowing_enabled, default_weed_eating_enabled, default_edging_enabled, default_blow_off_enabled')
      .eq('id', estimate.property_id)
      .eq('business_id', businessId)
      .single()
    if (currentProperty) properties = [currentProperty as PropertyOption, ...properties]
  }

  return (
    <div className="page">
      <Link href={`/estimates/${id}`} className="back-link">← Estimate</Link>
      <div className="page-header">
        <h1 className="page-title">Edit Estimate</h1>
      </div>

      {estimate.status === 'sent' && (
        <div className="warning-banner" style={{ marginBottom: '1rem' }}>
          ⚠️ Saving changes will mark this estimate as draft and it must be sent again.
        </div>
      )}
      {estimate.status === 'approved' && (
        <div className="warning-banner" style={{ marginBottom: '1rem' }}>
          ⚠️ Saving changes will revoke the prior approval. The customer will need to approve the revised estimate again.
        </div>
      )}

      <EstimateForm
        action={updateEstimate.bind(null, id)}
        customers={customers.map(({ id: customerId, first_name, last_name }) => ({ id: customerId, first_name, last_name }))}
        properties={properties.map(({ id: propertyId, customer_id, property_name, service_address, city, parcel_acres, estimated_mowable_acres, service_frequency, default_service_package, default_mowing_enabled, default_weed_eating_enabled, default_edging_enabled, default_blow_off_enabled }) => ({
          id: propertyId,
          customer_id,
          property_name,
          service_address,
          city,
          parcel_acres,
          estimated_mowable_acres,
          service_frequency,
          default_service_package,
          default_mowing_enabled,
          default_weed_eating_enabled,
          default_edging_enabled,
          default_blow_off_enabled,
        }))}
        defaultCustomerId={estimate.customer_id}
        defaultPropertyId={estimate.property_id}
        defaultHourlyRate={pricingSettings?.target_hourly_rate ?? undefined}
        defaultMinimumPrice={pricingSettings?.minimum_price ?? undefined}
        initialInputs={estimate.estimate_inputs as EstimateInputs | undefined}
        initialValidUntil={estimate.valid_until}
        initialNotes={estimate.notes}
        initialPriceOverride={estimate.total}
        localToday={localToday}
        defaultSetsPropertyDefaults={estimate.sets_property_defaults ?? false}
        submitLabel="Save Estimate"
        cancelHref={`/estimates/${id}`}
      />
    </div>
  )
}
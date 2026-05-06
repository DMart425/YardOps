import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { EstimateForm } from '@/components/forms/EstimateForm'
import { updateEstimate } from '../../actions'
import type { EstimateInputs } from '@/lib/pricing'

type CustomerOption = { id: string; first_name: string; last_name: string | null }
type PropertyOption = {
  id: string
  customer_id: string
  property_name: string | null
  service_address: string
  city: string | null
  parcel_acres: number | null
  estimated_mowable_acres: number | null
}

export default async function EditEstimatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: estimate } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', id)
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
      .neq('status', 'archived')
      .order('first_name'),
    supabase
      .from('properties')
      .select('id, customer_id, property_name, service_address, city, parcel_acres, estimated_mowable_acres, status')
      .order('service_address'),
    supabase
      .from('pricing_settings')
      .select('target_hourly_rate, minimum_price')
      .single(),
  ])

  let customers = (customersRaw ?? []) as Array<CustomerOption & { status?: string | null }>
  if (!customers.some(customer => customer.id === estimate.customer_id)) {
    const { data: currentCustomer } = await supabase
      .from('customers')
      .select('id, first_name, last_name')
      .eq('id', estimate.customer_id)
      .single()
    if (currentCustomer) customers = [currentCustomer as CustomerOption, ...customers]
  }

  let properties = (propertiesRaw ?? []).filter(property => property.status === 'active' || property.id === estimate.property_id) as Array<PropertyOption & { status?: string | null }>
  if (!properties.some(property => property.id === estimate.property_id)) {
    const { data: currentProperty } = await supabase
      .from('properties')
      .select('id, customer_id, property_name, service_address, city, parcel_acres, estimated_mowable_acres')
      .eq('id', estimate.property_id)
      .single()
    if (currentProperty) properties = [currentProperty as PropertyOption, ...properties]
  }

  return (
    <div className="page">
      <Link href={`/estimates/${id}`} className="back-link">← Estimate</Link>
      <div className="page-header">
        <h1 className="page-title">Edit Estimate</h1>
      </div>
      <EstimateForm
        action={updateEstimate.bind(null, id)}
        customers={customers.map(({ id: customerId, first_name, last_name }) => ({ id: customerId, first_name, last_name }))}
        properties={properties.map(({ id: propertyId, customer_id, property_name, service_address, city, parcel_acres, estimated_mowable_acres }) => ({
          id: propertyId,
          customer_id,
          property_name,
          service_address,
          city,
          parcel_acres,
          estimated_mowable_acres,
        }))}
        defaultCustomerId={estimate.customer_id}
        defaultPropertyId={estimate.property_id}
        defaultHourlyRate={pricingSettings?.target_hourly_rate ?? undefined}
        defaultMinimumPrice={pricingSettings?.minimum_price ?? undefined}
        initialInputs={estimate.estimate_inputs as EstimateInputs | undefined}
        initialValidUntil={estimate.valid_until}
        initialNotes={estimate.notes}
        initialPriceOverride={estimate.total}
        submitLabel="Save Estimate"
        cancelHref={`/estimates/${id}`}
      />
    </div>
  )
}
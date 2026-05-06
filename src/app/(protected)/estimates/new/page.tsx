import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { EstimateForm } from '@/components/forms/EstimateForm'
import { createEstimate } from '../actions'

export default async function NewEstimatePage({
  searchParams,
}: {
  searchParams: Promise<{ customer_id?: string; property_id?: string }>
}) {
  const { customer_id, property_id } = await searchParams
  const supabase = await createClient()

  const [{ data: customers }, { data: properties }, { data: pricingSettings }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, first_name, last_name, phone, status')
      .neq('status', 'archived')
      .order('first_name'),
    supabase
      .from('properties')
      .select('id, customer_id, property_name, service_address, city, parcel_acres, estimated_mowable_acres, service_frequency, default_service_package')
      .eq('status', 'active')
      .order('service_address'),
    supabase
      .from('pricing_settings')
      .select('target_hourly_rate, minimum_price')
      .single(),
  ])

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
        defaultCustomerId={customer_id}
        defaultPropertyId={property_id}
        defaultHourlyRate={pricingSettings?.target_hourly_rate ?? undefined}
        defaultMinimumPrice={pricingSettings?.minimum_price ?? undefined}
      />
    </div>
  )
}

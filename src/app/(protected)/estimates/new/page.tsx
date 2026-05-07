import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { EstimateForm } from '@/components/forms/EstimateForm'
import { createEstimate } from '../actions'
import { getLocalDateStr, resolveTimeZone } from '@/lib/date'

export default async function NewEstimatePage({
  searchParams,
}: {
  searchParams: Promise<{ customer_id?: string; property_id?: string }>
}) {
  const { customer_id, property_id } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: customers }, { data: properties }, { data: pricingSettings }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, first_name, last_name, phone, status, notes')
      .neq('status', 'archived')
      .order('first_name'),
    supabase
      .from('properties')
      .select('id, customer_id, property_name, service_address, city, parcel_acres, estimated_mowable_acres, service_frequency, default_service_package, default_mowing_enabled, default_weed_eating_enabled, default_edging_enabled, default_blow_off_enabled')
      .eq('status', 'active')
      .order('service_address'),
    supabase
      .from('pricing_settings')
      .select('target_hourly_rate, minimum_price, time_zone')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const localToday = getLocalDateStr(resolveTimeZone(pricingSettings?.time_zone))

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
        localToday={localToday}
      />
    </div>
  )
}

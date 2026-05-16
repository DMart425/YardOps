import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PropertyForm } from '@/components/forms/PropertyForm'
import { createProperty } from '../actions'
import type { Property } from '@/types/database'
import { normalizeFrequency } from '@/lib/frequency'
import { requireBusinessContext } from '@/lib/business/context'

function parseOptionalNumber(value?: string): number | null {
  if (!value) return null
  const parsed = parseFloat(value)
  return Number.isNaN(parsed) ? null : parsed
}

function parseBoolParam(value?: string): boolean | undefined {
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  return undefined
}

function parseSafeReturnTo(value?: string): string | undefined {
  if (!value) return undefined
  if (!value.startsWith('/') || value.startsWith('//')) return undefined
  const [path] = value.split('?')
  if (/^\/leads\/[0-9a-fA-F-]{36}$/.test(path)) return value
  if (/^\/customers\/[0-9a-fA-F-]{36}$/.test(path)) return value
  if (/^\/properties\/[0-9a-fA-F-]{36}$/.test(path)) return value
  if (path === '/leads' || path === '/customers' || path === '/properties') return value
  return undefined
}

export default async function NewPropertyPage({
  searchParams,
}: {
  searchParams: Promise<{
    customer_id?: string
    service_address?: string
    city?: string
    state?: string
    county?: string
    postal_code?: string
    service_frequency?: string
    default_service_package?: string
    parcel_acres?: string
    estimated_mowable_acres?: string
    parcel_id?: string
    lot_size_source?: string
    default_mowing_enabled?: string
    default_weed_eating_enabled?: string
    default_edging_enabled?: string
    default_blow_off_enabled?: string
    return_to?: string
  }>
}) {
  const {
    customer_id,
    service_address,
    city,
    state,
    county,
    postal_code,
    service_frequency,
    default_service_package,
    parcel_acres,
    estimated_mowable_acres,
    parcel_id,
    lot_size_source,
    default_mowing_enabled,
    default_weed_eating_enabled,
    default_edging_enabled,
    default_blow_off_enabled,
    return_to,
  } = await searchParams

  const safeReturnTo = parseSafeReturnTo(return_to)

  // No customer context — block standalone creation and direct user to Leads
  if (!customer_id) {
    return (
      <div className="page">
        <Link href="/properties" className="back-link">← Properties</Link>
        <div className="page-header">
          <h1 className="page-title">Add Property</h1>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <p style={{ fontSize: '2rem' }}>🏡</p>
          <p style={{ fontWeight: 600, marginTop: '8px' }}>Properties must be added from a contact</p>
          <p style={{ marginTop: '8px', color: 'var(--text-muted, #888)' }}>
            Open a lead or customer record and use the &ldquo;Add Property&rdquo; option from there.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <Link href="/leads" className="btn btn-primary">Go to Leads</Link>
            <Link href="/customers" className="btn btn-secondary">Go to Customers</Link>
          </div>
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const { businessId } = await requireBusinessContext()

  const { data: customers } = await supabase
    .from('customers')
    .select('id, first_name, last_name, status')
    .eq('business_id', businessId)
    .neq('status', 'archived')
    .order('first_name')

  const defaultValues: Partial<Property> = {
    service_address: service_address ?? undefined,
    city: city ?? undefined,
    state: state ?? undefined,
    county: county ?? undefined,
    postal_code: postal_code ?? undefined,
    service_frequency: (normalizeFrequency(service_frequency) as Property['service_frequency'] | undefined) ?? undefined,
    default_service_package: default_service_package ?? undefined,
    default_mowing_enabled:      parseBoolParam(default_mowing_enabled)      ?? null,
    default_weed_eating_enabled: parseBoolParam(default_weed_eating_enabled) ?? null,
    default_edging_enabled:      parseBoolParam(default_edging_enabled)      ?? null,
    default_blow_off_enabled:    parseBoolParam(default_blow_off_enabled)    ?? null,
    parcel_acres: parseOptionalNumber(parcel_acres),
    estimated_mowable_acres: parseOptionalNumber(estimated_mowable_acres),
    parcel_id: parcel_id ?? undefined,
    lot_size_source: lot_size_source ?? undefined,
  }

  return (
    <div className="page">
      <Link href={safeReturnTo ?? `/customers/${customer_id}`} className="back-link">
        ← Customer
      </Link>
      <div className="page-header">
        <h1 className="page-title">Add Property</h1>
      </div>

      <div className="card">
        <PropertyForm
          action={createProperty}
          submitLabel="Add Property"
          cancelHref={safeReturnTo ?? `/customers/${customer_id}`}
          customers={customers ?? []}
          defaultCustomerId={customer_id}
          defaultValues={defaultValues}
          returnTo={safeReturnTo}
        />
      </div>
    </div>
  )
}

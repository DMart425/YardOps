import { createClient } from '@/lib/supabase/server'
import { requireBusinessContext } from '@/lib/business/context'
import CsvExportButton from '@/components/CsvExportButton'

function formatPhone(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 11 && digits[0] === '1') return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  return raw ?? ''
}

const SERVICE_LABELS: Record<string, string> = {
  mow_only:      'Mow Only',
  mow_trim_blow: 'Mow, Trim & Blow',
  trim_cleanup:  'Trim & Cleanup',
  full_service:  'Full Service',
}

function deriveServiceLabel(
  servicePackage: string | null | undefined,
  prop: Record<string, unknown> | null | undefined
): string {
  if (prop) {
    const parts: string[] = []
    if (prop.default_mowing_enabled)      parts.push('Mowing')
    if (prop.default_weed_eating_enabled) parts.push('Weed Eating')
    if (prop.default_edging_enabled)      parts.push('Edging')
    if (prop.default_blow_off_enabled)    parts.push('Blow Off')
    if (parts.length > 0) return parts.join(', ')
  }
  if (!servicePackage) return ''
  return SERVICE_LABELS[servicePackage] ?? servicePackage.replace(/_/g, ' ')
}

export async function DataExportSection() {
  const supabase = await createClient()
  const { businessId } = await requireBusinessContext()

  const [customersRes, propertiesRes, jobsRes] = await Promise.all([
    supabase
      .from('customers')
      .select('id, first_name, last_name, phone, email, status, notes, created_at')
      .eq('business_id', businessId),
    supabase
      .from('properties')
      .select('id, customer_id, property_name, service_address, city, state, postal_code, parcel_acres, estimated_mowable_acres, service_frequency, default_price, latitude, longitude, status, created_at, default_mowing_enabled, default_weed_eating_enabled, default_edging_enabled, default_blow_off_enabled')
      .eq('business_id', businessId),
    supabase
      .from('jobs')
      .select('id, customer_id, property_id, status, payment_status, scheduled_date, completed_at, price, amount_paid, actual_minutes, service_package, title, created_at')
      .eq('business_id', businessId),
  ])

  // Build lookup maps from already-fetched data — no extra queries needed.
  const customerMap = new Map<string, string>(
    (customersRes.data ?? []).map((c) => [
      c.id as string,
      [c.first_name, c.last_name].filter(Boolean).join(' '),
    ])
  )

  const propertyMap = new Map<string, Record<string, unknown>>(
    (propertiesRes.data ?? []).map((p) => [p.id as string, p as Record<string, unknown>])
  )

  // Transform rows server-side before passing to the dumb CSV button.
  const customerRows = (customersRes.data ?? []).map((c) => ({
    ...(c as Record<string, unknown>),
    phone: formatPhone(c.phone as string | null),
  }))

  const propertyRows = (propertiesRes.data ?? []).map((p) => ({
    ...(p as Record<string, unknown>),
    customer_name: customerMap.get(p.customer_id as string) ?? '',
  }))

  const jobRows = (jobsRes.data ?? []).map((j) => ({
    ...(j as Record<string, unknown>),
    customer_name: customerMap.get(j.customer_id as string) ?? '',
    services: deriveServiceLabel(
      j.service_package as string | null,
      propertyMap.get(j.property_id as string) ?? null
    ),
  }))

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <div className="section-heading" style={{ marginBottom: '0.5rem' }}>Export Data</div>
      <p className="text-small text-muted" style={{ marginBottom: '0.75rem' }}>
        Download a CSV backup of your data. Open in Excel, Google Sheets, or import to another system.
      </p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <CsvExportButton
          rows={customerRows}
          columns={['id', 'first_name', 'last_name', 'phone', 'email', 'status', 'notes', 'created_at']}
          label="Customers"
          filename={`yardops-customers-${today}.csv`}
        />
        <CsvExportButton
          rows={propertyRows}
          columns={['id', 'customer_id', 'customer_name', 'property_name', 'service_address', 'city', 'state', 'postal_code', 'parcel_acres', 'estimated_mowable_acres', 'service_frequency', 'default_price', 'latitude', 'longitude', 'status', 'created_at']}
          label="Properties"
          filename={`yardops-properties-${today}.csv`}
        />
        <CsvExportButton
          rows={jobRows}
          columns={['id', 'customer_id', 'customer_name', 'property_id', 'status', 'payment_status', 'scheduled_date', 'completed_at', 'price', 'amount_paid', 'actual_minutes', 'services', 'service_package', 'title', 'created_at']}
          label="Jobs"
          filename={`yardops-jobs-${today}.csv`}
        />
      </div>
    </div>
  )
}

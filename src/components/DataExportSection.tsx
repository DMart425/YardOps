import { createClient } from '@/lib/supabase/server'
import CsvExportButton from '@/components/CsvExportButton'

export async function DataExportSection() {
  const supabase = await createClient()

  const [customersRes, propertiesRes, jobsRes] = await Promise.all([
    supabase
      .from('customers')
      .select('id, first_name, last_name, phone, email, status, notes, created_at'),
    supabase
      .from('properties')
      .select('id, customer_id, property_name, service_address, city, state, postal_code, parcel_acres, estimated_mowable_acres, service_frequency, default_price, latitude, longitude, status, created_at'),
    supabase
      .from('jobs')
      .select('id, customer_id, property_id, status, payment_status, scheduled_date, completed_at, price, amount_paid, actual_minutes, service_package, title, created_at'),
  ])

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <div className="section-heading" style={{ marginBottom: '0.5rem' }}>Export Data</div>
      <p className="text-small text-muted" style={{ marginBottom: '0.75rem' }}>
        Download a CSV backup of your data. Open in Excel, Google Sheets, or import to another system.
      </p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <CsvExportButton
          rows={(customersRes.data ?? []) as Record<string, unknown>[]}
          columns={['id', 'first_name', 'last_name', 'phone', 'email', 'status', 'notes', 'created_at']}
          label="Customers"
          filename={`yardops-customers-${today}.csv`}
        />
        <CsvExportButton
          rows={(propertiesRes.data ?? []) as Record<string, unknown>[]}
          columns={['id', 'customer_id', 'property_name', 'service_address', 'city', 'state', 'postal_code', 'parcel_acres', 'estimated_mowable_acres', 'service_frequency', 'default_price', 'latitude', 'longitude', 'status', 'created_at']}
          label="Properties"
          filename={`yardops-properties-${today}.csv`}
        />
        <CsvExportButton
          rows={(jobsRes.data ?? []) as Record<string, unknown>[]}
          columns={['id', 'customer_id', 'property_id', 'status', 'payment_status', 'scheduled_date', 'completed_at', 'price', 'amount_paid', 'actual_minutes', 'service_package', 'title', 'created_at']}
          label="Jobs"
          filename={`yardops-jobs-${today}.csv`}
        />
      </div>
    </div>
  )
}

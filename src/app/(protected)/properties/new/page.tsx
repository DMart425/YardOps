import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PropertyForm } from '@/components/forms/PropertyForm'
import { createProperty } from '../actions'

export default async function NewPropertyPage({
  searchParams,
}: {
  searchParams: Promise<{ customer_id?: string }>
}) {
  const { customer_id } = await searchParams

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

  const { data: customers } = await supabase
    .from('customers')
    .select('id, first_name, last_name, status')
    .neq('status', 'archived')
    .order('first_name')

  return (
    <div className="page">
      <Link href={`/customers/${customer_id}`} className="back-link">
        ← Customer
      </Link>
      <div className="page-header">
        <h1 className="page-title">Add Property</h1>
      </div>

      <div className="card">
        <PropertyForm
          action={createProperty}
          submitLabel="Add Property"
          cancelHref={`/customers/${customer_id}`}
          customers={customers ?? []}
          defaultCustomerId={customer_id}
        />
      </div>
    </div>
  )
}

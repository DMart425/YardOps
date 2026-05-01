import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter = 'all' } = await searchParams
  const supabase = await createClient()

  const query = supabase
    .from('properties')
    .select(`
      id, property_name, service_address, city, service_frequency, status,
      customers ( id, first_name, last_name, status )
    `)
    .order('service_address', { ascending: true })

  const { data: properties } = await query

  // Client-side filter by customer status
  const filtered = (properties ?? []).filter((p) => {
    const cust = (Array.isArray(p.customers) ? p.customers[0] : p.customers) as { status: string } | null
    if (filter === 'leads')  return cust?.status === 'lead'
    if (filter === 'active') return cust?.status === 'active' || cust?.status === 'inactive'
    return true
  })

  const tabs = [
    { key: 'all',    label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'leads',  label: 'Leads' },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Properties</h1>
          <p className="page-subtitle">{filtered.length} shown</p>
        </div>
        <Link href="/properties/new" className="btn btn-primary btn-sm">+ Add</Link>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/properties?filter=${t.key}`}
            className="btn btn-sm"
            style={{
              background: filter === t.key ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
              color: filter === t.key ? '#fff' : 'var(--color-text)',
              border: '1px solid',
              borderColor: filter === t.key ? 'var(--color-primary)' : 'var(--color-border)',
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {!filtered.length ? (
        <div className="empty-state">
          <p style={{ fontSize: '2rem' }}>🏡</p>
          <p style={{ fontWeight: 600, marginTop: '8px' }}>No properties here</p>
          {filter === 'leads'  && <p>No lead properties yet.</p>}
          {filter === 'active' && <p>No active customer properties yet.</p>}
          {filter === 'all'    && <Link href="/properties/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>Add Property</Link>}
        </div>
      ) : (
        filtered.map((p) => {
          const customer = (Array.isArray(p.customers) ? p.customers[0] : p.customers) as { id: string; first_name: string; last_name: string | null; status: string } | null
          return (
            <Link key={p.id} href={`/properties/${p.id}`} style={{ display: 'block' }}>
              <div className="card">
                <div className="card-row">
                  <div>
                    <div className="card-title">{p.property_name ?? p.service_address}</div>
                    {p.property_name && (
                      <div className="card-meta">{p.service_address}{p.city ? `, ${p.city}` : ''}</div>
                    )}
                    {customer && (
                      <div className="card-meta">
                        {customer.first_name}{customer.last_name ? ` ${customer.last_name}` : ''}
                      </div>
                    )}
                    <div className="card-meta">{p.service_frequency?.replace('_', ' ')}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    {customer?.status === 'lead'
                      ? <span className="pill pill-lead">Lead</span>
                      : <span className={`pill pill-${p.status}`}>{p.status}</span>
                    }
                  </div>
                </div>
              </div>
            </Link>
          )
        })
      )}
    </div>
  )
}

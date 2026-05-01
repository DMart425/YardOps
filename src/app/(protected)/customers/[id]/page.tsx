import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Customer, Property } from '@/types/database'
import { CustomerEditForm } from './_form'

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: customer }, { data: properties }] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).single(),
    supabase
      .from('properties')
      .select('id, property_name, service_address, city, service_frequency, status')
      .eq('customer_id', id)
      .order('service_address'),
  ])

  if (!customer) notFound()

  return (
    <div className="page">
      <Link href="/customers" className="back-link">← Customers</Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">
            {customer.first_name}{customer.last_name ? ` ${customer.last_name}` : ''}
          </h1>
          <span className={`pill pill-${customer.status}`}>{customer.status}</span>
        </div>
      </div>

      {/* Contact quick info */}
      {(customer.phone || customer.email) && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          {customer.phone && (
            <a href={`tel:${customer.phone}`} className="contact-row">
              📞 {customer.phone}
            </a>
          )}
          {customer.email && (
            <a href={`mailto:${customer.email}`} className="contact-row">
              ✉ {customer.email}
            </a>
          )}
          {customer.preferred_contact_method && (
            <div className="contact-row text-muted">
              Prefers: {customer.preferred_contact_method.replace('_', ' ')}
            </div>
          )}
        </div>
      )}

      {/* Properties */}
      <div className="detail-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div className="section-heading" style={{ marginBottom: 0 }}>
            Properties ({properties?.length ?? 0})
          </div>
          <Link href={`/properties/new?customer_id=${id}`} className="btn btn-sm btn-secondary">
            + Add Property
          </Link>
        </div>

        {!properties?.length ? (
          <div className="card">
            <p className="text-muted text-small">No properties yet.</p>
          </div>
        ) : (
          (properties as Pick<Property, 'id' | 'property_name' | 'service_address' | 'city' | 'service_frequency' | 'status'>[]).map((p) => (
            <Link key={p.id} href={`/properties/${p.id}`} style={{ display: 'block' }}>
              <div className="card">
                <div className="card-row">
                  <div>
                    <div className="card-title">{p.property_name ?? p.service_address}</div>
                    {p.property_name && <div className="card-meta">{p.service_address}{p.city ? `, ${p.city}` : ''}</div>}
                    <div className="card-meta">{p.service_frequency?.replace('_', ' ')}</div>
                  </div>
                  <span className={`pill pill-${p.status}`}>{p.status}</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Edit form */}
      <div className="detail-section">
        <div className="section-heading">Edit Customer Info</div>
        <div className="card">
          <CustomerEditForm customer={customer as Customer} />
        </div>
      </div>
    </div>
  )
}

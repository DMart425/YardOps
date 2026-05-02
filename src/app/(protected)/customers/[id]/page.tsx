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

  const [{ data: customer }, { data: properties }, { data: jobs }] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).single(),
    supabase
      .from('properties')
      .select('id, property_name, service_address, city, service_frequency, status')
      .eq('customer_id', id)
      .order('service_address'),
    supabase
      .from('jobs')
      .select('id, title, status, payment_status, scheduled_date, completed_at, price, amount_paid')
      .eq('customer_id', id)
      .order('scheduled_date', { ascending: false })
      .limit(10),
  ])

  if (!customer) notFound()

  // Aggregate stats from all jobs (separate count query for accuracy beyond the 10-row limit)
  const { data: allJobs } = await supabase
    .from('jobs')
    .select('status, price, amount_paid, completed_at')
    .eq('customer_id', id)

  const completedJobs = (allJobs ?? []).filter(j => j.status === 'completed')
  const totalRevenue  = completedJobs.reduce((s, j) => s + (j.price ?? 0), 0)
  const totalPaid     = completedJobs.reduce((s, j) => s + (j.amount_paid ?? 0), 0)
  const totalUnpaid   = totalRevenue - totalPaid
  const lastVisit     = completedJobs
    .map(j => j.completed_at)
    .filter((d): d is string => !!d)
    .sort()
    .pop()

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

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

      {/* History stats */}
      {completedJobs.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <div className="stat-value">{completedJobs.length}</div>
            <div className="stat-label">Jobs done</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">${totalRevenue.toFixed(0)}</div>
            <div className="stat-label">Total revenue</div>
          </div>
          {totalUnpaid > 0 && (
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--color-unpaid)' }}>${totalUnpaid.toFixed(0)}</div>
              <div className="stat-label">Unpaid</div>
            </div>
          )}
          {lastVisit && (
            <div className="stat-card">
              <div className="stat-value" style={{ fontSize: '1.1rem' }}>{fmtDate(lastVisit)}</div>
              <div className="stat-label">Last visit</div>
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

      {/* Recent jobs */}
      {jobs && jobs.length > 0 && (
        <div className="detail-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div className="section-heading" style={{ marginBottom: 0 }}>
              Recent Jobs ({jobs.length})
            </div>
            <Link href={`/jobs/new?customer_id=${id}`} className="btn btn-sm btn-secondary">
              + Add Job
            </Link>
          </div>
          {jobs.map((j) => (
            <Link key={j.id} href={`/jobs/${j.id}`} className="card card-link" style={{ display: 'block', marginBottom: '8px' }}>
              <div className="card-row">
                <div style={{ minWidth: 0 }}>
                  <div className="card-title">{j.title}</div>
                  <div className="card-meta">
                    {j.completed_at
                      ? `Completed ${fmtDate(j.completed_at)}`
                      : j.scheduled_date
                        ? `Scheduled ${fmtDate(j.scheduled_date + 'T12:00:00')}`
                        : 'No date'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                  <span className={`pill pill-${j.status}`}>{j.status.replace(/_/g, ' ')}</span>
                  {j.price != null && <span className="font-bold text-small">${j.price}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

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

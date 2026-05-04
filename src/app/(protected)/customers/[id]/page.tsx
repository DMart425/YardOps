import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Customer, Property } from '@/types/database'
import { CustomerEditForm } from './_form'
import { CopyPortalLinkButton } from '@/components/CopyPortalLinkButton'

type CustomerWithTags = Customer & { tags?: string[] | null }

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
  const customerRow = customer as CustomerWithTags

  // Aggregate stats from all jobs (separate count query for accuracy beyond the 10-row limit)
  const { data: allJobs } = await supabase
    .from('jobs')
      .select('status, price, amount_paid, payment_status, completed_at')
    .eq('customer_id', id)

  const completedJobs = (allJobs ?? []).filter(j => j.status === 'completed')
  const totalRevenue  = completedJobs.reduce((s, j) => s + Number(j.price ?? 0), 0)
  const totalUnpaid   = completedJobs
    .filter(j => j.payment_status !== 'paid')
    .reduce((s, j) => {
      const owed = Number(j.price ?? 0) - Number((j.amount_paid || null) ?? 0)
      return s + Math.max(0, owed)
    }, 0)
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
            {customerRow.first_name}{customerRow.last_name ? ` ${customerRow.last_name}` : ''}
          </h1>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
            <span className={`pill pill-${customerRow.status}`}>{customerRow.status}</span>
            {(customerRow.tags ?? []).map((tag: string) => (
              <span key={tag} className="pill pill-draft">{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Contact quick info */}
      {(customerRow.phone || customerRow.email) && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          {customerRow.phone && (
            <a href={`tel:${customerRow.phone}`} className="contact-row">
              📞 {customerRow.phone}
            </a>
          )}
          {customerRow.email && (
            <a href={`mailto:${customerRow.email}`} className="contact-row">
              ✉ {customerRow.email}
            </a>
          )}
          {customerRow.preferred_contact_method && (
            <div className="contact-row text-muted">
              Prefers: {customerRow.preferred_contact_method.replace('_', ' ')}
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
      {/* Portal link */}
      <div className="detail-section">
        <div className="section-heading">Customer Portal</div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>Share with customer</div>
            <div className="text-small text-muted">They can view upcoming jobs, history &amp; balance — no login needed</div>
          </div>
          <CopyPortalLinkButton customerId={customerRow.id} />
        </div>
      </div>

      <div className="detail-section">
        <div className="section-heading">Edit Customer Info</div>
        <div className="card">
          <CustomerEditForm customer={customerRow} />
        </div>
      </div>
    </div>
  )
}

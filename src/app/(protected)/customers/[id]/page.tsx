import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Customer, Property } from '@/types/database'
import { CopyPortalLinkButton } from '@/components/CopyPortalLinkButton'
import { formatDateOnly, formatTimestampDate, getLocalDateStr, resolveTimeZone } from '@/lib/date'
import { CustomerDangerZone } from './CustomerDangerZone'
import { LeadStatusActions } from './LeadStatusActions'
import { CustomerInfoSection } from './CustomerInfoSection'

type CustomerWithTags = Customer & { tags?: string[] | null }

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('time_zone')
    .single()
  const timeZone = resolveTimeZone(settings?.time_zone ?? null)
  const today = getLocalDateStr(timeZone)

  const [{ data: customer }, { data: properties }, { data: jobs }, { data: nextVisitJob }] = await Promise.all([
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
    supabase
      .from('jobs')
      .select('id, scheduled_date, scheduled_time_window')
      .eq('customer_id', id)
      .in('status', ['scheduled', 'in_progress', 'needs_reschedule'])
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
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
  const propertyRows = (properties as Pick<Property, 'id' | 'property_name' | 'service_address' | 'city' | 'service_frequency' | 'status'>[] | null) ?? []
  const activeProperties = propertyRows.filter(p => p.status !== 'archived')
  const archivedProperties = propertyRows.filter(p => p.status === 'archived')
  const mapProperty = activeProperties[0] ?? archivedProperties[0] ?? null
  const mapsAddress = mapProperty
    ? [mapProperty.service_address, mapProperty.city].filter(Boolean).join(', ')
    : null

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
            {customerRow.status !== 'lead' && (customerRow.tags ?? []).map((tag: string) => (
              <span key={tag} className="pill pill-draft">{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {customerRow.status === 'lead' && (
        <div className="detail-section">
          <div className="section-heading">Lead Status</div>
          <div className="card">
            <p className="text-small text-muted" style={{ marginBottom: '10px' }}>
              This contact is currently a lead.
            </p>
            <LeadStatusActions customerId={customerRow.id} />
          </div>
        </div>
      )}

      {/* Contact quick info */}
      {(customerRow.phone || customerRow.email || mapsAddress) && (
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
          {(customerRow.phone || customerRow.email || customerRow.preferred_contact_method) && <div className="divider" />}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {customerRow.phone && (
              <a href={`tel:${customerRow.phone}`} className="btn btn-sm btn-secondary">📞 Call</a>
            )}
            {customerRow.phone && (
              <a href={`sms:${customerRow.phone}`} className="btn btn-sm btn-secondary">💬 Text</a>
            )}
            {customerRow.email && (
              <a href={`mailto:${customerRow.email}`} className="btn btn-sm btn-secondary">✉ Email</a>
            )}
            {mapsAddress && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(mapsAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-secondary"
              >
                📍 Maps
              </a>
            )}
          </div>
        </div>
      )}

      {/* History stats */}
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
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>
            {lastVisit ? formatTimestampDate(lastVisit, timeZone) : 'Not yet'}
          </div>
          <div className="stat-label">Last visit</div>
        </div>
        {nextVisitJob?.id && nextVisitJob.scheduled_date ? (
          <Link href={`/jobs/${nextVisitJob.id}`} className="stat-card" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div className="stat-value" style={{ fontSize: '1.1rem' }}>
              {formatDateOnly(nextVisitJob.scheduled_date)}
            </div>
            <div className="stat-label">
              {nextVisitJob.scheduled_time_window ? `Next visit · ${nextVisitJob.scheduled_time_window}` : 'Next visit'}
            </div>
          </Link>
        ) : (
          <div className="stat-card">
            <div className="stat-value" style={{ fontSize: '1.1rem' }}>Not scheduled</div>
            <div className="stat-label">Next visit</div>
          </div>
        )}
      </div>

      {/* Properties */}
      <div className="detail-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div className="section-heading" style={{ marginBottom: 0 }}>
            Properties ({activeProperties.length})
          </div>
          <Link href={`/properties/new?customer_id=${id}`} className="btn btn-sm btn-secondary">
            + Add Property
          </Link>
        </div>

        {!activeProperties.length ? (
          <div className="card">
            <p className="text-muted text-small">No properties yet.</p>
          </div>
        ) : (
          activeProperties.map((p) => (
            <div key={p.id} className="card">
              <div className="card-row">
                <div>
                  <div className="card-title">{p.property_name ?? p.service_address}</div>
                  {p.property_name && <div className="card-meta">{p.service_address}{p.city ? `, ${p.city}` : ''}</div>}
                  <div className="card-meta">{p.service_frequency?.replace('_', ' ')}</div>
                </div>
                <span className={`pill pill-${p.status}`}>{p.status}</span>
              </div>
              <div className="card-actions">
                <Link href={`/properties/${p.id}`} className="btn btn-sm btn-secondary">Edit Property</Link>
              </div>
            </div>
          ))
        )}

        {archivedProperties.length > 0 && (
          <div style={{ marginTop: '14px' }}>
            <div className="section-heading" style={{ marginBottom: '8px', fontSize: '0.95rem' }}>
              Archived Properties ({archivedProperties.length})
            </div>
            {archivedProperties.map((p) => (
              <div key={p.id} className="card" style={{ opacity: 0.92 }}>
                <div className="card-row">
                  <div>
                    <div className="card-title">{p.property_name ?? p.service_address}</div>
                    {p.property_name && <div className="card-meta">{p.service_address}{p.city ? `, ${p.city}` : ''}</div>}
                    <div className="card-meta">{p.service_frequency?.replace('_', ' ')}</div>
                  </div>
                  <span className={`pill pill-${p.status}`}>{p.status}</span>
                </div>
                <div className="card-actions">
                  <Link href={`/properties/${p.id}`} className="btn btn-sm btn-secondary">Edit Property</Link>
                </div>
              </div>
            ))}
          </div>
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
                      ? `Completed ${formatTimestampDate(j.completed_at, timeZone)}`
                      : j.scheduled_date
                        ? `Scheduled ${formatDateOnly(j.scheduled_date)}`
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

      <CustomerInfoSection customer={customerRow} />

      <CustomerDangerZone customerId={customerRow.id} />
    </div>
  )
}

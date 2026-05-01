import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { JobActions } from '@/components/JobActions'
import type { Job } from '@/types/database'

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: job } = await supabase
    .from('jobs')
    .select(`
      *,
      customers ( first_name, last_name, phone ),
      properties ( service_address, city, state, pet_warning, gate_code, access_notes, obstacle_notes, parking_notes )
    `)
    .eq('id', id)
    .single()

  if (!job) notFound()

  const customer = job.customers as { first_name: string; last_name: string | null; phone: string | null }
  const property = job.properties as {
    service_address: string; city: string | null; state: string | null
    pet_warning: string | null; gate_code: string | null; access_notes: string | null
    obstacle_notes: string | null; parking_notes: string | null
  }

  const customerName = `${customer.first_name}${customer.last_name ? ' ' + customer.last_name : ''}`
  const address      = `${property.service_address}${property.city ? ', ' + property.city : ''}`

  const warnings = [
    property.pet_warning  ? `🐕 ${property.pet_warning}`  : null,
    property.gate_code    ? `🔒 Gate: ${property.gate_code}` : null,
    property.access_notes ? `🚪 ${property.access_notes}` : null,
    property.obstacle_notes ? `⚠ ${property.obstacle_notes}` : null,
    property.parking_notes  ? `🚛 ${property.parking_notes}`  : null,
  ].filter(Boolean) as string[]

  const pkgLabel = job.service_package
    ? job.service_package.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
    : 'Standard Mow'

  return (
    <div className="page">
      <Link href="/jobs" className="back-link">← Jobs</Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">{customerName}</h1>
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
            <span className={`pill pill-${job.status}`}>{job.status.replace(/_/g, ' ')}</span>
            <span className={`pill pill-${job.payment_status}`}>{job.payment_status.replace(/_/g, ' ')}</span>
          </div>
        </div>
        {job.price != null && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="stat-value" style={{ fontSize: '1.5rem' }}>${job.price}</div>
            <div className="text-small text-muted">price</div>
          </div>
        )}
      </div>

      {/* Job info */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="card-row">
            <span className="text-small text-muted">📅 Date</span>
            <span className="text-small">
              {job.scheduled_date ? fmtDate(job.scheduled_date) : 'No date set'}
              {job.scheduled_time_window ? ` · ${job.scheduled_time_window}` : ''}
            </span>
          </div>
          <div className="card-row">
            <span className="text-small text-muted">📍 Address</span>
            <span className="text-small">{address}</span>
          </div>
          <div className="card-row">
            <span className="text-small text-muted">🌿 Package</span>
            <span className="text-small">{pkgLabel}</span>
          </div>
          <div className="card-row">
            <span className="text-small text-muted">🔄 Type</span>
            <span className="text-small">{job.job_type}</span>
          </div>
        </div>

        {customer.phone && (
          <>
            <div className="divider" />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <a href={`tel:${customer.phone}`} className="btn btn-sm btn-secondary">📞 Call</a>
              <a href={`sms:${customer.phone}`} className="btn btn-sm btn-secondary">💬 Text</a>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-secondary"
              >
                📍 Maps
              </a>
            </div>
          </>
        )}
      </div>

      {/* On-site warnings */}
      {warnings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem' }}>
          {warnings.map((w, i) => (
            <div key={i} className="warning-banner">{w}</div>
          ))}
        </div>
      )}

      {/* Completion notes */}
      {job.status === 'completed' && job.completion_notes && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="section-heading">Completion Notes</div>
          <p className="text-small">{job.completion_notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="card">
        <div className="section-heading" style={{ marginBottom: '0.75rem' }}>Actions</div>
        <JobActions job={job as unknown as Job} />
      </div>

      {/* Nav links */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
        <Link href={`/customers/${job.customer_id}`} className="btn btn-sm btn-secondary">Customer</Link>
        <Link href={`/properties/${job.property_id}`} className="btn btn-sm btn-secondary">Property</Link>
      </div>
    </div>
  )
}

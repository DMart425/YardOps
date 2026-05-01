import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function getTodayLocal() {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD
}

function formatDisplayDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

export default async function TodayPage() {
  const supabase = await createClient()
  const today = getTodayLocal()

  // Fetch today's jobs with customer and property info
  const { data: todayJobs } = await supabase
    .from('jobs')
    .select(`
      id, title, service_package, price, payment_status, status, scheduled_date,
      customers ( first_name, last_name, phone ),
      properties ( service_address, city, pet_warning, gate_code, access_notes, obstacle_notes )
    `)
    .eq('scheduled_date', today)
    .not('status', 'in', '("completed","cancelled","skipped")')
    .order('scheduled_date')

  // Overdue jobs
  const { data: overdueJobs } = await supabase
    .from('jobs')
    .select(`
      id, title, scheduled_date, price, status,
      customers ( first_name, last_name ),
      properties ( service_address, city )
    `)
    .lt('scheduled_date', today)
    .in('status', ['scheduled', 'in_progress', 'needs_reschedule'])
    .order('scheduled_date', { ascending: true })
    .limit(10)

  // Unpaid completed jobs
  const { data: unpaidJobs } = await supabase
    .from('jobs')
    .select(`
      id, title, price, amount_paid, payment_status, completed_at,
      customers ( first_name, last_name, phone )
    `)
    .eq('status', 'completed')
    .eq('payment_status', 'unpaid')
    .order('completed_at', { ascending: false })
    .limit(10)

  const todayTotal = (todayJobs ?? []).reduce((s, j) => s + (j.price ?? 0), 0)
  const unpaidTotal = (unpaidJobs ?? []).reduce((s, j) => s + ((j.price ?? 0) - (j.amount_paid ?? 0)), 0)

  // New leads count (website + manual)
  const [{ count: websiteLeadsCount }, { count: manualLeadsCount }] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('status', 'lead'),
  ])
  const newLeadsCount = (websiteLeadsCount ?? 0) + (manualLeadsCount ?? 0)

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Today</h1>
          <p className="page-subtitle">{formatDisplayDate(today)}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-value">{todayJobs?.length ?? 0}</div>
          <div className="stat-label">Jobs today</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${todayTotal.toFixed(0)}</div>
          <div className="stat-label">Expected today</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: (newLeadsCount > 0) ? 'var(--color-lead)' : undefined }}>
            {newLeadsCount}
          </div>
          <div className="stat-label">New leads</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: overdueJobs?.length ? 'var(--color-overdue)' : undefined }}>
            {overdueJobs?.length ?? 0}
          </div>
          <div className="stat-label">Overdue</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: unpaidTotal > 0 ? 'var(--color-unpaid)' : undefined }}>
            ${unpaidTotal.toFixed(0)}
          </div>
          <div className="stat-label">Unpaid balance</div>
        </div>
      </div>

      {/* Today's Jobs */}
      <div className="detail-section">
        <div className="section-heading">Today&apos;s Jobs ({todayJobs?.length ?? 0})</div>
        {!todayJobs?.length ? (
          <div className="card">
            <p className="text-muted text-small">No jobs scheduled for today.</p>
            <div style={{ marginTop: '12px' }}>
              <Link href="/jobs/new" className="btn btn-sm btn-secondary">Schedule a job</Link>
            </div>
          </div>
        ) : (
          todayJobs.map((job) => {
            const customer = job.customers as { first_name: string; last_name: string | null; phone: string | null } | null
            const property = job.properties as { service_address: string; city: string | null; pet_warning: string | null; gate_code: string | null; access_notes: string | null; obstacle_notes: string | null } | null
            const warnings = [property?.pet_warning, property?.gate_code ? `Gate: ${property.gate_code}` : null, property?.access_notes, property?.obstacle_notes].filter(Boolean)

            return (
              <div key={job.id} className="card">
                <div className="card-row">
                  <div>
                    <div className="card-title">{customer?.first_name} {customer?.last_name}</div>
                    <div className="card-subtitle">{property?.service_address}{property?.city ? `, ${property.city}` : ''}</div>
                    {job.service_package && <div className="card-meta">{job.service_package.replace(/_/g, ' ')}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {job.price != null && <div style={{ fontWeight: 700, fontSize: '1.0625rem' }}>${job.price}</div>}
                    <span className={`pill pill-${job.payment_status}`}>{job.payment_status}</span>
                  </div>
                </div>

                {warnings.length > 0 && (
                  <div className="property-warnings">
                    {warnings.map((w, i) => (
                      <div key={i} className="warning-banner">⚠ {w}</div>
                    ))}
                  </div>
                )}

                <div className="card-actions">
                  {property?.service_address && (
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent([property.service_address, property.city].filter(Boolean).join(', '))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-secondary"
                    >
                      Open Maps
                    </a>
                  )}
                  {customer?.phone && (
                    <a
                      href={`sms:${customer.phone}?body=${encodeURIComponent(`Hey ${customer.first_name}, I'm on my way to service your lawn now.`)}`}
                      className="btn btn-sm btn-secondary"
                    >
                      On My Way
                    </a>
                  )}
                  <Link href={`/jobs/${job.id}`} className="btn btn-sm btn-primary">
                    View Job
                  </Link>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Overdue */}
      {(overdueJobs?.length ?? 0) > 0 && (
        <div className="detail-section">
          <div className="section-heading" style={{ color: 'var(--color-overdue)' }}>
            Overdue ({overdueJobs!.length})
          </div>
          {overdueJobs!.map((job) => {
            const customer = job.customers as { first_name: string; last_name: string | null } | null
            const property = job.properties as { service_address: string; city: string | null } | null
            const daysLate = Math.floor((Date.now() - new Date(job.scheduled_date + 'T00:00:00').getTime()) / 86400000)
            return (
              <Link key={job.id} href={`/jobs/${job.id}`} style={{ display: 'block' }}>
                <div className="card">
                  <div className="card-row">
                    <div>
                      <div className="card-title">{customer?.first_name} {customer?.last_name}</div>
                      <div className="card-meta">{property?.service_address}</div>
                      <div className="card-meta" style={{ color: 'var(--color-overdue)' }}>
                        {daysLate} day{daysLate !== 1 ? 's' : ''} overdue
                      </div>
                    </div>
                    <span className="pill pill-overdue">Overdue</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Unpaid */}
      {(unpaidJobs?.length ?? 0) > 0 && (
        <div className="detail-section">
          <div className="section-heading" style={{ color: 'var(--color-unpaid)' }}>
            Unpaid ({unpaidJobs!.length}) — ${unpaidTotal.toFixed(0)} owed
          </div>
          {unpaidJobs!.map((job) => {
            const customer = job.customers as { first_name: string; last_name: string | null; phone: string | null } | null
            const balance = (job.price ?? 0) - (job.amount_paid ?? 0)
            return (
              <div key={job.id} className="card">
                <div className="card-row">
                  <div>
                    <div className="card-title">{customer?.first_name} {customer?.last_name}</div>
                    <div className="card-meta">{job.title}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--color-unpaid)' }}>${balance.toFixed(0)}</div>
                    <span className="pill pill-unpaid">Unpaid</span>
                  </div>
                </div>
                <div className="card-actions">
                  {customer?.phone && (
                    <a
                      href={`sms:${customer.phone}?body=${encodeURIComponent(`Hey ${customer.first_name}, just a quick reminder that your lawn service balance of $${balance.toFixed(0)} is still open. Thanks`)}`}
                      className="btn btn-sm btn-secondary"
                    >
                      Send Reminder
                    </a>
                  )}
                  <Link href={`/jobs/${job.id}`} className="btn btn-sm btn-primary">Mark Paid</Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

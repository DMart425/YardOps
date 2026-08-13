import Link from 'next/link'
import { formatDateOnly } from '@/lib/date'
import { dateOnlyToUtcMs, statusLabel } from './shared'

interface OverdueJob {
  id: string
  title: string | null
  scheduled_date: string | null
  price: number | null
  status: string | null
  customers: unknown
  properties: unknown
}

export function OverdueSection({
  jobs,
  displayCount,
  todayStartMs,
  today,
}: {
  jobs: OverdueJob[]
  displayCount: string
  todayStartMs: number
  today: string
}) {
  if (jobs.length === 0) return null
  return (
    <div className="detail-section" id="overdue-section">
      <div className="section-heading" style={{ color: 'var(--color-overdue)' }}>
        Overdue ({displayCount})
      </div>
      {jobs.map((job) => {
        const customer = (Array.isArray(job.customers) ? job.customers[0] : job.customers) as { first_name: string; last_name: string | null } | null
        const property = (Array.isArray(job.properties) ? job.properties[0] : job.properties) as { service_address: string; city: string | null } | null
        const daysLate = Math.floor((todayStartMs - dateOnlyToUtcMs(job.scheduled_date ?? today)) / 86400000)
        return (
          <Link key={job.id} href={`/jobs/${job.id}`} style={{ display: 'block' }}>
            <div className="card">
              <div className="card-row">
                <div>
                  <div className="card-title">{job.title}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                    <div className="card-meta">👤 {customer?.first_name} {customer?.last_name}</div>
                    <div className="card-meta">📍 {property?.service_address}{property?.city ? `, ${property.city}` : ''}</div>
                    {job.scheduled_date && <div className="card-meta">🗓 {formatDateOnly(job.scheduled_date, { weekday: 'short', month: 'short', day: 'numeric' })}</div>}
                    {job.price != null && <div className="card-meta">💵 ${Number(job.price).toFixed(0)}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                  <span className={`pill pill-${job.status}`}>{statusLabel(job.status)}</span>
                  <span className="pill pill-overdue">{daysLate}d late</span>
                </div>
              </div>
            </div>
          </Link>
        )
      })}
      {jobs.length === 10 && (
        <p className="text-small text-muted" style={{ marginTop: '8px', paddingLeft: '2px' }}>
          Showing first 10.{' '}
          <Link href="/jobs?view=scheduled&filter=overdue">Open Jobs</Link> to see the full list.
        </p>
      )}
    </div>
  )
}

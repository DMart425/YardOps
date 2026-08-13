import Link from 'next/link'
import { formatTimestampDate, getLocalDateStr } from '@/lib/date'
import { formatFrequencyLabel } from '@/lib/frequency'
import { dateOnlyToUtcMs } from './shared'

interface FollowUpJob {
  id: string
  title: string | null
  completed_at: string | null
  customers: unknown
  properties: unknown
}

export function NeedsFollowUpSection({
  jobs,
  todayStartMs,
  timeZone,
}: {
  jobs: FollowUpJob[]
  todayStartMs: number
  timeZone: string
}) {
  if (jobs.length === 0) return null
  return (
    <div className="detail-section">
      <div className="section-heading">
        Needs Follow-up ({jobs.length})
      </div>
      <p className="text-small text-muted" style={{ marginBottom: '8px' }}>
        Recurring jobs completed without a next visit scheduled.
      </p>
      {jobs.map((job) => {
        const customer = (Array.isArray(job.customers) ? job.customers[0] : job.customers) as { first_name: string; last_name: string | null } | null
        const prop = (Array.isArray(job.properties) ? job.properties[0] : job.properties) as { service_address: string | null; city: string | null; service_frequency: string | null } | null
        const daysSince = job.completed_at
          ? Math.max(0, Math.floor((todayStartMs - dateOnlyToUtcMs(getLocalDateStr(timeZone, new Date(job.completed_at)))) / 86400000))
          : null
        return (
          <div key={job.id} className="card">
            <div className="card-row">
              <div>
                <div className="card-title">{job.title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                  <div className="card-meta">👤 {customer?.first_name} {customer?.last_name}</div>
                  {prop?.service_address && (
                    <div className="card-meta">📍 {prop.service_address}{prop.city ? `, ${prop.city}` : ''}</div>
                  )}
                  {job.completed_at && (
                    <div className="card-meta">
                      ✅ Completed {formatTimestampDate(job.completed_at, timeZone, { month: 'short', day: 'numeric' })}
                      {daysSince !== null && <span className="text-muted"> · {daysSince === 0 ? 'today' : `${daysSince}d ago`}</span>}
                    </div>
                  )}
                  {prop?.service_frequency && (
                    <div className="card-meta">🔁 {formatFrequencyLabel(prop.service_frequency)}</div>
                  )}
                </div>
              </div>
            </div>
            <div className="card-actions">
              <Link href={`/jobs/${job.id}`} className="btn btn-sm btn-primary">
                Schedule Follow-up
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}

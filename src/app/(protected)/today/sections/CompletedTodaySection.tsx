import Link from 'next/link'
import { formatTimestampDate } from '@/lib/date'
import { calcJobBalance } from '@/lib/money'
import { statusLabel } from './shared'

interface CompletedTodayJob {
  id: string
  title: string | null
  price: number | null
  amount_paid: number | null
  payment_status: string | null
  completed_at: string | null
  customers: unknown
  properties: unknown
}

export function CompletedTodaySection({ jobs, timeZone }: { jobs: CompletedTodayJob[]; timeZone: string }) {
  if (jobs.length === 0) return null
  return (
    <div className="detail-section" id="completed-today">
      <div className="section-heading" style={{ color: 'var(--color-primary)' }}>
        Completed Today ({jobs.length})
      </div>
      {jobs.map((job) => {
        const customer = (Array.isArray(job.customers) ? job.customers[0] : job.customers) as { first_name: string; last_name: string | null } | null
        const property = (Array.isArray(job.properties) ? job.properties[0] : job.properties) as { service_address: string; city: string | null } | null
        const balance = calcJobBalance(job)
        return (
          <Link key={job.id} href={`/jobs/${job.id}`} style={{ display: 'block' }}>
            <div className="card">
              <div className="card-row">
                <div>
                  <div className="card-title">{job.title}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                    <div className="card-meta">👤 {customer?.first_name} {customer?.last_name}</div>
                    <div className="card-meta">📍 {property?.service_address}{property?.city ? `, ${property.city}` : ''}</div>
                    {job.completed_at && <div className="card-meta">✅ {formatTimestampDate(job.completed_at, timeZone, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {job.price != null && <div style={{ fontWeight: 700 }}>${Number(job.price).toFixed(0)}</div>}
                  <span className={`pill pill-${job.payment_status}`}>{statusLabel(job.payment_status)}</span>
                  {balance != null && balance > 0 && job.payment_status !== 'not_billable' && <div className="text-small" style={{ color: 'var(--color-unpaid)', marginTop: '4px' }}>${balance.toFixed(0)} owed</div>}
                </div>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

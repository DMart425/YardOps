import Link from 'next/link'
import { formatTimestampDate } from '@/lib/date'
import { calcJobBalance } from '@/lib/money'
import type { SmsMode } from '@/lib/sms'
import { buildBalanceNudgeSms } from '@/lib/smsTemplates'
import { SmsLink } from '@/components/SmsLink'
import { statusLabel } from './shared'

interface UnpaidJob {
  id: string
  title: string | null
  price: number | null
  amount_paid: number | null
  payment_status: string | null
  completed_at: string | null
  customers: unknown
}

export function UnpaidSection({
  jobs,
  displayCount,
  unpaidTotal,
  timeZone,
  smsMode,
}: {
  jobs: UnpaidJob[]
  displayCount: string
  unpaidTotal: number
  timeZone: string
  smsMode: SmsMode
}) {
  if (jobs.length === 0) return null
  return (
    <div className="detail-section">
      <div className="section-heading" style={{ color: 'var(--color-unpaid)' }}>
        Unpaid ({displayCount}) — ${unpaidTotal.toFixed(0)} owed
      </div>
      {jobs.map((job) => {
        const customer = (Array.isArray(job.customers) ? job.customers[0] : job.customers) as { first_name: string; last_name: string | null; phone: string | null } | null
        const balance = calcJobBalance(job)
        return (
          <div key={job.id} className="card">
            <div className="card-row">
              <div>
                <div className="card-title">{job.title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                  <div className="card-meta">👤 {customer?.first_name} {customer?.last_name}</div>
                  <div className="card-meta">💵 {balance != null ? `$${balance.toFixed(0)} due` : 'No price set'}</div>
                  {job.completed_at && <div className="card-meta">🗓 {formatTimestampDate(job.completed_at, timeZone, { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span className={`pill pill-${job.payment_status}`}>{statusLabel(job.payment_status)}</span>
              </div>
            </div>
            <div className="card-actions">
              {customer?.phone && balance != null && (
                <SmsLink
                  phone={customer.phone}
                  body={buildBalanceNudgeSms(customer.first_name, balance)}
                  mode={smsMode}
                  className="btn btn-sm btn-secondary"
                >
                  Send Reminder
                </SmsLink>
              )}
              <Link href={`/jobs/${job.id}`} className="btn btn-sm btn-primary">View &amp; Pay</Link>
            </div>
          </div>
        )
      })}
      {jobs.length === 10 && (
        <p className="text-small text-muted" style={{ marginTop: '8px', paddingLeft: '2px' }}>
          Showing first 10.{' '}
          <Link href="/jobs?view=completed&filter=unpaid&page=1">Open Jobs</Link> to see the full list.
        </p>
      )}
    </div>
  )
}

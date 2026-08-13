import Link from 'next/link'
import { formatTimestampDate } from '@/lib/date'

interface ApprovedEstimate {
  id: string
  total: number | null
  created_at: string | null
  customers: unknown
  properties: unknown
}

export function ApprovedEstimatesSection({ estimates, timeZone }: { estimates: ApprovedEstimate[]; timeZone: string }) {
  if (estimates.length === 0) return null
  return (
    <div className="detail-section">
      <div className="section-heading">
        Approved Estimates Waiting ({estimates.length})
      </div>
      <p className="text-small text-muted" style={{ marginBottom: '8px' }}>
        Customer-approved estimates ready to convert to a job.
      </p>
      {estimates.map((est) => {
        const customer = (Array.isArray(est.customers) ? est.customers[0] : est.customers) as { first_name: string; last_name: string | null } | null
        const prop = (Array.isArray(est.properties) ? est.properties[0] : est.properties) as { service_address: string | null; city: string | null } | null
        return (
          <div key={est.id} className="card">
            <div className="card-row">
              <div>
                <div className="card-title">
                  {customer?.first_name} {customer?.last_name}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                  {prop?.service_address && (
                    <div className="card-meta">📍 {prop.service_address}{prop.city ? `, ${prop.city}` : ''}</div>
                  )}
                  {est.total != null && (
                    <div className="card-meta">💵 ${Number(est.total).toFixed(0)} estimate</div>
                  )}
                  {est.created_at && (
                    <div className="card-meta">🗓 Created {formatTimestampDate(est.created_at, timeZone, { month: 'short', day: 'numeric' })}</div>
                  )}
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <span className="pill pill-approved">Approved</span>
              </div>
            </div>
            <div className="card-actions">
              <Link href={`/estimates/${est.id}`} className="btn btn-sm btn-primary">
                Schedule Job
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}

import Link from 'next/link'
import type { SmsMode } from '@/lib/sms'
import { buildEstimateVisitReminderSms } from '@/lib/smsTemplates'
import { SmsLink } from '@/components/SmsLink'

interface EstimateVisit {
  id: string
  visit_scheduled_time: string | null
  total: number | null
  customers: unknown
  properties: unknown
}

export function EstimateVisitsSection({ visits, smsMode }: { visits: EstimateVisit[]; smsMode: SmsMode }) {
  if (visits.length === 0) return null
  return (
    <div className="detail-section">
      <div className="section-heading">Estimate Visits ({visits.length})</div>
      {visits.map((visit) => {
        const customer = (Array.isArray(visit.customers) ? visit.customers[0] : visit.customers) as { first_name: string; last_name: string | null; phone: string | null } | null
        const property = (Array.isArray(visit.properties) ? visit.properties[0] : visit.properties) as { service_address: string; city: string | null } | null
        return (
          <div key={visit.id} className="card">
            <div className="card-row">
              <div>
                <div className="card-title">{customer?.first_name} {customer?.last_name}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                  <div className="card-meta">📍 {property?.service_address}{property?.city ? `, ${property.city}` : ''}</div>
                  {visit.visit_scheduled_time && <div className="card-meta">🕐 {visit.visit_scheduled_time}</div>}
                  {visit.total != null && <div className="card-meta">💵 ~${Number(visit.total).toFixed(0)}</div>}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span className="pill pill-draft">Estimate Visit</span>
              </div>
            </div>
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
                <SmsLink
                  phone={customer.phone}
                  body={buildEstimateVisitReminderSms(customer?.first_name)}
                  mode={smsMode}
                  className="btn btn-sm btn-secondary"
                >
                  📱 Remind
                </SmsLink>
              )}
              <Link href={`/estimates/${visit.id}`} className="btn btn-sm btn-primary">View Estimate</Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}

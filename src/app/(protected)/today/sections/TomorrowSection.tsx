import { formatDateOnly } from '@/lib/date'
import type { SmsMode } from '@/lib/sms'
import { buildTomorrowReminderSms } from '@/lib/smsTemplates'
import { SmsLink } from '@/components/SmsLink'
import { deriveServiceLabel } from './shared'

interface TomorrowJob {
  id: string
  title: string | null
  service_package: string | null
  price: number | null
  scheduled_time_window: string | null
  customers: unknown
  properties: unknown
}

export function TomorrowSection({
  jobs,
  tomorrowStr,
  smsMode,
}: {
  jobs: TomorrowJob[]
  tomorrowStr: string
  smsMode: SmsMode
}) {
  if (jobs.length === 0) return null
  return (
    <div className="detail-section">
      <div className="section-heading">Tomorrow ({jobs.length})</div>
      {jobs.map((job) => {
        const customer = (Array.isArray(job.customers) ? job.customers[0] : job.customers) as { first_name: string; last_name: string | null; phone: string | null } | null
        const property = (Array.isArray(job.properties) ? job.properties[0] : job.properties) as { service_address: string; city: string | null; default_mowing_enabled: boolean | null; default_weed_eating_enabled: boolean | null; default_edging_enabled: boolean | null; default_blow_off_enabled: boolean | null } | null
        const svcLabel = deriveServiceLabel(job.service_package, property)
        const smsBody = buildTomorrowReminderSms(customer?.first_name, svcLabel, formatDateOnly(tomorrowStr, { weekday: 'long', month: 'long', day: 'numeric' }))
        return (
          <div key={job.id} className="card">
            <div className="card-row">
              <div style={{ flex: 1 }}>
                <div className="card-title">{job.title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                  <div className="card-meta">👤 {customer?.first_name} {customer?.last_name}</div>
                  <div className="card-meta">📍 {property?.service_address}{property?.city ? `, ${property.city}` : ''}</div>
                  <div className="card-meta">🗓 {formatDateOnly(tomorrowStr, { weekday: 'short', month: 'short', day: 'numeric' })}{job.scheduled_time_window ? ` · ${job.scheduled_time_window}` : ''}</div>
                  <div className="card-meta">🌿 {svcLabel}</div>
                  {job.price != null && <div className="card-meta">💵 ${Number(job.price).toFixed(0)}</div>}
                </div>
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
                <SmsLink phone={customer.phone} body={smsBody} mode={smsMode} className="btn btn-sm btn-secondary">
                  📱 Send Reminder
                </SmsLink>
              )}
              <a
                href={`/jobs/${job.id}`}
                className="btn btn-sm btn-primary"
              >
                View Job
              </a>
            </div>
          </div>
        )
      })}
    </div>
  )
}

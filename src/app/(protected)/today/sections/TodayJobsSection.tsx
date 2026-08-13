import Link from 'next/link'
import { coordKey, type DayForecast } from '@/lib/weather'
import type { SmsMode } from '@/lib/sms'
import { buildOnMyWaySms } from '@/lib/smsTemplates'
import { SmsLink } from '@/components/SmsLink'
import { deriveServiceLabel, statusLabel } from './shared'

interface TodayJob {
  id: string
  title: string | null
  service_package: string | null
  price: number | null
  status: string | null
  scheduled_time_window: string | null
  customers: unknown
  properties: unknown
}

export function TodayJobsSection({
  jobs,
  routeUrl,
  jobCoordMap,
  weatherMap,
  smsMode,
}: {
  jobs: TodayJob[]
  routeUrl: string | null
  jobCoordMap: Map<string, { lat: number; lon: number }>
  weatherMap: Map<string, DayForecast>
  smsMode: SmsMode
}) {
  return (
    <div className="detail-section">
      <div className="card-row" style={{ marginBottom: '8px' }}>
        <div className="section-heading" style={{ marginBottom: 0 }}>Today&apos;s Jobs ({jobs.length})</div>
        {routeUrl && jobs.length > 0 && (
          <a href={routeUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary">
            🗺 Route
          </a>
        )}
      </div>
      {!jobs.length ? (
        <div className="card">
          <p className="text-muted text-small">No jobs scheduled for today.</p>
          <div style={{ marginTop: '12px' }}>
            <Link href="/jobs/new" className="btn btn-sm btn-secondary">Schedule a job</Link>
          </div>
        </div>
      ) : (
        jobs.map((job) => {
          const customer = (Array.isArray(job.customers) ? job.customers[0] : job.customers) as { first_name: string; last_name: string | null; phone: string | null } | null
          const property = (Array.isArray(job.properties) ? job.properties[0] : job.properties) as { service_address: string; city: string | null; state: string | null; postal_code: string | null; pet_warning: string | null; gate_code: string | null; access_notes: string | null; obstacle_notes: string | null; latitude: number | null; longitude: number | null; default_mowing_enabled: boolean | null; default_weed_eating_enabled: boolean | null; default_edging_enabled: boolean | null; default_blow_off_enabled: boolean | null } | null
          const warnings = [property?.pet_warning, property?.gate_code ? `Gate: ${property.gate_code}` : null, property?.access_notes, property?.obstacle_notes].filter(Boolean)
          const effectiveCoord = jobCoordMap.get(job.id)
          const fc = effectiveCoord
            ? weatherMap.get(coordKey(effectiveCoord.lat, effectiveCoord.lon))
            : undefined
          const wetRisk = fc && (fc.precipChance >= 40 || fc.precipInches >= 0.05)

          return (
            <div key={job.id} className="card">
              <div className="card-row">
                <div>
                  <div className="card-title">{job.title}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                    <div className="card-meta">👤 {customer?.first_name} {customer?.last_name}</div>
                    <div className="card-meta">📍 {property?.service_address}{property?.city ? `, ${property.city}` : ''}</div>
                    {job.scheduled_time_window && <div className="card-meta">🗓 {job.scheduled_time_window}</div>}
                    <div className="card-meta">🌿 {deriveServiceLabel(job.service_package, property)}</div>
                    {job.price != null && <div className="card-meta">💵 ${Number(job.price).toFixed(0)}</div>}
                    {effectiveCoord != null && (
                      fc ? (
                        <div className="card-meta" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{fc.currentEmoji}</span>
                          <span>{fc.currentTemp}° now · {fc.currentSummary} · High {fc.tempHi}°</span>
                          {fc.precipChance > 0 && (
                            <span style={{ color: wetRisk ? 'var(--color-overdue)' : undefined, fontWeight: wetRisk ? 600 : undefined }}>
                              · {fc.precipChance}% rain
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="card-meta" style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                          Weather unavailable for this property.
                        </div>
                      )
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span className={`pill pill-${job.status}`}>{statusLabel(job.status)}</span>
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
                  <SmsLink
                    phone={customer.phone}
                    body={buildOnMyWaySms(customer.first_name)}
                    mode={smsMode}
                    className="btn btn-sm btn-secondary"
                  >
                    On My Way
                  </SmsLink>
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
  )
}

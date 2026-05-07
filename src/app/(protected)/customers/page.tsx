import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Customer } from '@/types/database'
import { formatFrequencyLabel } from '@/lib/frequency'

type PropertySummary = {
  id: string
  service_address: string
  city: string | null
  service_frequency: string | null
  default_price: number | null
  default_mowing_enabled: boolean | null
  default_weed_eating_enabled: boolean | null
  default_edging_enabled: boolean | null
  default_blow_off_enabled: boolean | null
  default_service_package: string | null
  status: string
}

type UpcomingJob = {
  customer_id: string
  scheduled_date: string
  scheduled_time_window: string | null
}

type CustomerListItem = Customer & {
  tags?: string[] | null
  properties?: PropertySummary[]
}

const FALLBACK_TIMEZONE = 'UTC'

function resolveTimeZone(raw: string | null | undefined): string {
  if (!raw) return FALLBACK_TIMEZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: raw })
    return raw
  } catch {
    return FALLBACK_TIMEZONE
  }
}

function getLocalDateStr(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function CustomersPage() {
  const supabase = await createClient()

  const { data: tzSettings } = await supabase
    .from('pricing_settings')
    .select('time_zone')
    .single()
  const timeZone = resolveTimeZone(tzSettings?.time_zone)
  const today = getLocalDateStr(timeZone)

  const [{ data: customers }, { data: upcomingJobs }] = await Promise.all([
    supabase
      .from('customers')
      .select(`
        *,
        properties(
          id, service_address, city, service_frequency,
          default_price, default_mowing_enabled, default_weed_eating_enabled,
          default_edging_enabled, default_blow_off_enabled,
          default_service_package, status
        )
      `)
      .in('status', ['active', 'inactive'])
      .order('first_name', { ascending: true }),
    supabase
      .from('jobs')
      .select('customer_id, scheduled_date, scheduled_time_window')
      .in('status', ['scheduled', 'in_progress', 'needs_reschedule'])
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true }),
  ])

  const customerRows = (customers ?? []) as CustomerListItem[]

  // Build map: customer_id -> soonest upcoming job (already ordered ascending)
  const nextJobMap = new Map<string, UpcomingJob>()
  for (const job of (upcomingJobs ?? []) as UpcomingJob[]) {
    if (!nextJobMap.has(job.customer_id)) {
      nextJobMap.set(job.customer_id, job)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{customers?.length ?? 0} total</p>
        </div>
      </div>

      {customerRows.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: '2rem' }}>👷</p>
          <p style={{ fontWeight: 600, marginTop: '8px' }}>No customers yet</p>
          <p>New contacts start as leads. Add a lead first, then promote them to active customer after an estimate is approved.</p>
          <Link href="/leads/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Add Lead
          </Link>
        </div>
      ) : (
        customerRows.map((c) => {
          const props = (c.properties ?? []) as PropertySummary[]
          const activeProps = props.filter(p => p.status !== 'archived')
          const prop = activeProps[0] ?? props[0] ?? null

          const address = prop
            ? [prop.service_address, prop.city].filter(Boolean).join(', ')
            : null

          const frequency = prop?.service_frequency
            ? formatFrequencyLabel(prop.service_frequency)
            : null

          let serviceOptions: string | null = null
          if (prop) {
            const hasBooleans =
              prop.default_mowing_enabled !== null ||
              prop.default_weed_eating_enabled !== null ||
              prop.default_edging_enabled !== null ||
              prop.default_blow_off_enabled !== null
            if (hasBooleans) {
              const services: string[] = []
              if (prop.default_mowing_enabled) services.push('Mowing')
              if (prop.default_weed_eating_enabled) services.push('Weed eating')
              if (prop.default_edging_enabled) services.push('Edging')
              if (prop.default_blow_off_enabled) services.push('Blow off')
              serviceOptions = services.length > 0 ? services.join(', ') : null
            }
            if (!serviceOptions && prop.default_service_package) {
              serviceOptions = prop.default_service_package
            }
          }

          const price =
            prop?.default_price != null ? `Default: $${prop.default_price}` : null

          const nextJob = nextJobMap.get(c.id) ?? null
          const nextService = nextJob
            ? fmtDate(nextJob.scheduled_date) +
              (nextJob.scheduled_time_window ? ` · ${nextJob.scheduled_time_window}` : '')
            : null

          return (
            <Link key={c.id} href={`/customers/${c.id}`} style={{ display: 'block' }}>
              <div className="card">
                <div className="card-row">
                  <div>
                    <div className="card-title">
                      {c.first_name}{c.last_name ? ` ${c.last_name}` : ''}
                    </div>
                    {c.phone && <div className="contact-row">📞 {c.phone}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                    <span className={`pill pill-${c.status}`}>{c.status}</span>
                    {(c.tags ?? []).map((tag: string) => (
                      <span key={tag} className="pill pill-draft" style={{ fontSize: '0.7rem' }}>{tag}</span>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {address && (
                    <div className="card-meta">📍 {address}</div>
                  )}
                  <div className="card-meta">
                    🗓 {nextService ?? 'No upcoming job scheduled'}
                  </div>
                  {frequency && (
                    <div className="card-meta">🔁 {frequency}</div>
                  )}
                  {serviceOptions && (
                    <div className="card-meta">🌿 {serviceOptions}</div>
                  )}
                  {price && (
                    <div className="card-meta">💵 {price}</div>
                  )}
                </div>
              </div>
            </Link>
          )
        })
      )}
    </div>
  )
}

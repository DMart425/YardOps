import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDateOnly, getLocalDateStr, resolveTimeZone } from '@/lib/date'
import { formatFrequencyLabel } from '@/lib/frequency'
import { redirect } from 'next/navigation'

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter = 'all' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('time_zone')
    .eq('user_id', user.id)
    .maybeSingle()
  const timeZone = resolveTimeZone(settings?.time_zone)
  const today = getLocalDateStr(timeZone)

  const [{ data: properties }, { data: upcomingJobs }] = await Promise.all([
    supabase
      .from('properties')
      .select(`
        id, property_name, service_address, city, service_frequency, status,
        default_mowing_enabled, default_weed_eating_enabled, default_edging_enabled, default_blow_off_enabled,
        default_service_package, default_price,
        customers ( id, first_name, last_name, status )
      `)
      .order('service_address', { ascending: true }),
    supabase
      .from('jobs')
      .select('property_id, scheduled_date, scheduled_time_window')
      .in('status', ['scheduled', 'in_progress', 'needs_reschedule'])
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true }),
  ])

  type UpcomingJob = {
    property_id: string
    scheduled_date: string
    scheduled_time_window: string | null
  }

  const nextJobMap = new Map<string, UpcomingJob>()
  for (const job of (upcomingJobs ?? []) as UpcomingJob[]) {
    if (!nextJobMap.has(job.property_id)) {
      nextJobMap.set(job.property_id, job)
    }
  }

  // Client-side filter by customer status
  const filtered = (properties ?? []).filter((p) => {
    const cust = (Array.isArray(p.customers) ? p.customers[0] : p.customers) as { status: string } | null
    if (filter === 'leads')  return cust?.status === 'lead'
    if (filter === 'active') return cust?.status === 'active' || cust?.status === 'inactive'
    return true
  })

  const tabs = [
    { key: 'all',    label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'leads',  label: 'Leads' },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Properties</h1>
          <p className="page-subtitle">{filtered.length} shown</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/properties?filter=${t.key}`}
            className={`filter-tab${filter === t.key ? ' active' : ''}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {!filtered.length ? (
        <div className="empty-state">
          <p style={{ fontSize: '2rem' }}>🏡</p>
          <p style={{ fontWeight: 600, marginTop: '8px' }}>No properties here</p>
          {filter === 'leads'  && <p>No lead properties yet.</p>}
          {filter === 'active' && <p>No active customer properties yet.</p>}
          {filter === 'all'    && <p>Properties are added from a lead, contact, or customer record. Open a contact to add a property.</p>}
        </div>
      ) : (
        filtered.map((p) => {
          const customer = (Array.isArray(p.customers) ? p.customers[0] : p.customers) as { id: string; first_name: string; last_name: string | null; status: string } | null
          const customerName = customer
            ? `${customer.first_name}${customer.last_name ? ` ${customer.last_name}` : ''}`
            : 'No customer assigned'
          const address = [p.service_address, p.city].filter(Boolean).join(', ')
          const frequency = p.service_frequency ? formatFrequencyLabel(p.service_frequency) : null

          const services: string[] = []
          const hasServiceBooleans =
            p.default_mowing_enabled !== null ||
            p.default_weed_eating_enabled !== null ||
            p.default_edging_enabled !== null ||
            p.default_blow_off_enabled !== null
          if (hasServiceBooleans) {
            if (p.default_mowing_enabled) services.push('Mowing')
            if (p.default_weed_eating_enabled) services.push('Weed eating')
            if (p.default_edging_enabled) services.push('Edging')
            if (p.default_blow_off_enabled) services.push('Blow off')
          }
          const serviceOptions = services.length > 0
            ? services.join(', ')
            : (p.default_service_package || null)

          const nextJob = nextJobMap.get(p.id)
          const nextService = nextJob
            ? `${formatDateOnly(nextJob.scheduled_date)}${nextJob.scheduled_time_window ? ` · ${nextJob.scheduled_time_window}` : ''}`
            : 'No upcoming job scheduled'

          const defaultPrice = p.default_price != null ? `Default: $${p.default_price}` : null

          return (
            <Link key={p.id} href={`/properties/${p.id}`} style={{ display: 'block' }}>
              <div className="card">
                <div className="card-row">
                  <div>
                    <div className="card-title">{p.property_name ?? p.service_address}</div>
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div className="card-meta">👤 {customerName}</div>
                      <div className="card-meta">📍 {address}</div>
                      <div className="card-meta">🗓 {nextService}</div>
                      {frequency && <div className="card-meta">🔁 {frequency}</div>}
                      {serviceOptions && <div className="card-meta">🌿 {serviceOptions}</div>}
                      {defaultPrice && <div className="card-meta">💵 {defaultPrice}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    {customer?.status === 'lead'
                      ? <span className="pill pill-lead">Lead</span>
                      : <span className={`pill pill-${p.status}`}>{p.status}</span>
                    }
                  </div>
                </div>
              </div>
            </Link>
          )
        })
      )}
    </div>
  )
}

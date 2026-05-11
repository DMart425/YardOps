import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDateOnly, getLocalDateStr, resolveTimeZone } from '@/lib/date'
import { formatFrequencyLabel } from '@/lib/frequency'
import { requireBusinessContext } from '@/lib/business/context'

const PAGE_SIZE = 50

function parsePage(raw: string | undefined): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 1
  const p = Math.floor(n)
  return p < 1 ? 1 : p
}

const FILTERS = [
  ['all', 'All'],
  ['active', 'Active'],
  ['leads', 'Leads'],
] as const

type FilterKey = typeof FILTERS[number][0]

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string; page?: string }>
}) {
  const sp = await searchParams
  const filter: FilterKey = FILTERS.some(([key]) => key === sp.filter) ? (sp.filter as FilterKey) : 'all'
  const q = (sp.q ?? '').trim()
  const page = parsePage(sp.page)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE

  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('time_zone')
    .eq('user_id', userId)
    .maybeSingle()
  const timeZone = resolveTimeZone(settings?.time_zone)
  const today = getLocalDateStr(timeZone)

  let filterCustomerIds: string[] | null = null
  if (filter !== 'all') {
    const statuses = filter === 'leads' ? ['lead'] : ['active', 'inactive']
    const { data: customersForFilter } = await supabase
      .from('customers')
      .select('id')
      .eq('business_id', businessId)
      .in('status', statuses)
    filterCustomerIds = (customersForFilter ?? []).map(c => c.id)
  }

  let customerNameMatchIds: string[] = []
  if (q) {
    const qSafe = q.replace(/[,()]/g, ' ')
    const pattern = `%${qSafe}%`
    let customerNameQuery = supabase
      .from('customers')
      .select('id')
      .eq('business_id', businessId)
      .or(`first_name.ilike.${pattern},last_name.ilike.${pattern}`)

    if (filter === 'leads') {
      customerNameQuery = customerNameQuery.eq('status', 'lead')
    } else if (filter === 'active') {
      customerNameQuery = customerNameQuery.in('status', ['active', 'inactive'])
    }

    const { data: customersByName } = await customerNameQuery
    customerNameMatchIds = (customersByName ?? []).map(c => c.id)
  }

  let propertiesData: Array<{
    id: string
    property_name: string | null
    service_address: string
    city: string | null
    county: string | null
    normalized_address: string | null
    full_address: string | null
    service_frequency: string | null
    status: string
    default_mowing_enabled: boolean | null
    default_weed_eating_enabled: boolean | null
    default_edging_enabled: boolean | null
    default_blow_off_enabled: boolean | null
    default_service_package: string | null
    default_price: number | null
    customers: { id: string; first_name: string; last_name: string | null; status: string } | { id: string; first_name: string; last_name: string | null; status: string }[] | null
  }> = []

  const canQueryProperties = filterCustomerIds == null || filterCustomerIds.length > 0
  if (canQueryProperties) {
    let propertiesQuery = supabase
      .from('properties')
      .select(`
        id, property_name, service_address, city, county, normalized_address, full_address, service_frequency, status,
        default_mowing_enabled, default_weed_eating_enabled, default_edging_enabled, default_blow_off_enabled,
        default_service_package, default_price,
        customers ( id, first_name, last_name, status )
      `)
      .eq('business_id', businessId)
      .order('service_address', { ascending: true })
      .range(from, to)

    if (filterCustomerIds) {
      propertiesQuery = propertiesQuery.in('customer_id', filterCustomerIds)
    }

    if (q) {
      const qSafe = q.replace(/[,()]/g, ' ')
      const pattern = `%${qSafe}%`
      const orParts = [
        `property_name.ilike.${pattern}`,
        `service_address.ilike.${pattern}`,
        `city.ilike.${pattern}`,
        `county.ilike.${pattern}`,
        `normalized_address.ilike.${pattern}`,
        `full_address.ilike.${pattern}`,
      ]
      if (customerNameMatchIds.length > 0) {
        orParts.push(`customer_id.in.(${customerNameMatchIds.join(',')})`)
      }
      propertiesQuery = propertiesQuery.or(orParts.join(','))
    }

    const { data: properties } = await propertiesQuery
    propertiesData = (properties ?? []) as typeof propertiesData
  }

  const propertiesAll = propertiesData
  const hasNextPage = propertiesAll.length > PAGE_SIZE
  const filtered = propertiesAll.slice(0, PAGE_SIZE)
  const hasPrevPage = page > 1

  type UpcomingJob = {
    property_id: string
    scheduled_date: string
    scheduled_time_window: string | null
  }

  const displayedPropertyIds = filtered.map(p => p.id)
  let upcomingJobs: UpcomingJob[] = []
  if (displayedPropertyIds.length > 0) {
    const { data: jobs } = await supabase
      .from('jobs')
      .select('property_id, scheduled_date, scheduled_time_window')
      .eq('business_id', businessId)
      .in('status', ['scheduled', 'in_progress', 'needs_reschedule'])
      .gte('scheduled_date', today)
      .in('property_id', displayedPropertyIds)
      .order('scheduled_date', { ascending: true })
    upcomingJobs = (jobs ?? []) as UpcomingJob[]
  }

  const nextJobMap = new Map<string, UpcomingJob>()
  for (const job of upcomingJobs) {
    if (!nextJobMap.has(job.property_id)) {
      nextJobMap.set(job.property_id, job)
    }
  }

  function buildPropertiesHref(nextFilter: FilterKey, nextPage: number, nextQ: string): string {
    const params = new URLSearchParams()
    if (nextFilter !== 'all') params.set('filter', nextFilter)
    if (nextQ) params.set('q', nextQ)
    params.set('page', String(nextPage))
    return `/properties?${params.toString()}`
  }

  const clearHref = filter === 'all' ? '/properties' : `/properties?filter=${filter}`
  const pageOneHref = buildPropertiesHref(filter, 1, q)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Properties</h1>
          <p className="page-subtitle">{q ? 'Search results' : `Showing up to ${PAGE_SIZE} properties`}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs">
        {FILTERS.map(([key, label]) => (
          <Link
            key={key}
            href={buildPropertiesHref(key, 1, q)}
            className={`filter-tab${filter === key ? ' active' : ''}`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="card" style={{ marginBottom: '12px' }}>
        <form method="get" className="card-row" style={{ gap: '8px' }}>
          {filter !== 'all' ? <input type="hidden" name="filter" value={filter} /> : null}
          <input name="q" defaultValue={q} className="form-input" placeholder="Search address or property name" aria-label="Search properties" />
          <input type="hidden" name="page" value="1" />
          <button type="submit" className="btn btn-sm btn-secondary">Search</button>
          {q ? <Link href={clearHref} className="btn btn-sm btn-secondary">Clear</Link> : null}
        </form>
      </div>

      {!filtered.length ? (
        hasPrevPage ? (
          <div className="card" style={{ marginTop: '12px' }}>
            <p className="text-small text-muted">No properties on this page.</p>
            <div style={{ marginTop: '10px' }}>
              <Link href={pageOneHref} className="btn btn-sm btn-secondary">Back to page 1</Link>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <p style={{ fontSize: '2rem' }}>🏡</p>
            <p style={{ fontWeight: 600, marginTop: '8px' }}>No properties here</p>
            {filter === 'leads' && <p>No lead properties yet.</p>}
            {filter === 'active' && <p>No active customer properties yet.</p>}
            {filter === 'all' && <p>Properties are added from a lead, contact, or customer record. Open a contact to add a property.</p>}
          </div>
        )
      ) : (
        <div>
          {filtered.map((p) => {
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
          })}

          <div className="card-row" style={{ marginTop: '12px' }}>
            <div>
              {hasPrevPage ? (
                <Link href={buildPropertiesHref(filter, page - 1, q)} className="btn btn-sm btn-secondary">Previous</Link>
              ) : null}
            </div>
            <div className="text-small text-muted">Page {page}</div>
            <div>
              {hasNextPage ? (
                <Link href={buildPropertiesHref(filter, page + 1, q)} className="btn btn-sm btn-secondary">Next</Link>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

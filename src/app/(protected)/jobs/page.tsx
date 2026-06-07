import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { addDays, formatDateOnly, formatTimestampDate, getLocalDateStr, localMidnightUtcIso, resolveTimeZone } from '@/lib/date'
import { requireBusinessContext } from '@/lib/business/context'

type CustomerRelation = { first_name: string; last_name: string | null }
type PropertyRelation = {
  service_address: string
  city: string | null
  latitude: number | null
  longitude: number | null
  default_mowing_enabled: boolean | null
  default_weed_eating_enabled: boolean | null
  default_edging_enabled: boolean | null
  default_blow_off_enabled: boolean | null
}

type JobListRow = {
  id: string
  title: string
  status: string
  payment_status: string
  price: number | null
  amount_paid: number | null
  scheduled_date: string | null
  completed_at: string | null
  scheduled_time_window: string | null
  service_package: string | null
  job_type: string | null
  customers: CustomerRelation | CustomerRelation[] | null
  properties: PropertyRelation | PropertyRelation[] | null
}

// Maps stored service_package codes → friendly display labels.
// job_type ('recurring', 'one_time') is intentionally excluded: it is a
// scheduling concept, not a service scope description.
const SERVICE_LABELS: Record<string, string> = {
  mow_only:      'Mow Only',
  mow_trim_blow: 'Mow, Trim & Blow',
  trim_cleanup:  'Trim & Cleanup',
  full_service:  'Full Service',
}

function formatServicePackage(pkg: string | null | undefined): string | null {
  if (!pkg) return null
  return SERVICE_LABELS[pkg] ?? pkg.replace(/_/g, ' ')
}

// Builds an itemized service list from property boolean columns.
// Returns e.g. "Mowing, Blow Off" or null if no booleans are set.
function formatServiceBooleans(prop: PropertyRelation | null | undefined): string | null {
  if (!prop) return null
  const parts: string[] = []
  if (prop.default_mowing_enabled)      parts.push('Mowing')
  if (prop.default_weed_eating_enabled) parts.push('Weed Eating')
  if (prop.default_edging_enabled)      parts.push('Edging')
  if (prop.default_blow_off_enabled)    parts.push('Blow Off')
  return parts.length > 0 ? parts.join(', ') : null
}

// Title-cases a raw enum value for display in pills.
// e.g. 'in_progress' → 'In Progress', 'needs_reschedule' → 'Needs Reschedule'
function statusLabel(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
}

// Derives a human-readable service label for a job card.
// Priority: property booleans (most precise) → service_package code (legacy fallback).
// job_type ('recurring', 'one_time') is intentionally never used here.
function serviceLabel(
  pkg: string | null | undefined,
  propRaw: PropertyRelation | PropertyRelation[] | null | undefined
): string | null {
  const prop = Array.isArray(propRaw) ? propRaw[0] : propRaw
  const fromBooleans = formatServiceBooleans(prop)
  if (fromBooleans) return fromBooleans
  return formatServicePackage(pkg)
}

const FILTERS_SCHEDULED = [
  ['upcoming', 'Upcoming'],
  ['today',    'Today'],
  ['week',     'This Week'],
  ['overdue',  'Overdue'],
] as const

const FILTERS_COMPLETED = [
  ['today',             'Today'],
  ['week',              'This Week'],
  ['month',             'This Month'],
  ['ytd',               'YTD'],
  ['unpaid',            'Unpaid'],
  ['cancelled_skipped', 'Cancelled / Skipped'],
] as const

function dayOfWeek(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCDay()
}

const COMPLETED_PAGE_SIZE = 50

function parsePage(raw: string | undefined): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 1
  const p = Math.floor(n)
  return p < 1 ? 1 : p
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; view?: string; page?: string; customer_id?: string; property_id?: string }>
}) {
  const sp = await searchParams
  const view: 'scheduled' | 'completed' = sp.view === 'completed' ? 'completed' : 'scheduled'
  const availableFilters = view === 'completed' ? FILTERS_COMPLETED : FILTERS_SCHEDULED
  const defaultFilter = view === 'completed' ? 'week' : 'upcoming'
  const filter = availableFilters.some(([key]) => key === sp.filter) ? (sp.filter as string) : defaultFilter
  const page = view === 'completed' ? parsePage(sp.page) : 1
  const completedFrom = (page - 1) * COMPLETED_PAGE_SIZE
  const completedTo = completedFrom + COMPLETED_PAGE_SIZE - 1

  // Optional customer/property scoping via query params.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const customerId = UUID_RE.test(sp.customer_id ?? '') ? (sp.customer_id as string) : null
  const propertyId = UUID_RE.test(sp.property_id ?? '') ? (sp.property_id as string) : null

  // Builds a /jobs URL, always preserving active customer/property filter context.
  const jobsHref = (params: Record<string, string | null | undefined>): string => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '') qs.set(k, v)
    }
    if (customerId) qs.set('customer_id', customerId)
    if (propertyId) qs.set('property_id', propertyId)
    const s = qs.toString()
    return s ? `/jobs?${s}` : '/jobs'
  }

  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('time_zone, blackout_dates')
    .eq('user_id', userId)
    .maybeSingle()
  const timeZone = resolveTimeZone(settings?.time_zone ?? null)

  const today = getLocalDateStr(timeZone)
  const weekday = dayOfWeek(today)
  const weekStartStr = addDays(today, -weekday)
  const weekEndStr = addDays(weekStartStr, 6)
  const nextWeekStartStr = addDays(weekStartStr, 7)
  const monthStartStr = `${today.slice(0, 7)}-01`
  const yearStartStr = `${today.slice(0, 4)}-01-01`
  const tomorrowStr = addDays(today, 1)

  const active = ['scheduled', 'in_progress', 'needs_reschedule']

  let query = supabase
    .from('jobs')
    .select('id, title, status, payment_status, price, amount_paid, scheduled_date, completed_at, scheduled_time_window, service_package, job_type, customers(first_name, last_name), properties(service_address, city, latitude, longitude, default_mowing_enabled, default_weed_eating_enabled, default_edging_enabled, default_blow_off_enabled)')
    .eq('business_id', businessId)

  if (customerId) query = query.eq('customer_id', customerId)
  if (propertyId) query = query.eq('property_id', propertyId)

  if (view === 'completed') {
    if (filter === 'cancelled_skipped') {
      // Separate path: cancelled/skipped have no completed_at, so order by updated_at.
      // Status filter is applied here only — never combined with eq('status','completed').
      query = query
        .in('status', ['cancelled', 'skipped'])
        .order('updated_at', { ascending: false })
    } else {
      query = query.eq('status', 'completed').order('completed_at', { ascending: false })
      switch (filter) {
        case 'today':
          query = query.gte('completed_at', localMidnightUtcIso(today, timeZone)).lt('completed_at', localMidnightUtcIso(tomorrowStr, timeZone))
          break
        case 'week':
          query = query.gte('completed_at', localMidnightUtcIso(weekStartStr, timeZone)).lt('completed_at', localMidnightUtcIso(nextWeekStartStr, timeZone))
          break
        case 'month':
          query = query.gte('completed_at', localMidnightUtcIso(monthStartStr, timeZone)).lt('completed_at', localMidnightUtcIso(tomorrowStr, timeZone))
          break
        case 'ytd':
          query = query.gte('completed_at', localMidnightUtcIso(yearStartStr, timeZone)).lt('completed_at', localMidnightUtcIso(tomorrowStr, timeZone))
          break
        case 'unpaid':
          query = query.in('payment_status', ['unpaid', 'partial'])
          break
        default:
          query = query.gte('completed_at', localMidnightUtcIso(today, timeZone)).lt('completed_at', localMidnightUtcIso(tomorrowStr, timeZone))
      }
    }
    query = query.range(completedFrom, completedTo)
  } else {
    query = query.order('scheduled_date', { ascending: true })
    switch (filter) {
      case 'today':
        query = query.in('status', active).eq('scheduled_date', today)
        break
      case 'week':
        query = query.in('status', active).gte('scheduled_date', weekStartStr).lte('scheduled_date', weekEndStr)
        break
      case 'overdue':
        query = query.in('status', active).lt('scheduled_date', today)
        break
      default: // upcoming
        query = query.in('status', active).gte('scheduled_date', today)
    }
  }

  const { data: jobs } = await query
  const jobRows = (jobs ?? []) as JobListRow[]
  const hasPrevCompletedPage = view === 'completed' && page > 1
  const hasNextCompletedPage = view === 'completed' && jobRows.length === COMPLETED_PAGE_SIZE
  const completedPageOneHref = jobsHref({ view: 'completed', filter, page: '1' })
  const completedStart = completedFrom + 1
  const completedEnd = completedFrom + jobRows.length
  const completedHasRows = jobRows.length > 0
  const completedMayHaveMore = jobRows.length === COMPLETED_PAGE_SIZE

  // ── Blackout dates ──
  const blackoutDates: string[] = (settings?.blackout_dates as string[] | null) ?? []

  // ── Stale unpaid count (completed + unpaid/partial + >7 days old) ──
  const sevenDaysAgoStr = addDays(today, -7)
  const { count: staleUnpaidCount } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('status', 'completed')
    .in('payment_status', ['unpaid', 'partial'])
    .lt('completed_at', localMidnightUtcIso(sevenDaysAgoStr, timeZone))

  // ── Overdue scheduled count (active status + scheduled_date before today) ──
  const { count: overdueScheduledCount } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .in('status', active)
    .lt('scheduled_date', today)

  function routeUrl(addresses: string[]): string | null {
    if (addresses.length === 0) return null
    if (addresses.length === 1) {
      return `https://maps.google.com/?q=${encodeURIComponent(addresses[0])}`
    }
    const dest = encodeURIComponent(addresses[addresses.length - 1])
    const waypoints = addresses.slice(0, -1).map(encodeURIComponent).join('|')
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}&waypoints=${waypoints}&travelmode=driving`
  }

  // Group week jobs by date, optimized by nearest-neighbor route order
  type WeekJob = JobListRow
  const groupedByDay: Map<string, WeekJob[]> = new Map()
  if (view === 'scheduled' && filter === 'week' && jobRows.length > 0) {
    // First group by day
    for (const j of jobRows) {
      const k = j.scheduled_date ?? 'unscheduled'
      if (!groupedByDay.has(k)) groupedByDay.set(k, [])
      groupedByDay.get(k)!.push(j)
    }
    // Then sort each day by nearest-neighbor using lat/lon
    for (const [day, dayJobs] of groupedByDay) {
      const withCoords = dayJobs.filter(j => {
        const p = (Array.isArray(j.properties) ? j.properties[0] : j.properties) as { latitude?: number | null; longitude?: number | null } | null
        return p?.latitude != null && p.longitude != null
      })
      const noCoords = dayJobs.filter(j => {
        const p = (Array.isArray(j.properties) ? j.properties[0] : j.properties) as { latitude?: number | null; longitude?: number | null } | null
        return !p?.latitude || !p.longitude
      })
      if (withCoords.length > 1) {
        // Nearest-neighbor from the northernmost point
        const getCoord = (j: WeekJob) => {
          const p = (Array.isArray(j.properties) ? j.properties[0] : j.properties) as { latitude: number; longitude: number } | null
          return p!
        }
        const dist = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) =>
          Math.hypot(a.latitude - b.latitude, a.longitude - b.longitude)
        const remaining = [...withCoords]
        const sorted: WeekJob[] = []
        // Start from northernmost (highest lat)
        let cur = remaining.splice(remaining.reduce((bi, j, i) => getCoord(j).latitude > getCoord(remaining[bi]).latitude ? i : bi, 0), 1)[0]
        sorted.push(cur)
        while (remaining.length > 0) {
          const curCoord = getCoord(cur)
          const nearestIdx = remaining.reduce((bi, j, i) => dist(getCoord(j), curCoord) < dist(getCoord(remaining[bi]), curCoord) ? i : bi, 0)
          cur = remaining.splice(nearestIdx, 1)[0]
          sorted.push(cur)
        }
        groupedByDay.set(day, [...sorted, ...noCoords])
      }
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Jobs</h1>
        <Link href="/jobs/new" className="btn btn-header btn-sm">+ New</Link>
      </div>

      <div className="filter-tabs" style={{ marginBottom: '8px' }}>
        <Link href={jobsHref({ view: 'scheduled', filter: 'upcoming' })} className={`filter-tab${view === 'scheduled' ? ' active' : ''}`}>
          Scheduled
        </Link>
        <Link href={jobsHref({ view: 'completed', filter: 'week', page: '1' })} className={`filter-tab${view === 'completed' ? ' active' : ''}`}>
          Completed
        </Link>
      </div>

      <div className="filter-tabs">
        {availableFilters.map(([key, label]) => (
          <Link
            key={key}
            href={view === 'completed' ? jobsHref({ view: 'completed', filter: key, page: '1' }) : jobsHref({ view: 'scheduled', filter: key })}
            className={`filter-tab${filter === key ? ' active' : ''}`}
          >
            {label}{key === 'unpaid' && staleUnpaidCount ? <span style={{ marginLeft: 4, background: '#dc2626', color: '#fff', borderRadius: '999px', padding: '1px 6px', fontSize: '0.65rem', fontWeight: 700, verticalAlign: 'middle' }}>{staleUnpaidCount}</span> : null}{key === 'overdue' && overdueScheduledCount ? <span style={{ marginLeft: 4, background: '#dc2626', color: '#fff', borderRadius: '999px', padding: '1px 6px', fontSize: '0.65rem', fontWeight: 700, verticalAlign: 'middle' }}>{overdueScheduledCount}</span> : null}
          </Link>
        ))}
      </div>

      {(customerId || propertyId) && (
        <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted, #888)' }}>
          {customerId && propertyId ? 'Filtered by customer and property' : customerId ? 'Filtered by customer' : 'Filtered by property'}
          {' · '}
          <Link href="/jobs" style={{ color: 'var(--color-primary)' }}>Clear</Link>
        </div>
      )}

      {filter === 'unpaid' && staleUnpaidCount != null && staleUnpaidCount > 0 && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          ⚠️ {staleUnpaidCount} job{staleUnpaidCount !== 1 ? 's' : ''} unpaid for 7+ days
        </div>
      )}

      {jobRows.length === 0 ? (
        hasPrevCompletedPage ? (
          <div className="card" style={{ marginTop: '12px' }}>
            <p className="text-small text-muted">No jobs on this page.</p>
            <div style={{ marginTop: '10px' }}>
              <Link href={completedPageOneHref} className="btn btn-sm btn-secondary">Back to page 1</Link>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <p style={{ fontSize: '2rem' }}>📋</p>
            <p style={{ marginTop: '8px', fontWeight: 600 }}>No jobs here</p>
            <p>Try a different filter or create a new job.</p>
            <Link href="/jobs/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>+ New Job</Link>
          </div>
        )
      ) : view === 'scheduled' && filter === 'week' ? (
        <div>
          {/* Week total revenue summary */}
          {(() => {
            const weekTotal = jobRows.reduce((s, j) => s + (j.price != null ? Number(j.price) : 0), 0)
            const anyPriced = jobRows.some(j => j.price != null)
            if (!anyPriced) return null
            return (
              <div style={{ marginBottom: '1rem', color: 'var(--text-muted, #888)', fontSize: '0.85rem' }}>
                This week: <strong style={{ color: 'var(--text, inherit)' }}>${weekTotal.toFixed(0)}</strong> scheduled
              </div>
            )
          })()}
          {/* Blackout days with no jobs (otherwise they'd be invisible) */}
          {blackoutDates
            .filter(d => d >= today && d <= weekEndStr && !groupedByDay.has(d))
            .sort()
            .map(d => (
              <div key={d} style={{
                marginBottom: '1rem', padding: '10px 12px',
                background: 'rgba(239,68,68,0.06)',
                border: '1px dashed rgba(239,68,68,0.4)',
                borderRadius: 'var(--r-sm)',
              }}>
                <span className="section-heading" style={{ marginBottom: 0 }}>
                  {formatDateOnly(d, { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 600,
                    background: 'rgba(239,68,68,0.15)', color: '#dc2626',
                    borderRadius: '4px', padding: '2px 6px',
                  }}>🚫 Day Off</span>
                </span>
              </div>
            ))
          }
          {Array.from(groupedByDay.entries()).map(([day, dayJobs]) => {
            const addresses = dayJobs
              .map(j => {
                const p = (Array.isArray(j.properties) ? j.properties[0] : j.properties) as { service_address: string; city: string | null } | null
                return p ? `${p.service_address}${p.city ? ', ' + p.city : ''}` : ''
              })
              .filter(Boolean)
            const url = routeUrl(addresses)
            const dayTotal = dayJobs.reduce((s, j) => s + (j.price ?? 0), 0)
            const anyPriced = dayJobs.some(j => j.price != null)
            const dayTotalLabel = anyPriced ? `$${dayTotal.toFixed(0)}` : '—'
            const isBlackout = day !== 'unscheduled' && blackoutDates.includes(day)

            return (
              <div key={day} style={{ marginBottom: '1.25rem' }}>
                <div className="card-row" style={{ marginBottom: '8px' }}>
                  <div className="section-heading" style={{ marginBottom: 0 }}>
                    {day === 'unscheduled' ? 'Unscheduled' : formatDateOnly(day, { weekday: 'short', month: 'short', day: 'numeric' })} ({dayJobs.length})
                    {isBlackout && (
                      <span style={{
                        marginLeft: '8px', fontSize: '0.7rem', fontWeight: 600,
                        background: 'rgba(239,68,68,0.15)', color: '#dc2626',
                        borderRadius: '4px', padding: '2px 6px', verticalAlign: 'middle',
                      }}>
                        🚫 Day Off
                      </span>
                    )}
                  </div>
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary">
                      🗺 Route · {dayTotalLabel}
                    </a>
                  )}
                </div>
                {dayJobs.map((job) => {
                  const c = (Array.isArray(job.customers) ? job.customers[0] : job.customers) as { first_name: string; last_name: string | null } | null
                  const p = (Array.isArray(job.properties) ? job.properties[0] : job.properties) as { service_address: string; city: string | null } | null
                  const customerName = c ? `${c.first_name}${c.last_name ? ' ' + c.last_name : ''}` : 'No customer'
                  const addr = p ? `${p.service_address}${p.city ? ', ' + p.city : ''}` : 'No address'
                  const service = serviceLabel(job.service_package, job.properties)
                  const dateTime = job.scheduled_date
                    ? `${formatDateOnly(job.scheduled_date, { weekday: 'short', month: 'short', day: 'numeric' })}${job.scheduled_time_window ? ` · ${job.scheduled_time_window}` : ''}`
                    : 'No date'
                  const paymentNeedsAttention = job.payment_status === 'unpaid' || job.payment_status === 'partial'
                  const showPayment = job.status === 'completed' || paymentNeedsAttention

                  return (
                    <Link key={job.id} href={`/jobs/${job.id}`} className="card card-link" style={{ display: 'block', marginBottom: '8px' }}>
                      <div className="card-row">
                        <div style={{ minWidth: 0 }}>
                          <div className="card-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</div>
                          <div className="card-meta">👤 {customerName}</div>
                          <div className="card-meta">📍 {addr}</div>
                          <div className="card-meta">🗓 {dateTime}</div>
                          {service && <div className="card-meta">🌿 {service}</div>}
                          <div className="card-meta">💵 {job.price != null ? `$${Number(job.price).toFixed(0)}` : 'No price set'}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                          <span className={`pill pill-${job.status}`}>{statusLabel(job.status)}</span>
                          {showPayment && <span className={`pill pill-${job.payment_status}`}>{statusLabel(job.payment_status)}</span>}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </div>
      ) : (
        <div>
          {jobRows.map((job) => {
            const c = (Array.isArray(job.customers) ? job.customers[0] : job.customers) as { first_name: string; last_name: string | null } | null
            const p = (Array.isArray(job.properties) ? job.properties[0] : job.properties) as { service_address: string; city: string | null } | null
            const customerName = c ? `${c.first_name}${c.last_name ? ' ' + c.last_name : ''}` : 'No customer'
            const addr = p ? `${p.service_address}${p.city ? ', ' + p.city : ''}` : 'No address'
            const service = serviceLabel(job.service_package, job.properties)
            const dateTime = view === 'completed'
              ? (job.completed_at
                ? formatTimestampDate(job.completed_at as string, timeZone, { weekday: 'short', month: 'short', day: 'numeric' })
                : 'No completion date')
              : (job.scheduled_date
                ? `${formatDateOnly(job.scheduled_date, { weekday: 'short', month: 'short', day: 'numeric' })}${job.scheduled_time_window ? ` · ${job.scheduled_time_window}` : ''}`
                : 'No date')
            const paymentNeedsAttention = job.payment_status === 'unpaid' || job.payment_status === 'partial'
            const showPayment = job.status === 'completed' || paymentNeedsAttention

            return (
              <Link key={job.id} href={`/jobs/${job.id}`} className="card card-link" style={{ display: 'block', marginBottom: '10px' }}>
                <div className="card-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="card-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</div>
                    <div className="card-meta">👤 {customerName}</div>
                    <div className="card-meta">📍 {addr}</div>
                    <div className="card-meta">🗓 {dateTime}</div>
                    {service && <div className="card-meta">🌿 {service}</div>}
                    <div className="card-meta">💵 {job.price != null ? `$${Number(job.price).toFixed(0)}` : 'No price set'}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                    <span className={`pill pill-${job.status}`}>{statusLabel(job.status)}</span>
                    {showPayment && <span className={`pill pill-${job.payment_status}`}>{statusLabel(job.payment_status)}</span>}
                  </div>
                </div>
              </Link>
            )
          })}
          {view === 'completed' && (
            <div className="card-row" style={{ marginTop: '12px' }}>
              <div>
                {hasPrevCompletedPage ? (
                  <Link href={jobsHref({ view: 'completed', filter, page: String(page - 1) })} className="btn btn-sm btn-secondary">
                    Previous
                  </Link>
                ) : null}
              </div>
              <div className="text-small text-muted">
                {completedHasRows
                  ? `Showing ${completedStart}–${completedEnd}${completedMayHaveMore ? '+' : ''}`
                  : 'Showing 0'}
              </div>
              <div>
                {hasNextCompletedPage ? (
                  <Link href={jobsHref({ view: 'completed', filter, page: String(page + 1) })} className="btn btn-sm btn-secondary">
                    Next
                  </Link>
                ) : null}
              </div>
            </div>
          )}        </div>
      )}
    </div>
  )
}


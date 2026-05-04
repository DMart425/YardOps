import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const FILTERS_SCHEDULED = [
  ['upcoming', 'Upcoming'],
  ['today',    'Today'],
  ['week',     'This Week'],
  ['overdue',  'Overdue'],
] as const

const FILTERS_COMPLETED = [
  ['today',  'Today'],
  ['week',   'This Week'],
  ['month',  'This Month'],
  ['ytd',    'YTD'],
  ['unpaid', 'Unpaid'],
] as const

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function localDateStr(d: Date) {
  return d.toLocaleDateString('en-CA')
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; view?: string }>
}) {
  const sp = await searchParams
  const view: 'scheduled' | 'completed' = sp.view === 'completed' ? 'completed' : 'scheduled'
  const availableFilters = view === 'completed' ? FILTERS_COMPLETED : FILTERS_SCHEDULED
  const defaultFilter = view === 'completed' ? 'today' : 'upcoming'
  const filter = availableFilters.some(([key]) => key === sp.filter) ? (sp.filter as string) : defaultFilter
  const supabase = await createClient()

  const now = new Date()
  const today = localDateStr(now)
  const weekEnd = new Date(now)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const weekEndStr = localDateStr(weekEnd)
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - 6)
  const weekStartStr = localDateStr(weekStart)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthStartStr = localDateStr(monthStart)
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const yearStartStr = localDateStr(yearStart)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = localDateStr(tomorrow)

  const active = ['scheduled', 'in_progress', 'needs_reschedule']

  let query = supabase
    .from('jobs')
    .select('id, status, payment_status, price, amount_paid, scheduled_date, completed_at, scheduled_time_window, service_package, customers(first_name, last_name), properties(service_address, city, latitude, longitude)')

  if (view === 'completed') {
    query = query.eq('status', 'completed').order('completed_at', { ascending: false })
    switch (filter) {
      case 'today':
        query = query.gte('completed_at', `${today}T00:00:00`).lt('completed_at', `${tomorrowStr}T00:00:00`)
        break
      case 'week':
        query = query.gte('completed_at', `${weekStartStr}T00:00:00`).lt('completed_at', `${tomorrowStr}T00:00:00`)
        break
      case 'month':
        query = query.gte('completed_at', `${monthStartStr}T00:00:00`).lt('completed_at', `${tomorrowStr}T00:00:00`)
        break
      case 'ytd':
        query = query.gte('completed_at', `${yearStartStr}T00:00:00`).lt('completed_at', `${tomorrowStr}T00:00:00`)
        break
      case 'unpaid':
        query = query.in('payment_status', ['unpaid', 'partial'])
        break
      default:
        query = query.gte('completed_at', `${today}T00:00:00`).lt('completed_at', `${tomorrowStr}T00:00:00`)
    }
  } else {
    query = query.order('scheduled_date', { ascending: true })
    switch (filter) {
      case 'today':
        query = query.in('status', active).eq('scheduled_date', today)
        break
      case 'week':
        query = query.in('status', active).gte('scheduled_date', today).lte('scheduled_date', weekEndStr)
        break
      case 'overdue':
        query = query.in('status', active).lt('scheduled_date', today)
        break
      default: // upcoming
        query = query.in('status', active).gte('scheduled_date', today)
    }
  }

  const { data: jobs } = await query

  // ── Blackout dates ──
  const { data: pricingSettings } = await supabase
    .from('pricing_settings')
    .select('blackout_dates')
    .single()
  const blackoutDates: string[] = (pricingSettings?.blackout_dates as string[] | null) ?? []

  // ── Overdue unpaid count (completed + unpaid + >7 days old) ──
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const { count: overdueCount } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed')
    .in('payment_status', ['unpaid', 'partial'])
    .lt('completed_at', sevenDaysAgo.toISOString())
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
  type WeekJob = NonNullable<typeof jobs> extends (infer T)[] ? T : never
  const groupedByDay: Map<string, WeekJob[]> = new Map()
  if (view === 'scheduled' && filter === 'week' && jobs) {
    // First group by day
    for (const j of jobs) {
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
        <Link href="/jobs?view=scheduled&filter=upcoming" className={`filter-tab${view === 'scheduled' ? ' active' : ''}`}>
          Scheduled
        </Link>
        <Link href="/jobs?view=completed&filter=today" className={`filter-tab${view === 'completed' ? ' active' : ''}`}>
          Completed
        </Link>
      </div>

      <div className="filter-tabs">
        {availableFilters.map(([key, label]) => (
          <Link
            key={key}
            href={`/jobs?view=${view}&filter=${key}`}
            className={`filter-tab${filter === key ? ' active' : ''}`}
          >
            {label}{key === 'unpaid' && overdueCount ? <span style={{ marginLeft: 4, background: '#dc2626', color: '#fff', borderRadius: '999px', padding: '1px 6px', fontSize: '0.65rem', fontWeight: 700, verticalAlign: 'middle' }}>{overdueCount}</span> : null}
          </Link>
        ))}
      </div>

      {filter === 'unpaid' && overdueCount != null && overdueCount > 0 && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          ⚠️ {overdueCount} job{overdueCount !== 1 ? 's' : ''} unpaid for 7+ days
        </div>
      )}

      {!jobs || jobs.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: '2rem' }}>📋</p>
          <p style={{ marginTop: '8px', fontWeight: 600 }}>No jobs here</p>
          <p>Try a different filter or create a new job.</p>
          <Link href="/jobs/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>+ New Job</Link>
        </div>
      ) : view === 'scheduled' && filter === 'week' ? (
        <div>
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
                  {fmtDate(d)}{' '}
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
                    {day === 'unscheduled' ? 'Unscheduled' : fmtDate(day)} ({dayJobs.length})
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
                  const c    = (Array.isArray(job.customers) ? job.customers[0] : job.customers) as { first_name: string; last_name: string | null } | null
                  const p    = (Array.isArray(job.properties) ? job.properties[0] : job.properties) as { service_address: string; city: string | null } | null
                  const name = c ? `${c.first_name}${c.last_name ? ' ' + c.last_name : ''}` : '—'
                  const addr = p ? `${p.service_address}${p.city ? ', ' + p.city : ''}` : '—'

                  return (
                    <Link key={job.id} href={`/jobs/${job.id}`} className="card card-link" style={{ display: 'block', marginBottom: '8px' }}>
                      <div className="card-row">
                        <div style={{ minWidth: 0 }}>
                          <div className="card-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                          <div className="card-meta">{addr}</div>
                          {job.scheduled_time_window && <div className="card-meta">{job.scheduled_time_window}</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                          <span className={`pill pill-${job.status}`}>{job.status.replace(/_/g, ' ')}</span>
                          {job.price != null && <span className="font-bold text-small">${job.price}</span>}
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
          {(jobs as any[]).map((job) => {
            const c = (Array.isArray(job.customers) ? job.customers[0] : job.customers) as { first_name: string; last_name: string | null } | null
            const p = (Array.isArray(job.properties) ? job.properties[0] : job.properties) as { service_address: string; city: string | null } | null
            const name = c ? `${c.first_name}${c.last_name ? ' ' + c.last_name : ''}` : '—'
            const addr = p ? `${p.service_address}${p.city ? ', ' + p.city : ''}` : '—'
            const pkg  = job.service_package
              ? job.service_package.replace(/_/g, ' ')
              : null

            return (
              <Link key={job.id} href={`/jobs/${job.id}`} className="card card-link" style={{ display: 'block', marginBottom: '10px' }}>
                <div className="card-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="card-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    <div className="card-meta">{addr}</div>
                    {pkg && <div className="card-meta">{pkg}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                    <span className={`pill pill-${job.status}`}>{job.status.replace(/_/g, ' ')}</span>
                    {job.price != null && <span className="font-bold text-small">${job.price}</span>}
                  </div>
                </div>
                <div className="card-row" style={{ marginTop: '8px' }}>
                  <span className="text-small text-muted">
                    {view === 'completed'
                      ? (job.completed_at ? fmtDate((job.completed_at as string).split('T')[0]) : 'No completion date')
                      : (job.scheduled_date ? fmtDate(job.scheduled_date) : 'No date')}
                    {view === 'scheduled' && job.scheduled_time_window ? ` · ${job.scheduled_time_window}` : ''}
                  </span>
                  {job.status === 'completed' && (
                    <span className={`pill pill-${job.payment_status}`}>{job.payment_status.replace(/_/g, ' ')}</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}


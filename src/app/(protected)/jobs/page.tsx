import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const FILTERS = [
  ['upcoming', 'Upcoming'],
  ['today',    'Today'],
  ['week',     'This Week'],
  ['overdue',  'Overdue'],
  ['unpaid',   'Unpaid'],
] as const

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter = 'upcoming' } = await searchParams
  const supabase = await createClient()

  const today   = new Date().toISOString().split('T')[0]
  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 6)
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  const active = ['scheduled', 'in_progress', 'needs_reschedule']

  let query = supabase
    .from('jobs')
    .select('id, status, payment_status, price, scheduled_date, scheduled_time_window, service_package, customers(first_name, last_name), properties(service_address, city)')
    .order('scheduled_date', { ascending: true })

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
    case 'unpaid':
      query = query.eq('status', 'completed').eq('payment_status', 'unpaid')
      break
    default: // upcoming
      query = query.in('status', active).gte('scheduled_date', today)
  }

  const { data: jobs } = await query

  // ── Overdue unpaid count (completed + unpaid + >7 days old) ──
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const { count: overdueCount } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed')
    .eq('payment_status', 'unpaid')
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

  // Group week jobs by date, sorted by address (rough route order)
  type WeekJob = NonNullable<typeof jobs> extends (infer T)[] ? T : never
  const groupedByDay: Map<string, WeekJob[]> = new Map()
  if (filter === 'week' && jobs) {
    const sorted = [...jobs].sort((a, b) => {
      const da = a.scheduled_date ?? ''
      const db = b.scheduled_date ?? ''
      if (da !== db) return da.localeCompare(db)
      const pa = (Array.isArray(a.properties) ? a.properties[0] : a.properties) as { service_address?: string } | null
      const pb = (Array.isArray(b.properties) ? b.properties[0] : b.properties) as { service_address?: string } | null
      return (pa?.service_address ?? '').localeCompare(pb?.service_address ?? '')
    })
    for (const j of sorted) {
      const k = j.scheduled_date ?? 'unscheduled'
      if (!groupedByDay.has(k)) groupedByDay.set(k, [])
      groupedByDay.get(k)!.push(j)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Jobs</h1>
        <Link href="/jobs/new" className="btn btn-header btn-sm">+ New</Link>
      </div>

      <div className="filter-tabs">
        {FILTERS.map(([key, label]) => (
          <Link
            key={key}
            href={`/jobs?filter=${key}`}
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
      ) : filter === 'week' ? (
        <div>
          {Array.from(groupedByDay.entries()).map(([day, dayJobs]) => {
            const addresses = dayJobs
              .map(j => {
                const p = (Array.isArray(j.properties) ? j.properties[0] : j.properties) as { service_address: string; city: string | null } | null
                return p ? `${p.service_address}${p.city ? ', ' + p.city : ''}` : ''
              })
              .filter(Boolean)
            const url = routeUrl(addresses)
            const dayTotal = dayJobs.reduce((s, j) => s + (j.price ?? 0), 0)

            return (
              <div key={day} style={{ marginBottom: '1.25rem' }}>
                <div className="card-row" style={{ marginBottom: '8px' }}>
                  <div className="section-heading" style={{ marginBottom: 0 }}>
                    {day === 'unscheduled' ? 'Unscheduled' : fmtDate(day)} ({dayJobs.length})
                  </div>
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary">
                      🗺 Route · ${dayTotal.toFixed(0)}
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
            const c    = job.customers
            const p    = job.properties
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
                    {job.scheduled_date ? fmtDate(job.scheduled_date) : 'No date'}
                    {job.scheduled_time_window ? ` · ${job.scheduled_time_window}` : ''}
                  </span>
                  <span className={`pill pill-${job.payment_status}`}>{job.payment_status.replace(/_/g, ' ')}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}


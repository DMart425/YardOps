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

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Jobs</h1>
        <Link href="/jobs/new" className="btn btn-primary btn-sm">+ New</Link>
      </div>

      <div className="filter-tabs">
        {FILTERS.map(([key, label]) => (
          <Link
            key={key}
            href={`/jobs?filter=${key}`}
            className={`filter-tab${filter === key ? ' active' : ''}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {!jobs || jobs.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: '2rem' }}>📋</p>
          <p style={{ marginTop: '8px', fontWeight: 600 }}>No jobs here</p>
          <p>Try a different filter or create a new job.</p>
          <Link href="/jobs/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>+ New Job</Link>
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


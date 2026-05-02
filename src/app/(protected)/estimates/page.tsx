import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const STATUS_FILTERS = [
  ['all',       'All'],
  ['draft',     'Draft'],
  ['sent',      'Sent'],
  ['approved',  'Approved'],
  ['converted', 'Converted'],
  ['declined',  'Declined'],
] as const

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function EstimatesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter = 'all' } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('estimates')
    .select('id, status, total, valid_until, created_at, customers(first_name, last_name), properties(service_address, city)')
    .order('created_at', { ascending: false })

  if (filter !== 'all') {
    query = query.eq('status', filter)
  }

  const { data: estimates } = await query

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Estimates</h1>
        <Link href="/estimates/new" className="btn btn-header btn-sm">+ New</Link>
      </div>

      <div className="filter-tabs">
        {STATUS_FILTERS.map(([key, label]) => (
          <Link
            key={key}
            href={`/estimates?filter=${key}`}
            className={`filter-tab${filter === key ? ' active' : ''}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {!estimates || estimates.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: '2rem' }}>📋</p>
          <p style={{ marginTop: '8px', fontWeight: 600 }}>No estimates yet</p>
          <p>Create one to send pricing to a potential customer.</p>
          <Link href="/estimates/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>+ New Estimate</Link>
        </div>
      ) : (
        <div>
          {(estimates as any[]).map((est) => {
            const c    = est.customers
            const p    = est.properties
            const name = c ? `${c.first_name}${c.last_name ? ' ' + c.last_name : ''}` : '—'
            const addr = p ? `${p.service_address}${p.city ? ', ' + p.city : ''}` : '—'

            return (
              <Link key={est.id} href={`/estimates/${est.id}`} className="card card-link" style={{ display: 'block', marginBottom: '10px' }}>
                <div className="card-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="card-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    <div className="card-meta">{addr}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                    <span className={`pill pill-${est.status}`}>{est.status}</span>
                    <span className="font-bold text-small">${Number(est.total).toFixed(2)}</span>
                  </div>
                </div>
                <div className="card-row" style={{ marginTop: '8px' }}>
                  <span className="text-small text-muted">Created {fmtDate(est.created_at)}</span>
                  {est.valid_until && (
                    <span className="text-small text-muted">Valid until {fmtDate(est.valid_until)}</span>
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

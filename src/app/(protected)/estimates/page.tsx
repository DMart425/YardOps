import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDateOnly, formatTimestampDate, resolveTimeZone } from '@/lib/date'
import { formatFrequencyLabel } from '@/lib/frequency'
import { requireBusinessContext } from '@/lib/business/context'

const PAGE_SIZE = 50

type EstimateListRow = {
  id: string
  status: string
  total: number | null
  valid_until: string | null
  created_at: string
  frequency: string | null
  visit_scheduled_date: string | null
  visit_scheduled_time: string | null
  estimate_inputs: Record<string, unknown> | null
  revision_number: number
  customers: { first_name: string; last_name: string | null } | Array<{ first_name: string; last_name: string | null }> | null
  properties: { service_address: string; city: string | null } | Array<{ service_address: string; city: string | null }> | null
}

const STATUS_FILTERS = [
  ['all',       'All'],
  ['open',      'Open'],
  ['approved',  'Approved'],
  ['draft',     'Draft'],
  ['converted', 'Converted'],
  ['declined',  'Declined'],
] as const

function parsePage(raw: string | undefined): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 1
  const p = Math.floor(n)
  return p < 1 ? 1 : p
}

export default async function EstimatesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>
}) {
  const { filter = 'all', page: rawPage } = await searchParams
  const page = parsePage(rawPage)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('time_zone')
    .eq('user_id', userId)
    .maybeSingle()
  const timeZone = resolveTimeZone(settings?.time_zone)

  let query = supabase
    .from('estimates')
    .select('id, status, total, valid_until, created_at, frequency, visit_scheduled_date, visit_scheduled_time, estimate_inputs, revision_number, customers(first_name, last_name), properties(service_address, city)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (filter === 'open') {
    query = query.in('status', ['sent', 'approved', 'pending'])
  } else if (filter !== 'all') {
    query = query.eq('status', filter)
  }

  query = query.range(from, to)

  const { data: estimates } = await query
  const estimateRows = (estimates ?? []) as EstimateListRow[]
  const hasPrevPage = page > 1
  const hasNextPage = estimateRows.length === PAGE_SIZE
  const pageOneHref = `/estimates?filter=${filter}&page=1`

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
            href={`/estimates?filter=${key}&page=1`}
            className={`filter-tab${filter === key ? ' active' : ''}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {estimateRows.length === 0 ? (
        page > 1 ? (
          <div className="card" style={{ marginTop: '12px' }}>
            <p className="text-small text-muted">No estimates on this page.</p>
            <div style={{ marginTop: '10px' }}>
              <Link href={pageOneHref} className="btn btn-sm btn-secondary">Back to page 1</Link>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <p style={{ fontSize: '2rem' }}>📋</p>
            <p style={{ marginTop: '8px', fontWeight: 600 }}>No estimates yet</p>
            <p>Create one to send pricing to a potential customer.</p>
            <Link href="/estimates/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>+ New Estimate</Link>
          </div>
        )
      ) : (
        <div>
          {estimateRows.map((est) => {
            const rawC = est.customers
            const rawP = est.properties
            const c    = (Array.isArray(rawC) ? rawC[0] : rawC) as { first_name: string; last_name: string | null } | null
            const p    = (Array.isArray(rawP) ? rawP[0] : rawP) as { service_address: string; city: string | null } | null
            const inputs = est.estimate_inputs as { frequency?: string } | null
            const name = c ? `${c.first_name}${c.last_name ? ' ' + c.last_name : ''}` : '—'
            const addr = p ? `${p.service_address}${p.city ? ', ' + p.city : ''}` : '—'
            const frequency = inputs?.frequency ?? est.frequency
            const visitLabel = est.visit_scheduled_date
              ? `${formatDateOnly(est.visit_scheduled_date)}${est.visit_scheduled_time ? ` · ${est.visit_scheduled_time}` : ''}`
              : null

            return (
              <Link key={est.id} href={`/estimates/${est.id}`} className="card card-link" style={{ display: 'block', marginBottom: '10px' }}>
                <div className="card-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="card-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                      <div className="card-meta">📍 {addr}</div>
                      {frequency && <div className="card-meta">🌿 {formatFrequencyLabel(frequency)}</div>}
                      <div className="card-meta">🗓 Created {formatTimestampDate(est.created_at, timeZone, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      {est.valid_until && <div className="card-meta">⏳ Valid until {formatDateOnly(est.valid_until)}</div>}
                      {visitLabel && <div className="card-meta">📅 Visit {visitLabel}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                    <span className={`pill pill-${est.status}`}>{est.status}</span>
                    {est.revision_number > 1 && <span className="pill pill-draft">v{est.revision_number}</span>}
                    <span className="font-bold text-small">${Number(est.total).toFixed(2)}</span>
                  </div>
                </div>
              </Link>
            )
          })}

          <div className="card-row" style={{ marginTop: '12px' }}>
            <div>
              {hasPrevPage ? (
                <Link href={`/estimates?filter=${filter}&page=${page - 1}`} className="btn btn-sm btn-secondary">
                  Previous
                </Link>
              ) : null}
            </div>
            <div className="text-small text-muted">Page {page}</div>
            <div>
              {hasNextPage ? (
                <Link href={`/estimates?filter=${filter}&page=${page + 1}`} className="btn btn-sm btn-secondary">
                  Next
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Customer } from '@/types/database'
import { formatDateOnly, getLocalDateStr, resolveTimeZone } from '@/lib/date'
import { formatFrequencyLabel } from '@/lib/frequency'
import { requireBusinessContext } from '@/lib/business/context'

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

const PAGE_SIZE = 50

function parsePage(raw: string | undefined): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 1
  const p = Math.floor(n)
  return p < 1 ? 1 : p
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const page = parsePage(sp.page)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE

  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const { data: tzSettings } = await supabase
    .from('pricing_settings')
    .select('time_zone')
    .eq('user_id', userId)
    .maybeSingle()
  const timeZone = resolveTimeZone(tzSettings?.time_zone)
  const today = getLocalDateStr(timeZone)

  let customersQuery = supabase
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
    .eq('business_id', businessId)
    .in('status', ['active', 'inactive'])
    .order('first_name', { ascending: true })
    .range(from, to)

  if (q) {
    const qSafe = q.replace(/[,()]/g, ' ')
    const pattern = `%${qSafe}%`
    customersQuery = customersQuery.or([
      `first_name.ilike.${pattern}`,
      `last_name.ilike.${pattern}`,
      `phone.ilike.${pattern}`,
      `email.ilike.${pattern}`,
    ].join(','))
  }

  const { data: customers } = await customersQuery

  const customerRowsAll = (customers ?? []) as CustomerListItem[]
  const hasNextPage = customerRowsAll.length > PAGE_SIZE
  const customerRows = customerRowsAll.slice(0, PAGE_SIZE)
  const hasPrevPage = page > 1

  const displayedCustomerIds = customerRows.map(c => c.id)
  let upcomingJobs: UpcomingJob[] = []
  const unpaidBalanceMap = new Map<string, number>()
  if (displayedCustomerIds.length > 0) {
    const [{ data: jobs }, { data: unpaidJobsData }] = await Promise.all([
      supabase
        .from('jobs')
        .select('customer_id, scheduled_date, scheduled_time_window')
        .eq('business_id', businessId)
        .in('status', ['scheduled', 'in_progress', 'needs_reschedule'])
        .gte('scheduled_date', today)
        .in('customer_id', displayedCustomerIds)
        .order('scheduled_date', { ascending: true }),
      supabase
        .from('jobs')
        .select('customer_id, price, amount_paid')
        .eq('business_id', businessId)
        .eq('status', 'completed')
        .in('payment_status', ['unpaid', 'partial'])
        .in('customer_id', displayedCustomerIds),
    ])
    upcomingJobs = (jobs ?? []) as UpcomingJob[]
    for (const j of unpaidJobsData ?? []) {
      const balance = Math.max(0, Number(j.price ?? 0) - Number(j.amount_paid ?? 0))
      if (balance > 0) {
        const cid = j.customer_id as string
        unpaidBalanceMap.set(cid, (unpaidBalanceMap.get(cid) ?? 0) + balance)
      }
    }
  }

  function customersHref(targetPage: number): string {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    params.set('page', String(targetPage))
    return `/customers?${params.toString()}`
  }

  const pageOneHref = q ? `/customers?q=${encodeURIComponent(q)}&page=1` : '/customers?page=1'

  // Build map: customer_id -> soonest upcoming job (already ordered ascending)
  const nextJobMap = new Map<string, UpcomingJob>()
  for (const job of upcomingJobs) {
    if (!nextJobMap.has(job.customer_id)) {
      nextJobMap.set(job.customer_id, job)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{q ? 'Search results' : `Showing up to ${PAGE_SIZE} customers`}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '12px' }}>
        <form method="get" className="card-row" style={{ gap: '8px' }}>
          <input
            name="q"
            defaultValue={q}
            className="form-input"
            placeholder="Search name, phone, or email"
            aria-label="Search customers"
          />
          <input type="hidden" name="page" value="1" />
          <button type="submit" className="btn btn-sm btn-secondary">Search</button>
          {q ? <Link href="/customers" className="btn btn-sm btn-secondary">Clear</Link> : null}
        </form>
      </div>

      {customerRows.length === 0 ? (
        page > 1 ? (
          <div className="card" style={{ marginTop: '12px' }}>
            <p className="text-small text-muted">No customers on this page.</p>
            <div style={{ marginTop: '10px' }}>
              <Link href={pageOneHref} className="btn btn-sm btn-secondary">Back to page 1</Link>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <p style={{ fontSize: '2rem' }}>👷</p>
            <p style={{ fontWeight: 600, marginTop: '8px' }}>No customers yet</p>
            <p>New contacts start as leads. Add a lead first, then promote them to active customer after an estimate is approved.</p>
            <Link href="/leads/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Add Lead
            </Link>
          </div>
        )
      ) : (
        <div>
          {customerRows.map((c) => {
            const unpaidBalance = unpaidBalanceMap.get(c.id) ?? 0
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
              ? formatDateOnly(nextJob.scheduled_date) +
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
                    {unpaidBalance > 0 && (
                      <div className="card-meta" style={{ color: 'var(--color-unpaid, #f97316)', fontWeight: 600 }}>
                        💰 ${unpaidBalance % 1 === 0 ? unpaidBalance.toFixed(0) : unpaidBalance.toFixed(2)} unpaid
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}

          <div className="card-row" style={{ marginTop: '12px' }}>
            <div>
              {hasPrevPage ? (
                <Link href={customersHref(page - 1)} className="btn btn-sm btn-secondary">Previous</Link>
              ) : null}
            </div>
            <div className="text-small text-muted">Page {page}</div>
            <div>
              {hasNextPage ? (
                <Link href={customersHref(page + 1)} className="btn btn-sm btn-secondary">Next</Link>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

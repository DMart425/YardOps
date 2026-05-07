import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatFrequencyLabel, formatServiceInterestLabel, parseWebsiteServiceInterests } from '@/lib/frequency'

const PAGE_SIZE = 50

function parsePage(value?: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return Math.floor(parsed)
}

function cleanSearch(value?: string): string {
  return (value ?? '').trim()
}

function buildLeadsHref(args: { view: string; q: string; page?: number }) {
  const params = new URLSearchParams()
  if (args.view && args.view !== 'active') params.set('view', args.view)
  if (args.q) params.set('q', args.q)
  if ((args.page ?? 1) > 1) params.set('page', String(args.page))
  const qs = params.toString()
  return qs ? `/leads?${qs}` : '/leads'
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; q?: string; view?: string; page?: string }>
}) {
  const { search = '', q = '', view = 'active', page: rawPage } = await searchParams
  const searchQuery = cleanSearch(q || search)
  const page = parsePage(rawPage)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE
  const supabase = await createClient()

  // Fetch website leads: by default show 'new', but allow viewing 'converted' or 'archived'
  const websiteStatusFilter = view === 'archived' ? 'archived' : view === 'converted' ? 'converted' : 'new'
  const isActiveView = view === 'active' || !view
  const safeSearch = searchQuery.replaceAll(',', ' ').trim()
  const websiteQuery = supabase
    .from('leads')
    .select('id, name, phone, email, address, frequency, notes, created_at, status')
    .eq('status', websiteStatusFilter)
    .order('created_at', { ascending: false })
    .range(from, to)
  const manualQuery = supabase
    .from('customers')
    .select(`
      id, first_name, last_name, phone, email, notes, created_at,
      properties ( id, service_address, city, service_frequency )
    `)
    .eq('status', 'lead')
    .order('created_at', { ascending: false })
    .range(from, to)

  if (safeSearch) {
    websiteQuery.or(`name.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,address.ilike.%${safeSearch}%,notes.ilike.%${safeSearch}%,frequency.ilike.%${safeSearch}%`)
    manualQuery.or(`first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,notes.ilike.%${safeSearch}%`)
  }

  const [{ data: websiteLeadRows }, manualResult] = await Promise.all([
    websiteQuery,
    isActiveView ? manualQuery : Promise.resolve({ data: [] as Array<unknown> }),
  ])

  const websiteRows = websiteLeadRows ?? []
  const manualRows = (manualResult.data ?? []) as Array<{
    id: string
    first_name: string
    last_name: string | null
    phone: string | null
    email: string | null
    notes: string | null
    created_at: string
    properties: Array<{
      id: string
      service_address: string
      city: string | null
      service_frequency: string
    }> | null
  }>
  const websiteHasNextPage = websiteRows.length > PAGE_SIZE
  const manualHasNextPage = manualRows.length > PAGE_SIZE
  const hasNextPage = websiteHasNextPage || (isActiveView && manualHasNextPage)

  const filteredWebsiteLeads = websiteRows.slice(0, PAGE_SIZE)
  const filteredManualLeads = manualRows.slice(0, PAGE_SIZE)

  const websiteCount = filteredWebsiteLeads.length
  const manualCount = filteredManualLeads.length
  const totalCount = websiteCount + (isActiveView ? manualCount : 0)
  const noRowsOnPage = totalCount === 0

  // Helper: Get service interests from notes
  const getServiceInterests = (notes: string | null): string[] => {
    const interests = parseWebsiteServiceInterests(notes)
    return Array.from(interests)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-subtitle">
            {searchQuery
              ? `Search results · Page ${page}`
              : view === 'converted'
                ? `Converted website leads · Page ${page}`
                : view === 'archived'
                  ? `Archived website leads · Page ${page}`
                  : `Showing up to ${PAGE_SIZE} leads per source · Page ${page}`}
          </p>
        </div>
        <Link href="/leads/new" className="btn btn-header btn-sm">+ New Lead</Link>
      </div>

      {/* Search Input */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <form method="get" style={{ display: 'flex', gap: '8px' }}>
          {view && <input type="hidden" name="view" value={view} />}
          <input
            type="text"
            name="q"
            placeholder="Search by name, phone, or address…"
            defaultValue={searchQuery}
            className="form-input"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-sm btn-primary">Search</button>
          {searchQuery && (
            <Link href={buildLeadsHref({ view, q: '', page: 1 })} className="btn btn-sm btn-secondary">
              Clear
            </Link>
          )}
        </form>
      </div>

      {/* View Tabs */}
      <div className="filter-tabs" style={{ marginBottom: '1rem' }}>
        <Link
          href={buildLeadsHref({ view: 'active', q: searchQuery, page: 1 })}
          className={`filter-tab${view === 'active' || !view ? ' active' : ''}`}
        >
          Active
        </Link>
        <Link
          href={buildLeadsHref({ view: 'converted', q: searchQuery, page: 1 })}
          className={`filter-tab${view === 'converted' ? ' active' : ''}`}
        >
          Converted
        </Link>
        <Link
          href={buildLeadsHref({ view: 'archived', q: searchQuery, page: 1 })}
          className={`filter-tab${view === 'archived' ? ' active' : ''}`}
        >
          Archived
        </Link>
      </div>

      {page > 1 && noRowsOnPage ? (
        <div className="empty-state">
          <p style={{ fontSize: '2rem' }}>📄</p>
          <p style={{ fontWeight: 600, marginTop: '8px' }}>No leads on this page</p>
          <p>Try going back to the first page.</p>
          <Link href={buildLeadsHref({ view, q: searchQuery, page: 1 })} className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Back to page 1
          </Link>
        </div>
      ) : noRowsOnPage ? (
        <div className="empty-state">
          <p style={{ fontSize: '2rem' }}>🌱</p>
          <p style={{ fontWeight: 600, marginTop: '8px' }}>{searchQuery ? 'No leads found' : view === 'converted' ? 'No converted website leads' : view === 'archived' ? 'No archived website leads' : 'No pending leads'}</p>
          {searchQuery ? (
            <p>Try a different search term.</p>
          ) : view === 'converted' ? (
            <p>Website leads that have been converted to customers will appear here.</p>
          ) : view === 'archived' ? (
            <p>Dismissed or archived website leads will appear here.</p>
          ) : (
            <p>Website quote requests and manually added leads will appear here.</p>
          )}
          {view === 'active' && (
            <Link href="/leads/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Add a Lead
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Website leads */}
          {websiteCount > 0 && (
            <div className="detail-section">
              <div className="section-heading">
                {view === 'converted' ? 'Converted Website Leads' : view === 'archived' ? 'Archived Website Leads' : 'From Website'} ({websiteCount})
              </div>
              {filteredWebsiteLeads!.map((lead) => {
                const frequency = formatFrequencyLabel(lead.frequency)
                const serviceInterests = getServiceInterests(lead.notes)
                return (
                  <div key={lead.id} style={{ position: 'relative', marginBottom: '8px' }}>
                    <Link href={`/leads/website/${lead.id}`} style={{ display: 'block' }}>
                      <div className="card" style={{ margin: 0 }}>
                        <div className="card-row">
                          <div style={{ flex: 1 }}>
                            <div className="card-title">{lead.name}</div>
                            <div className="card-subtitle">{lead.address}</div>
                            {lead.phone && <div className="card-meta">📞 {lead.phone}</div>}
                            {frequency !== 'Not specified' && (
                              <div className="card-meta" style={{ marginTop: '4px' }}>📅 {frequency}</div>
                            )}
                            {serviceInterests.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                                {serviceInterests.map((interest) => (
                                  <span key={interest} className="pill pill-draft" style={{ fontSize: '0.75rem' }}>
                                    {formatServiceInterestLabel(interest)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0, paddingRight: '8px' }}>
                            <span className="pill pill-lead">Website</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                )
              })}
            </div>
          )}

          {/* Manual leads — only show on Active tab */}
          {isActiveView && manualCount > 0 && (
            <div className="detail-section">
              <div className="section-heading">Manual Leads ({manualCount})</div>
              {filteredManualLeads!.map((c) => {
                const props = c.properties as Array<{
                  id: string
                  service_address: string
                  city: string | null
                  service_frequency: string
                }> | null
                const prop = props?.[0]
                return (
                  <Link key={c.id} href={`/leads/${c.id}`} style={{ display: 'block' }}>
                    <div className="card">
                      <div className="card-row">
                        <div style={{ flex: 1 }}>
                          <div className="card-title">
                            {c.first_name}{c.last_name ? ` ${c.last_name}` : ''}
                          </div>
                          <div className="card-meta">Customer record</div>
                          {prop && (
                            <div className="card-subtitle">
                              {prop.service_address}{prop.city ? `, ${prop.city}` : ''}
                            </div>
                          )}
                          {c.phone && <div className="card-meta">📞 {c.phone}</div>}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span className="pill pill-lead">Lead</span>
                          {prop && (
                            <div className="card-meta" style={{ marginTop: '4px' }}>
                              {formatFrequencyLabel(prop.service_frequency)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          <div className="card" style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span className="text-small text-muted">Page {page}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {page > 1 ? (
                  <Link href={buildLeadsHref({ view, q: searchQuery, page: page - 1 })} className="btn btn-sm btn-secondary">
                    Previous
                  </Link>
                ) : (
                  <span className="btn btn-sm btn-secondary" style={{ opacity: 0.5, pointerEvents: 'none' }}>
                    Previous
                  </span>
                )}
                {hasNextPage ? (
                  <Link href={buildLeadsHref({ view, q: searchQuery, page: page + 1 })} className="btn btn-sm btn-secondary">
                    Next
                  </Link>
                ) : (
                  <span className="btn btn-sm btn-secondary" style={{ opacity: 0.5, pointerEvents: 'none' }}>
                    Next
                  </span>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

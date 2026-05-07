import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatFrequencyLabel, formatServiceInterestLabel, parseWebsiteServiceInterests } from '@/lib/frequency'

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; view?: string }>
}) {
  const { search = '', view = 'active' } = await searchParams
  const searchQuery = (search || '').trim().toLowerCase()
  const supabase = await createClient()

  // Fetch website leads: by default show 'new', but allow viewing 'converted' or 'archived'
  const websiteStatusFilter = view === 'archived' ? 'archived' : view === 'converted' ? 'converted' : 'new'
  const [{ data: websiteLeads }, { data: manualLeads }] = await Promise.all([
    supabase
      .from('leads')
      .select('id, name, phone, address, frequency, notes, created_at, status')
      .eq('status', websiteStatusFilter)
      .order('created_at', { ascending: false }),
    supabase
      .from('customers')
      .select(`
        id, first_name, last_name, phone, email, created_at,
        properties ( id, service_address, city, service_frequency )
      `)
      .eq('status', 'lead')
      .order('created_at', { ascending: false }),
  ])

  // Client-side filtering by search query
  const filteredWebsiteLeads = (websiteLeads ?? []).filter((lead) => {
    if (!searchQuery) return true
    const name = (lead.name || '').toLowerCase()
    const phone = (lead.phone || '').toLowerCase()
    const address = (lead.address || '').toLowerCase()
    return name.includes(searchQuery) || phone.includes(searchQuery) || address.includes(searchQuery)
  })

  const filteredManualLeads = (manualLeads ?? []).filter((c) => {
    if (!searchQuery) return true
    const name = `${c.first_name}${c.last_name ? ` ${c.last_name}` : ''}`.toLowerCase()
    const phone = (c.phone || '').toLowerCase()
    const email = (c.email || '').toLowerCase()
    const address = (c.properties?.[0]?.service_address || '').toLowerCase()
    return name.includes(searchQuery) || phone.includes(searchQuery) || email.includes(searchQuery) || address.includes(searchQuery)
  })

  const websiteCount = filteredWebsiteLeads.length
  const manualCount = filteredManualLeads.length
  const totalCount = websiteCount + manualCount

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
            {view === 'converted' ? `${websiteCount} converted website leads` : view === 'archived' ? `${websiteCount} archived website leads` : `${totalCount} ${totalCount === 1 ? 'pending lead' : 'pending leads'}`}
          </p>
        </div>
        <Link href="/leads/new" className="btn btn-header btn-sm">+ New Lead</Link>
      </div>

      {/* Search Input */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <form method="get" style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            name="search"
            placeholder="Search by name, phone, or address…"
            defaultValue={search}
            className="form-input"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-sm btn-primary">Search</button>
          {search && (
            <Link href="/leads" className="btn btn-sm btn-secondary">
              Clear
            </Link>
          )}
        </form>
      </div>

      {/* View Tabs */}
      <div className="filter-tabs" style={{ marginBottom: '1rem' }}>
        <Link
          href={`/leads?view=active${search ? `&search=${encodeURIComponent(search)}` : ''}`}
          className={`filter-tab${view === 'active' || !view ? ' active' : ''}`}
        >
          Active
        </Link>
        <Link
          href={`/leads?view=converted${search ? `&search=${encodeURIComponent(search)}` : ''}`}
          className={`filter-tab${view === 'converted' ? ' active' : ''}`}
        >
          Converted
        </Link>
        <Link
          href={`/leads?view=archived${search ? `&search=${encodeURIComponent(search)}` : ''}`}
          className={`filter-tab${view === 'archived' ? ' active' : ''}`}
        >
          Archived
        </Link>
      </div>

      {totalCount === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: '2rem' }}>🌱</p>
          <p style={{ fontWeight: 600, marginTop: '8px' }}>
            {searchQuery ? 'No leads found' : view === 'converted' ? 'No converted website leads' : view === 'archived' ? 'No archived website leads' : 'No pending leads'}
          </p>
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
          {(view === 'active' || !view) && manualCount > 0 && (
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
        </>
      )}
    </div>
  )
}

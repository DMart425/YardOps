import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function LeadsPage() {
  const supabase = await createClient()

  const [{ data: websiteLeads }, { data: manualLeads }] = await Promise.all([
    supabase
      .from('leads')
      .select('id, name, phone, address, frequency, created_at')
      .eq('status', 'new')
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

  const websiteCount = websiteLeads?.length ?? 0
  const manualCount = manualLeads?.length ?? 0
  const totalCount = websiteCount + manualCount

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-subtitle">{totalCount} pending</p>
        </div>
        <Link href="/leads/new" className="btn btn-header btn-sm">+ New Lead</Link>
      </div>

      {totalCount === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: '2rem' }}>🌱</p>
          <p style={{ fontWeight: 600, marginTop: '8px' }}>No pending leads</p>
          <p>Website quote requests and manually added leads will appear here.</p>
          <Link href="/leads/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Add a Lead
          </Link>
        </div>
      ) : (
        <>
          {/* Website leads */}
          {websiteCount > 0 && (
            <div className="detail-section">
              <div className="section-heading">From Website ({websiteCount})</div>
              {websiteLeads!.map((lead) => (
                <div key={lead.id} style={{ position: 'relative', marginBottom: '8px' }}>
                  <Link href={`/leads/website/${lead.id}`} style={{ display: 'block' }}>
                    <div className="card" style={{ margin: 0 }}>
                      <div className="card-row">
                        <div>
                          <div className="card-title">{lead.name}</div>
                          <div className="card-subtitle">{lead.address}</div>
                          {lead.phone && <div className="card-meta">📞 {lead.phone}</div>}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, paddingRight: '32px' }}>
                          <span className="pill pill-lead">Website</span>
                          {lead.frequency && (
                            <div className="card-meta" style={{ marginTop: '4px' }}>{lead.frequency}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* Manual leads */}
          {manualCount > 0 && (
            <div className="detail-section">
              <div className="section-heading">Manual Leads ({manualCount})</div>
              {manualLeads!.map((c) => {
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
                        <div>
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
                              {prop.service_frequency.replace(/_/g, ' ')}
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

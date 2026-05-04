import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmt$(n: number) {
  return '$' + n.toFixed(2).replace(/\.00$/, '')
}

export default async function CustomerPortalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase  = createAdminClient()

  // Look up token → customer_id + created_by (for profile)
  const { data: portalRow } = await supabase
    .from('customer_portal_tokens')
    .select('customer_id, created_by')
    .eq('token', token)
    .single()

  if (!portalRow) notFound()

  const { customer_id, created_by } = portalRow

  // Parallel fetches
  const [
    { data: customer },
    { data: profile },
    { data: jobs },
    { data: pricing },
  ] = await Promise.all([
    supabase
      .from('customers')
      .select('first_name, last_name')
      .eq('id', customer_id)
      .single(),
    supabase
      .from('profiles')
      .select('business_name, business_phone')
      .eq('id', created_by)
      .single(),
    supabase
      .from('jobs')
      .select('id, status, payment_status, price, amount_paid, scheduled_date, completed_at, service_package')
      .eq('customer_id', customer_id)
      .order('scheduled_date', { ascending: false })
      .limit(30),
    supabase
      .from('pricing_settings')
      .select('venmo_handle')
      .eq('user_id', created_by)
      .single(),
  ])

  if (!customer) notFound()

  const businessName  = profile?.business_name  ?? 'Your Lawn Service'
  const businessPhone = profile?.business_phone ?? null
  const venmoHandle   = (pricing?.venmo_handle as string | null) ?? null

  const allJobs       = jobs ?? []
  const upcoming      = allJobs.filter(j => j.status === 'scheduled' || j.status === 'in_progress')
    .sort((a, b) => (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? ''))
  const history       = allJobs.filter(j => j.status === 'completed')
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
    .slice(0, 10)
  const totalUnpaid   = history
    .filter(j => j.payment_status !== 'paid')
    .reduce((s, j) => s + Math.max(0, (j.price ?? 0) - (j.amount_paid ?? 0)), 0)

  const pkgLabel = (pkg: string | null) =>
    pkg ? pkg.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Lawn Service'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg, #f9fafb)', padding: '1.5rem 1rem', maxWidth: '480px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--color-primary, #16a34a)' }}>{businessName}</div>
        {businessPhone && (
          <a href={`tel:${businessPhone}`} style={{ color: 'inherit', textDecoration: 'none', fontSize: '0.875rem', opacity: 0.7 }}>
            {businessPhone}
          </a>
        )}
        <div style={{ marginTop: '0.75rem', fontWeight: 600, fontSize: '1.0625rem' }}>Hi, {customer.first_name}!</div>
        <div style={{ fontSize: '0.8125rem', opacity: 0.6 }}>Here&apos;s a summary of your lawn service account.</div>
      </div>

      {/* Outstanding balance */}
      {totalUnpaid > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8125rem', color: '#991b1b', marginBottom: '4px' }}>Outstanding Balance</div>
          <div style={{ fontWeight: 700, fontSize: '1.5rem', color: '#dc2626', marginBottom: '0.75rem' }}>{fmt$(totalUnpaid)}</div>
          {venmoHandle && (
            <a
              href={`https://venmo.com/${venmoHandle}?txn=pay&amount=${totalUnpaid.toFixed(2)}&note=${encodeURIComponent('Lawn service')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', background: '#3d95ce', color: '#fff', fontWeight: 700, fontSize: '0.9375rem', borderRadius: '8px', padding: '10px 24px', textDecoration: 'none' }}
            >
              Pay Now with Venmo
            </a>
          )}
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '8px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Upcoming</div>
          {upcoming.map(j => (
            <div key={j.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '0.875rem 1rem', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{pkgLabel(j.service_package)}</div>
                <div style={{ fontSize: '0.8125rem', opacity: 0.6, marginTop: '2px' }}>
                  {j.scheduled_date ? fmtDate(j.scheduled_date) : 'Date TBD'}
                </div>
              </div>
              {j.status === 'in_progress' && (
                <span style={{ background: '#dcfce7', color: '#15803d', borderRadius: '999px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600 }}>En Route</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '8px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Service History</div>
          {history.map(j => {
            const paid   = (j.amount_paid ?? 0) >= (j.price ?? 0)
            const unpaid = Math.max(0, (j.price ?? 0) - (j.amount_paid ?? 0))
            return (
              <div key={j.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '0.875rem 1rem', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{pkgLabel(j.service_package)}</div>
                  <div style={{ fontSize: '0.8125rem', opacity: 0.6, marginTop: '2px' }}>
                    {j.completed_at ? fmtDate(j.completed_at.split('T')[0]) : '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {j.price != null && (
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{fmt$(j.price)}</div>
                  )}
                  {!paid && unpaid > 0 ? (
                    <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 500 }}>Unpaid</div>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 500 }}>Paid</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {upcoming.length === 0 && history.length === 0 && (
        <div style={{ textAlign: 'center', opacity: 0.5, padding: '2rem 0' }}>No service history yet.</div>
      )}

      {/* Reschedule contact */}
      {businessPhone && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '4px' }}>Need to reschedule?</div>
          <div style={{ fontSize: '0.8125rem', opacity: 0.6, marginBottom: '0.75rem' }}>Give us a call or send a text</div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <a
              href={`tel:${businessPhone}`}
              style={{ flex: 1, maxWidth: '160px', display: 'block', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none', textAlign: 'center' }}
            >
              📞 Call Us
            </a>
            <a
              href={`sms:${businessPhone}`}
              style={{ flex: 1, maxWidth: '160px', display: 'block', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none', textAlign: 'center' }}
            >
              💬 Text Us
            </a>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: '0.75rem', opacity: 0.4, marginTop: '2rem' }}>
        Powered by YardOps
      </div>
    </div>
  )
}

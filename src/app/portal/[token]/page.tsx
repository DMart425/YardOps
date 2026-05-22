import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatTimestampDate, resolveTimeZone } from '@/lib/date'
import { formatPhoneInput } from '@/lib/format'

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmt$(n: number) {
  return '$' + n.toFixed(2).replace(/\.00$/, '')
}

const SERVICE_LABELS: Record<string, string> = {
  mow_only:      'Mow Only',
  mow_trim_blow: 'Mow, Trim & Blow',
  trim_cleanup:  'Trim & Cleanup',
  full_service:  'Full Service',
}

type PropertyBooleans = {
  default_mowing_enabled?: boolean | null
  default_weed_eating_enabled?: boolean | null
  default_edging_enabled?: boolean | null
  default_blow_off_enabled?: boolean | null
}

function serviceLabel(pkg: string | null | undefined, prop: PropertyBooleans | null | undefined): string {
  if (prop) {
    const parts: string[] = []
    if (prop.default_mowing_enabled)      parts.push('Mowing')
    if (prop.default_weed_eating_enabled) parts.push('Weed Eating')
    if (prop.default_edging_enabled)      parts.push('Edging')
    if (prop.default_blow_off_enabled)    parts.push('Blow Off')
    if (parts.length > 0) return parts.join(', ')
  }
  if (!pkg) return 'Lawn Service'
  return SERVICE_LABELS[pkg] ?? pkg.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

export default async function CustomerPortalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase  = createAdminClient()

  // Look up token → customer_id + created_by (for profile) + business_id (for scoping)
  const { data: portalRow } = await supabase
    .from('customer_portal_tokens')
    .select('customer_id, created_by, business_id')
    .eq('token', token)
    .single()

  if (!portalRow) notFound()

  const { customer_id, created_by, business_id } = portalRow

  // Parallel fetches
  const [
    { data: customer },
    { data: profile },
    { data: businessRow },
    { data: jobs },
    { data: pricing },
    { data: properties },
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
      .from('businesses')
      .select('name, phone')
      .eq('id', business_id)
      .single(),
    supabase
      .from('jobs')
      .select('id, status, payment_status, price, amount_paid, scheduled_date, completed_at, service_package, property_id')
      .eq('customer_id', customer_id)
      .eq('business_id', business_id)
      .order('scheduled_date', { ascending: false })
      .limit(30),
    supabase
      .from('pricing_settings')
      .select('venmo_handle, time_zone')
      .eq('user_id', created_by)
      .maybeSingle(),
    supabase
      .from('properties')
      .select('id, default_mowing_enabled, default_weed_eating_enabled, default_edging_enabled, default_blow_off_enabled')
      .eq('customer_id', customer_id)
      .eq('business_id', business_id),
  ])

  if (!customer) notFound()

  const businessName    = businessRow?.name  ?? profile?.business_name  ?? 'Your Lawn Service'
  const rawBusinessPhone = businessRow?.phone ?? profile?.business_phone ?? null
  const businessPhone   = rawBusinessPhone ? formatPhoneInput(rawBusinessPhone) : null
  const venmoHandle   = (pricing?.venmo_handle as string | null) ?? null
  const timeZone = resolveTimeZone(pricing?.time_zone)

  const propertyMap = new Map<string, PropertyBooleans>(
    (properties ?? []).map(p => [p.id as string, p as PropertyBooleans])
  )

  const allJobs  = jobs ?? []
  const upcoming = allJobs.filter(j => j.status === 'scheduled' || j.status === 'in_progress')
    .sort((a, b) => (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? ''))
  const history  = allJobs.filter(j => j.status === 'completed')
    .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
    .slice(0, 10)
  const totalUnpaid = history
    .filter(j => j.payment_status !== 'paid')
    .reduce((s, j) => s + Math.max(0, (j.price ?? 0) - (j.amount_paid ?? 0)), 0)

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg)',
      color: 'var(--color-text)',
      fontFamily: 'var(--font)',
      padding: '0 1rem 3rem',
      maxWidth: '480px',
      margin: '0 auto',
    }}>

      {/* Branded top bar */}
      <div style={{
        height: '4px',
        background: 'var(--color-primary)',
        marginLeft: '-1rem',
        marginRight: '-1rem',
        marginBottom: '1.75rem',
      }} />

      {/* Header */}
      <div style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
        <div style={{
          fontWeight: 800,
          fontSize: '1.25rem',
          color: 'var(--color-primary)',
          letterSpacing: '-0.02em',
        }}>
          {businessName}
        </div>
        {businessPhone && (
          <a
            href={`tel:${businessPhone}`}
            style={{ color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '0.875rem' }}
          >
            {businessPhone}
          </a>
        )}
        <div style={{ marginTop: '0.875rem', fontWeight: 600, fontSize: '1.0625rem', color: 'var(--color-text)' }}>
          Hi, {customer.first_name}!
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
          Here&apos;s a summary of your lawn service account.
        </div>
      </div>

      {/* Outstanding balance */}
      {totalUnpaid > 0 && (
        <div style={{
          background: 'var(--color-danger-bg)',
          border: '1px solid #7f1d1d',
          borderRadius: 'var(--r-md)',
          padding: '1rem',
          marginBottom: '1.25rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-danger)', marginBottom: '4px' }}>
            Outstanding Balance
          </div>
          <div style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--color-danger)', marginBottom: '0.75rem' }}>
            {fmt$(totalUnpaid)}
          </div>
          {venmoHandle && (
            <a
              href={`https://venmo.com/${venmoHandle}?txn=pay&amount=${totalUnpaid.toFixed(2)}&note=${encodeURIComponent('Lawn service')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                background: '#3d95ce',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.9375rem',
                borderRadius: 'var(--r-sm)',
                padding: '10px 24px',
                textDecoration: 'none',
              }}
            >
              Pay Now with Venmo
            </a>
          )}
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{
            fontWeight: 700,
            fontSize: '0.75rem',
            marginBottom: '8px',
            color: 'var(--color-text-light)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            Upcoming
          </div>
          {upcoming.map(j => (
            <div key={j.id} style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--r-md)',
              padding: '0.875rem 1rem',
              marginBottom: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text)' }}>
                  {serviceLabel(j.service_package, propertyMap.get(j.property_id as string) ?? null)}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {j.scheduled_date ? fmtDate(j.scheduled_date) : 'Date TBD'}
                </div>
              </div>
              {j.status === 'in_progress' && (
                <span style={{
                  background: 'var(--color-inprogress-bg)',
                  color: 'var(--color-inprogress)',
                  borderRadius: '999px',
                  padding: '3px 10px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  En Route
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Service History */}
      {history.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{
            fontWeight: 700,
            fontSize: '0.75rem',
            marginBottom: '8px',
            color: 'var(--color-text-light)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            Service History
          </div>
          {history.map(j => {
            const price     = Number(j.price ?? 0)
            const amtPaid   = Number(j.amount_paid ?? 0)
            const remaining = Math.max(0, price - amtPaid)
            const ps        = j.payment_status as string | null

            let amountLine  = ''
            let subtextLine: string | null = null
            let pillLabel   = ''
            let pillBg      = ''
            let pillColor   = ''
            let amountColor = ''

            if (ps === 'not_billable') {
              amountLine  = 'No payment due'
              pillLabel   = 'Not Billable'
              pillBg      = 'rgba(0,0,0,0.06)'
              pillColor   = 'var(--color-text-muted)'
              amountColor = 'var(--color-text-muted)'
            } else if (ps === 'paid') {
              amountLine  = price > 0 ? `${fmt$(price)} paid` : 'Paid'
              pillLabel   = 'Paid'
              pillBg      = 'var(--color-paid-bg)'
              pillColor   = 'var(--color-paid)'
              amountColor = 'var(--color-text)'
            } else if (ps === 'partial') {
              amountLine  = `${fmt$(remaining)} remaining`
              subtextLine = price > 0 ? `${fmt$(amtPaid)} paid of ${fmt$(price)}` : null
              pillLabel   = 'Partial'
              pillBg      = 'var(--color-unpaid-bg)'
              pillColor   = 'var(--color-unpaid)'
              amountColor = 'var(--color-unpaid)'
            } else {
              // unpaid (or null/unknown)
              if (amtPaid > 0) {
                amountLine  = `${fmt$(remaining)} remaining`
                subtextLine = `${fmt$(amtPaid)} paid`
              } else {
                amountLine = price > 0 ? `${fmt$(price)} due` : 'Unpaid'
              }
              pillLabel   = 'Unpaid'
              pillBg      = 'var(--color-unpaid-bg)'
              pillColor   = 'var(--color-unpaid)'
              amountColor = 'var(--color-unpaid)'
            }

            return (
              <div key={j.id} style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--r-md)',
                padding: '0.875rem 1rem',
                marginBottom: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.9375rem', color: 'var(--color-text)' }}>
                    {serviceLabel(j.service_package, propertyMap.get(j.property_id as string) ?? null)}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {j.completed_at
                      ? formatTimestampDate(j.completed_at, timeZone, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '0.75rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: amountColor }}>
                    {amountLine}
                  </div>
                  {subtextLine && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                      {subtextLine}
                    </div>
                  )}
                  <span style={{
                    display: 'inline-block',
                    marginTop: '3px',
                    background: pillBg,
                    color: pillColor,
                    borderRadius: '999px',
                    padding: '2px 8px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    {pillLabel}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {upcoming.length === 0 && history.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem 0' }}>
          No service history yet.
        </div>
      )}

      {/* Reschedule contact */}
      {businessPhone && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--r-md)',
          padding: '1rem',
          marginBottom: '1.25rem',
          textAlign: 'center',
        }}>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text)', marginBottom: '4px' }}>
            Need to reschedule?
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
            Give us a call or send a text
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <a
              href={`tel:${businessPhone}`}
              style={{
                flex: 1,
                maxWidth: '160px',
                display: 'block',
                background: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
                border: '1px solid var(--color-primary)',
                borderRadius: 'var(--r-sm)',
                padding: '10px',
                fontWeight: 600,
                fontSize: '0.875rem',
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              📞 Call Us
            </a>
            <a
              href={`sms:${businessPhone}`}
              style={{
                flex: 1,
                maxWidth: '160px',
                display: 'block',
                background: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
                border: '1px solid var(--color-primary)',
                borderRadius: 'var(--r-sm)',
                padding: '10px',
                fontWeight: 600,
                fontSize: '0.875rem',
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              💬 Text Us
            </a>
          </div>
        </div>
      )}

      <div style={{
        textAlign: 'center',
        fontSize: '0.75rem',
        color: 'var(--color-text-light)',
        marginTop: '2rem',
      }}>
        Powered by YardOps
      </div>
    </div>
  )
}

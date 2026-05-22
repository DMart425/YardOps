import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatTimestampDate, formatDateOnly, resolveTimeZone } from '@/lib/date'
import { formatPhoneInput } from '@/lib/format'

function fmt$(n: number): string {
  return '$' + n.toFixed(2).replace(/\.00$/, '')
}

const SERVICE_LABELS: Record<string, string> = {
  mow_only:      'Mow Only',
  mow_trim_blow: 'Mow, Trim & Blow',
  trim_cleanup:  'Trim & Cleanup',
  full_service:  'Full Service',
}

function serviceLabel(pkg: string | null | undefined, title: string | null | undefined): string {
  if (pkg && SERVICE_LABELS[pkg]) return SERVICE_LABELS[pkg]
  if (pkg) return pkg.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  return title ?? 'Lawn Service'
}

export default async function PortalInvoicePage({
  params,
}: {
  params: Promise<{ token: string; jobId: string }>
}) {
  const { token, jobId } = await params
  const supabase = createAdminClient()

  // 1. Resolve token → customer_id, business_id, created_by
  const { data: portalRow } = await supabase
    .from('customer_portal_tokens')
    .select('customer_id, business_id, created_by')
    .eq('token', token)
    .single()

  if (!portalRow) notFound()

  const { customer_id, business_id, created_by } = portalRow

  // 2. Fetch job — double-scoped to customer_id + business_id from the token row.
  //    A valid token for Customer A cannot access jobs belonging to Customer B.
  const { data: job } = await supabase
    .from('jobs')
    .select('id, title, status, payment_status, price, amount_paid, completed_at, scheduled_date, service_package, completion_notes, payment_method, property_id')
    .eq('id', jobId)
    .eq('customer_id', customer_id)
    .eq('business_id', business_id)
    .single()

  if (!job) notFound()

  // 3. Parallel supporting data
  const [
    { data: customer },
    { data: profile },
    { data: businessRow },
    { data: property },
    { data: pricing },
  ] = await Promise.all([
    supabase
      .from('customers')
      .select('first_name, last_name')
      .eq('id', customer_id)
      .single(),
    supabase
      .from('profiles')
      .select('business_name, business_phone, business_email')
      .eq('id', created_by)
      .single(),
    supabase
      .from('businesses')
      .select('name, phone')
      .eq('id', business_id)
      .single(),
    supabase
      .from('properties')
      .select('service_address, city')
      .eq('id', job.property_id as string)
      .eq('business_id', business_id)
      .single(),
    supabase
      .from('pricing_settings')
      .select('venmo_handle, time_zone')
      .eq('user_id', created_by)
      .maybeSingle(),
  ])

  if (!customer) notFound()

  // 4. Resolve business identity
  const businessName  = businessRow?.name  ?? profile?.business_name  ?? null
  const rawBizPhone   = businessRow?.phone ?? profile?.business_phone ?? null
  const businessPhone = rawBizPhone ? formatPhoneInput(rawBizPhone) : null
  const venmoHandle   = (pricing?.venmo_handle as string | null) ?? null
  const timeZone      = resolveTimeZone(pricing?.time_zone)

  // 5. Computed display values
  const customerName  = `${customer.first_name}${customer.last_name ? ' ' + customer.last_name : ''}`
  const address       = property
    ? `${property.service_address}${property.city ? ', ' + property.city : ''}`
    : null
  const refNumber     = job.id.slice(0, 8).toUpperCase()
  const svcLabel      = serviceLabel(job.service_package as string | null, job.title as string | null)

  const jobPrice    = job.price  != null ? Number(job.price)      : null
  const amtPaid     = job.amount_paid != null ? Number(job.amount_paid) : 0
  const balance     = jobPrice != null ? Math.max(0, jobPrice - amtPaid) : null
  const ps          = job.payment_status as string | null

  // 6. Page heading and status display config
  const heading =
    ps === 'paid'         ? 'Receipt'        :
    ps === 'not_billable' ? 'Service Record' :
    'Invoice'

  const statusLabel =
    ps === 'paid'         ? 'PAID'         :
    ps === 'partial'      ? 'PARTIAL'      :
    ps === 'not_billable' ? 'NOT BILLABLE' :
    'UNPAID'

  const statusBg =
    ps === 'paid'         ? 'rgba(22,163,74,0.12)'   :
    ps === 'partial'      ? 'rgba(245,158,11,0.12)'  :
    ps === 'not_billable' ? 'rgba(0,0,0,0.05)'       :
    'rgba(220,38,38,0.10)'

  const statusColor =
    ps === 'paid'         ? '#16a34a' :
    ps === 'partial'      ? '#d97706' :
    ps === 'not_billable' ? 'var(--color-text-muted)' :
    '#dc2626'

  // 7. Date line
  const dateDisplay = (() => {
    if (job.completed_at) {
      return formatTimestampDate(job.completed_at as string, timeZone, {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      })
    }
    if (job.scheduled_date) {
      return formatDateOnly(job.scheduled_date as string, {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      })
    }
    return null
  })()

  const venmoBalanceAmt = balance != null && balance > 0 ? balance : null

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

      {/* Header — business name + heading */}
      <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        {businessName && (
          <div style={{
            fontWeight: 800,
            fontSize: '1.25rem',
            color: 'var(--color-primary)',
            letterSpacing: '-0.02em',
            marginBottom: '2px',
          }}>
            {businessName}
          </div>
        )}
        {businessPhone && (
          <a
            href={`tel:${businessPhone}`}
            style={{ color: 'var(--color-text-muted)', textDecoration: 'none', fontSize: '0.875rem' }}
          >
            {businessPhone}
          </a>
        )}
        <div style={{
          marginTop: '1rem',
          fontWeight: 700,
          fontSize: '1.375rem',
          color: 'var(--color-text)',
          letterSpacing: '-0.01em',
        }}>
          {heading}
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '3px' }}>
          #{refNumber}
        </div>
      </div>

      {/* Customer + service details */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--r-md)',
        padding: '1rem',
        marginBottom: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Customer</span>
          <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{customerName}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Service</span>
          <span style={{ fontSize: '0.9375rem', fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{svcLabel}</span>
        </div>
        {dateDisplay && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              {job.completed_at ? 'Date' : 'Scheduled'}
            </span>
            <span style={{ fontSize: '0.9375rem' }}>{dateDisplay}</span>
          </div>
        )}
        {address && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Address</span>
            <span style={{ fontSize: '0.875rem', textAlign: 'right', maxWidth: '65%' }}>{address}</span>
          </div>
        )}
      </div>

      {/* Payment summary */}
      {ps !== 'not_billable' && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--r-md)',
          padding: '1rem',
          marginBottom: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {/* Status banner */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '4px',
          }}>
            <span style={{
              background: statusBg,
              color: statusColor,
              borderRadius: '999px',
              padding: '4px 16px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}>
              {statusLabel}
            </span>
          </div>

          {/* Line items */}
          {jobPrice != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Total</span>
              <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{fmt$(jobPrice)}</span>
            </div>
          )}
          {(ps === 'paid' || ps === 'partial') && amtPaid > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Paid</span>
              <span style={{ fontSize: '0.9375rem', color: '#16a34a', fontWeight: 500 }}>{fmt$(amtPaid)}</span>
            </div>
          )}
          {balance != null && balance > 0 && (
            <>
              <div style={{ height: '1px', background: 'var(--color-border)', margin: '2px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>Balance due</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#dc2626' }}>{fmt$(balance)}</span>
              </div>
            </>
          )}
          {ps === 'paid' && (
            <div style={{ fontSize: '0.8125rem', color: '#16a34a', textAlign: 'center', marginTop: '2px' }}>
              Thank you for your payment!
            </div>
          )}
        </div>
      )}

      {/* Not billable note */}
      {ps === 'not_billable' && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--r-md)',
          padding: '1rem',
          marginBottom: '1rem',
          textAlign: 'center',
          color: 'var(--color-text-muted)',
          fontSize: '0.9375rem',
        }}>
          No payment due for this service.
        </div>
      )}

      {/* Venmo Pay Now */}
      {venmoHandle && venmoBalanceAmt != null && (
        <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
          <a
            href={`https://venmo.com/${venmoHandle}?txn=pay&amount=${venmoBalanceAmt.toFixed(2)}&note=${encodeURIComponent('Lawn service')}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              background: '#3d95ce',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.9375rem',
              borderRadius: 'var(--r-sm)',
              padding: '12px 28px',
              textDecoration: 'none',
              width: '100%',
              boxSizing: 'border-box',
              textAlign: 'center',
            }}
          >
            Pay Now with Venmo
          </a>
        </div>
      )}

      {/* Completion notes */}
      {job.completion_notes && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--r-md)',
          padding: '1rem',
          marginBottom: '1rem',
        }}>
          <div style={{
            fontWeight: 700,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--color-text-muted)',
            marginBottom: '6px',
          }}>
            Service Notes
          </div>
          <div style={{ fontSize: '0.9375rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {job.completion_notes as string}
          </div>
        </div>
      )}

      {/* Back link */}
      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <Link
          href={`/portal/${token}`}
          style={{
            color: 'var(--color-primary)',
            fontSize: '0.9375rem',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          ← Back to your account
        </Link>
      </div>

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

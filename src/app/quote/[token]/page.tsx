import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateEstimate, formatMinutes } from '@/lib/pricing'
import type { EstimateInputs } from '@/lib/pricing'
import QuoteConfirmForm from './QuoteConfirmForm'
import styles from './quote.module.css'

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly', biweekly: 'Bi-Weekly', one_time: 'One-Time', monthly: 'Monthly',
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default async function QuotePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = createAdminClient()

  const { data: estimate } = await supabase
    .from('estimates')
    .select('*, customers(id, first_name, last_name, phone, email, status), properties(id, service_address, city, state, gate_code, access_notes)')
    .eq('public_token', token)
    .single()

  if (!estimate) notFound()

  const customer = estimate.customers as {
    id: string; first_name: string; last_name: string | null
    phone: string | null; email: string | null; status: string
  }
  const property = estimate.properties as {
    id: string; service_address: string; city: string | null
    state: string | null; gate_code: string | null; access_notes: string | null
  }

  const address = property.service_address + (property.city ? ', ' + property.city : '') + (property.state ? ', ' + property.state : '')
  const inputs = estimate.estimate_inputs as EstimateInputs | null
  const result = inputs ? calculateEstimate(inputs) : null
  const { totalMinutes, lineItems } = result ?? { totalMinutes: 0, lineItems: [] }
  const frequency = inputs?.frequency ?? 'one_time'

  // Check expiry
  const isExpired =
    estimate.status === 'expired' ||
    estimate.status === 'declined' ||
    (estimate.valid_until && new Date(estimate.valid_until + 'T23:59:59') < new Date())

  const isAccepted =
    estimate.status === 'approved' || estimate.status === 'converted'

  const accessNotes = [property.gate_code, property.access_notes].filter(Boolean).join(' | ') || null

  return (
    <div className={styles.wrap} style={{
      minHeight: '100vh', background: 'var(--q-bg)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Header — matches wicksburglawnservice.com */}
      <div style={{ background: '#0a0a0a', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Image src="/logo.png" alt="Wicksburg Lawn Service" width={56} height={56} style={{ objectFit: 'contain', width: '56px', height: '56px' }} />
        <div>
          <div style={{ color: '#34d399', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.2em' }}>Local Lawn Service</div>
          <div style={{ color: '#f5f5f5', fontWeight: 700, fontSize: '1.125rem', lineHeight: 1.2 }}>Wicksburg Lawn Service</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <a href="tel:3343207514" style={{
            background: '#10b981', color: '#0a0a0a', textDecoration: 'none',
            borderRadius: '10px', padding: '8px 16px', fontSize: '0.875rem', fontWeight: 600,
          }}>
            Call Now
          </a>
        </div>
      </div>

      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '20px 16px 40px' }}>

        {/* Expired banner */}
        {isExpired && (
          <div style={{
            background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: '10px',
            padding: '14px 16px', marginBottom: '16px', color: '#fbbf24', fontWeight: 600,
          }}>
            ⚠️ This estimate has expired or is no longer available.
          </div>
        )}

        {/* Already accepted banner */}
        {isAccepted && !isExpired && (
          <div style={{
            background: 'rgba(52,211,153,0.08)', border: '2px solid #34d399', borderRadius: '10px',
            padding: '14px 16px', marginBottom: '16px', color: '#34d399', fontWeight: 600,
          }}>
            ✅ You&apos;ve already accepted this estimate. We&apos;ll be in touch soon!
          </div>
        )}

        {/* Estimate summary card */}
        <div style={{
          background: 'var(--q-surface)', borderRadius: '12px', border: '1px solid var(--q-border)',
          marginBottom: '16px', overflow: 'hidden',
        }}>
          <div style={{ background: '#10b981', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              {estimate.revision_number > 1 && (
                <div style={{ color: 'rgba(0,0,0,0.65)', fontSize: '0.75rem', fontWeight: 700, marginBottom: '3px' }}>
                  Revised Estimate v{estimate.revision_number}
                </div>
              )}
              <div style={{ color: '#0a0a0a', fontWeight: 700, fontSize: '1rem' }}>
                {FREQ_LABELS[frequency] ?? frequency} Lawn Service
              </div>
              <div style={{ color: 'rgba(0,0,0,0.55)', fontSize: '0.8125rem', marginTop: '2px', fontWeight: 700 }}>{address}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#0a0a0a', fontWeight: 800, fontSize: '2rem', lineHeight: 1 }}>
                ${Number(estimate.total).toFixed(0)}
              </div>
              {totalMinutes > 0 && (
                <div style={{ color: 'rgba(0,0,0,0.55)', fontSize: '0.8125rem', fontWeight: 700 }}>~{formatMinutes(totalMinutes)}</div>
              )}
            </div>
          </div>

          <div style={{ padding: '16px 20px' }}>
            {/* Line items */}
            {lineItems.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                {lineItems.filter(it => (it.price ?? 0) > 0 || (it.minutes ?? 0) > 0).map((it, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '5px 0', borderBottom: '1px solid var(--q-border-light)',
                    fontSize: '0.9375rem',
                  }}>
                    <span style={{ color: 'var(--q-text-muted)' }}>{it.label}</span>
                    <span style={{ color: 'var(--q-text)', fontWeight: 500 }}>
                      {it.price ? '$' + it.price.toFixed(2) : it.minutes ? it.minutes + ' min' : ''}
                    </span>
                  </div>
                ))}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '10px 0 0', fontWeight: 700, fontSize: '1rem', color: 'var(--q-text)',
                }}>
                  <span>Total</span>
                  <span style={{ color: '#059669' }}>${Number(estimate.total).toFixed(0)}</span>
                </div>
              </div>
            )}

            {estimate.valid_until && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--q-text-subtle)', marginTop: '8px' }}>
                ⏰ Valid until <strong>{fmtDate(estimate.valid_until)}</strong>
              </div>
            )}

            {estimate.revision_number > 1 && estimate.last_revised_at && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--q-text-subtle)', marginTop: '4px' }}>
                Updated <strong>{new Date(estimate.last_revised_at).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}</strong>
              </div>
            )}

            {estimate.notes && (
              <div style={{
                marginTop: '12px', background: 'var(--q-field-bg)', borderRadius: '6px',
                padding: '10px 12px', fontSize: '0.875rem', color: 'var(--q-text-muted)',
              }}>
                <strong>Notes:</strong> {estimate.notes}
              </div>
            )}
          </div>
        </div>

        {/* Confirm + accept form — only show if not expired and not already accepted */}
        {!isExpired && !isAccepted && (
          <div style={{
            background: 'var(--q-surface)', borderRadius: '12px', border: '1px solid var(--q-border)',
            padding: '20px',
          }}>
            <QuoteConfirmForm
              token={token}
              firstName={customer.first_name}
              lastName={customer.last_name}
              phone={customer.phone}
              email={customer.email}
              address={address}
              frequency={frequency}
              accessNotes={accessNotes}
            />
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: '#6b7280', marginTop: '24px' }}>
          Questions? Call or text{' '}
          <a href="tel:3343207514" style={{ color: '#10b981' }}>(334) 320-7514</a>
        </p>
      </div>
    </div>
  )
}

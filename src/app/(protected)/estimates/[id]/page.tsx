import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { EstimateStatusActions } from '@/components/EstimateStatusActions'
import { calculateEstimate, formatMinutes, DEFAULT_SETTINGS } from '@/lib/pricing'
import type { EstimateInputs } from '@/lib/pricing'
import SendSmsButton from './SendSmsButton'
import ScheduleVisitForm from './ScheduleVisitForm'
import { deleteEstimate } from './actions'

function fmtDate(d: string) {
  const date = d.includes('T') ? new Date(d) : new Date(d + 'T12:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  })
}

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly', biweekly: 'Bi-Weekly', one_time: 'One-Time', monthly: 'Monthly',
}

export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: estimate } = await supabase
    .from('estimates')
    .select('*, customers(first_name, last_name, phone), properties(service_address, city, state, estimated_mowable_acres)')
    .eq('id', id)
    .single()

  if (!estimate) notFound()

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('venmo_handle, minimum_price')
    .single()
  const venmoHandle = (settings?.venmo_handle as string | null) ?? null
  const minimumPrice = (settings?.minimum_price as number | null) ?? DEFAULT_SETTINGS.minimumServicePrice

  const customer = estimate.customers as { first_name: string; last_name: string | null; phone: string | null }
  const property = estimate.properties as { service_address: string; city: string | null; state: string | null; estimated_mowable_acres: number | null }
  const customerName = customer.first_name + (customer.last_name ? ' ' + customer.last_name : '')
  const address = property.service_address + (property.city ? ', ' + property.city : '')

  // Quote URL for SMS
  const quoteBaseUrl = process.env.NEXT_PUBLIC_QUOTE_BASE_URL ?? 'https://app.wicksburglawnservice.com'
  const quoteUrl = estimate.public_token ? `${quoteBaseUrl}/quote/${estimate.public_token}` : null

  // Recalculate from stored inputs
  const inputs = estimate.estimate_inputs as EstimateInputs | null
  const result = inputs ? calculateEstimate(inputs) : null
  const { breakdown, totalMinutes, finalEstimate, lineItems } = result ?? {
    breakdown: null, totalMinutes: 0, finalEstimate: Number(estimate.total), lineItems: [],
  }

  // Build SMS text
  const smsLines = [
    'Hi ' + customer.first_name + ', here is your lawn service estimate from Wicksburg Lawn Service:',
    '',
    'Address: ' + address,
    '',
  ]
  if (inputs) {
    smsLines.push('Service: ' + (FREQ_LABELS[inputs.frequency] ?? inputs.frequency))
    smsLines.push('Est. time: ' + formatMinutes(totalMinutes))
  }
  if (lineItems.length > 0) {
    smsLines.push('')
    lineItems.forEach(it => {
      if (it.isAddOn && it.price) {
        smsLines.push('- ' + it.label + ': +$' + it.price.toFixed(2))
      }
    })
  }
  smsLines.push('')
  smsLines.push('Total: $' + Number(estimate.total).toFixed(0))
  if (estimate.valid_until) smsLines.push('Valid until: ' + fmtDate(estimate.valid_until))
  if (quoteUrl) {
    smsLines.push('')
    smsLines.push('View & accept your estimate online:')
    smsLines.push(quoteUrl)
  }
  if (venmoHandle) {
    const venmoUrl = `https://venmo.com/${venmoHandle}?txn=pay&amount=${Number(estimate.total).toFixed(0)}&note=${encodeURIComponent('Lawn service - ' + customer.first_name)}`
    smsLines.push('')
    smsLines.push('Pay via Venmo: ' + venmoUrl)
    smsLines.push('Cash is also accepted.')
  } else {
    smsLines.push('')
    smsLines.push('Payment accepted via cash.')
  }
  smsLines.push('')
  smsLines.push('Questions? Call or text (334) 320-7514')
  const smsBody = smsLines.join('\n')

  return (
    <div className="page">
      <Link href="/estimates" className="back-link">← Estimates</Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">{customerName}</h1>
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
            <span className={'pill pill-' + estimate.status}>{estimate.status}</span>
            {inputs && <span className="pill pill-one_time">{FREQ_LABELS[inputs.frequency] ?? inputs.frequency}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="stat-value" style={{ fontSize: '2rem' }}>${Number(estimate.total).toFixed(0)}</div>
          <div className="text-small text-muted">{formatMinutes(totalMinutes)}</div>
        </div>
      </div>

      {/* Property info */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="card-row">
            <span className="text-small text-muted">Property</span>
            <span className="text-small">{address}</span>
          </div>
          {property.estimated_mowable_acres && (
            <div className="card-row">
              <span className="text-small text-muted">Mowable acres</span>
              <span className="text-small">{Number(property.estimated_mowable_acres).toFixed(2)} ac</span>
            </div>
          )}
          <div className="card-row">
            <span className="text-small text-muted">Created</span>
            <span className="text-small">{fmtDate(estimate.created_at)}</span>
          </div>
          {estimate.valid_until && (
            <div className="card-row">
              <span className="text-small text-muted">Valid until</span>
              <span className="text-small">{fmtDate(estimate.valid_until)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Schedule Visit */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="section-heading" style={{ marginBottom: '0.75rem' }}>
          {estimate.visit_scheduled_date ? '📅 Visit Scheduled' : '📅 Schedule Visit'}
        </div>
        {estimate.visit_scheduled_date && (
          <div style={{ marginBottom: '10px', padding: '8px 10px', background: 'var(--color-success-bg, #f0fdf4)', borderRadius: '8px', border: '1px solid var(--color-success-border, #bbf7d0)' }}>
            <span className="text-small" style={{ fontWeight: 600 }}>{fmtDate(estimate.visit_scheduled_date)}</span>
            {estimate.visit_scheduled_time && (
              <span className="text-small text-muted"> · {estimate.visit_scheduled_time}</span>
            )}
          </div>
        )}
        <ScheduleVisitForm
          estimateId={estimate.id}
          currentDate={estimate.visit_scheduled_date ?? null}
          currentTime={estimate.visit_scheduled_time ?? null}
        />
      </div>

      {/* Full breakdown */}
      {breakdown && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="section-heading" style={{ marginBottom: '0.75rem' }}>Estimate Breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.875rem' }}>
            {breakdown.setupMinutes > 0 && (
              <div className="card-row"><span>Setup / Load</span><span>{breakdown.setupMinutes} min</span></div>
            )}
            {breakdown.mowingMinutes > 0 && (
              <div className="card-row"><span>Mowing</span><span>{breakdown.mowingMinutes} min</span></div>
            )}
            {breakdown.weedEatingMinutes > 0 && (
              <div className="card-row"><span>Weed Eating</span><span>{breakdown.weedEatingMinutes} min</span></div>
            )}
            {breakdown.edgingMinutes > 0 && (
              <div className="card-row"><span>Edging</span><span>{breakdown.edgingMinutes} min</span></div>
            )}
            {breakdown.blowOffMinutes > 0 && (
              <div className="card-row"><span>Blow Off</span><span>{breakdown.blowOffMinutes} min</span></div>
            )}
            {breakdown.obstacleMinutes > 0 && (
              <div className="card-row"><span>Obstacles</span><span>+{breakdown.obstacleMinutes} min</span></div>
            )}
            <div className="card-row" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '6px', marginTop: '2px' }}>
              <span className="font-bold">Base labor</span><span className="font-bold">{breakdown.baseLaborMinutes} min</span>
            </div>
            {breakdown.grassAdjustedMinutes !== breakdown.baseLaborMinutes && (
              <div className="card-row">
                <span>Grass condition adjusted</span>
                <span>{breakdown.grassAdjustedMinutes} min</span>
              </div>
            )}
            {breakdown.terrainAdjustedMinutes !== breakdown.grassAdjustedMinutes && (
              <div className="card-row">
                <span>Terrain adjusted</span>
                <span>{breakdown.terrainAdjustedMinutes} min</span>
              </div>
            )}
            <div className="card-row">
              <span>Labor ({breakdown.estimatedHours} hr x ${inputs?.hourlyRate ?? DEFAULT_SETTINGS.targetHourlyRate}/hr)</span>
              <span>${breakdown.laborPrice.toFixed(2)}</span>
            </div>
            {breakdown.frequencyMultiplier !== 1 && (
              <div className="card-row">
                <span>Frequency multiplier (x{breakdown.frequencyMultiplier})</span>
                <span>${breakdown.frequencyAdjustedPrice.toFixed(2)}</span>
              </div>
            )}
            {lineItems.filter(it => it.isAddOn).map((it, i) => (
              <div key={i} className="card-row">
                <span>{it.label}</span>
                <span>+${(it.price ?? 0).toFixed(2)}</span>
              </div>
            ))}
            {breakdown.travelFee > 0 && (
              <div className="card-row"><span>Travel fee</span><span>+${breakdown.travelFee.toFixed(2)}</span></div>
            )}
            {breakdown.minimumApplied && (
              <div className="card-row" style={{ color: 'var(--color-warning)' }}>
                <span>Minimum charge applied</span>
                <span>${minimumPrice}</span>
              </div>
            )}
            <div className="card-row" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '6px', marginTop: '2px', fontWeight: 700, fontSize: '1rem' }}>
              <span>Final Estimate</span>
              <span>${breakdown.finalEstimate}</span>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {estimate.notes && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="section-heading" style={{ marginBottom: '0.5rem' }}>Notes</div>
          <p className="text-small">{estimate.notes}</p>
        </div>
      )}

      {/* SMS preview */}
      {customer.phone && estimate.status !== 'converted' && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="section-heading" style={{ marginBottom: '0.75rem' }}>Send to Customer</div>
          <pre style={{
            fontSize: '0.8125rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--r-sm)', padding: '12px', marginBottom: '12px', lineHeight: 1.5,
          }}>{smsBody}</pre>
          <SendSmsButton
            phone={customer.phone}
            smsBody={smsBody}
            estimateId={estimate.id}
            customerId={estimate.customer_id}
          />
        </div>
      )}

      {/* Status actions */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="section-heading" style={{ marginBottom: '0.75rem' }}>Actions</div>
        <EstimateStatusActions estimate={estimate} />
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <Link href={'/customers/' + estimate.customer_id} className="btn btn-sm btn-secondary">Customer</Link>
        <Link href={'/properties/' + estimate.property_id} className="btn btn-sm btn-secondary">Property</Link>
      </div>

      {(estimate.status === 'draft' || estimate.status === 'pending') && (
        <form action={deleteEstimate.bind(null, estimate.id)} style={{ marginTop: '12px' }}
          onSubmit={e => { if (!confirm('Delete this estimate? This cannot be undone.')) e.preventDefault() }}>
          <button type="submit" className="btn btn-sm" style={{ background: 'var(--color-danger, #ef4444)', color: '#fff', border: 'none', width: '100%' }}>
            Delete Estimate
          </button>
        </form>
      )}
    </div>
  )
}
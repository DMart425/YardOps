import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { EstimateStatusActions } from '@/components/EstimateStatusActions'
import { calculateEstimate, formatMinutes, DEFAULT_SETTINGS } from '@/lib/pricing'
import { formatDateOnly, formatTimestampDate, getLocalDateStr, resolveTimeZone } from '@/lib/date'
import type { EstimateInputs } from '@/lib/pricing'
import type { Estimate } from '@/types/database'
import SendSmsButton from './SendSmsButton'
import ScheduleVisitForm from './ScheduleVisitForm'
import EstimateDangerZone from './EstimateDangerZone'

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly', biweekly: 'Bi-Weekly', one_time: 'One-Time', monthly: 'Monthly',
}

type EstimateWithRelations = Estimate & {
  customers: { first_name: string; last_name: string | null; phone: string | null }
  properties: { service_address: string; city: string | null; state: string | null; estimated_mowable_acres: number | null }
}

export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: estimateRaw } = await supabase
    .from('estimates')
    .select('*, customers(first_name, last_name, phone), properties(service_address, city, state, estimated_mowable_acres)')
    .eq('id', id)
    .single()

  if (!estimateRaw) notFound()
  const estimate = estimateRaw as EstimateWithRelations

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('venmo_handle, minimum_price, time_zone')
    .eq('user_id', user.id)
    .maybeSingle()
  const venmoHandle = (settings?.venmo_handle as string | null) ?? null
  const minimumPrice = (settings?.minimum_price as number | null) ?? DEFAULT_SETTINGS.minimumServicePrice
  const timeZone = resolveTimeZone(settings?.time_zone)
  const localToday = getLocalDateStr(timeZone)

  const customer = estimate.customers
  const property = estimate.properties
  const customerName = customer.first_name + (customer.last_name ? ' ' + customer.last_name : '')
  const address = property.service_address + (property.city ? ', ' + property.city : '')

  // Quote URL for SMS
  const quoteBaseUrl = process.env.NEXT_PUBLIC_QUOTE_BASE_URL ?? 'https://app.wicksburglawnservice.com'
  const quoteUrl = estimate.public_token ? `${quoteBaseUrl}/quote/${estimate.public_token}` : null

  // Recalculate from stored inputs
  const inputs = estimate.estimate_inputs as EstimateInputs | null
  const pricingOverride = { ...DEFAULT_SETTINGS, minimumServicePrice: minimumPrice }
  const result = inputs ? calculateEstimate(inputs, pricingOverride) : null
  const { breakdown, totalMinutes, lineItems } = result ?? {
    breakdown: null, totalMinutes: 0, lineItems: [],
  }

  // Build SMS text
  const isRevised = estimate.revision_number > 1
  const smsLines = [
    isRevised
      ? 'Hi ' + customer.first_name + ', here is your revised lawn service estimate from Wicksburg Lawn Service:'
      : 'Hi ' + customer.first_name + ', here is your lawn service estimate from Wicksburg Lawn Service:',
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
  if (estimate.valid_until) smsLines.push('Valid until: ' + formatDateOnly(estimate.valid_until, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  }))
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
            {estimate.revision_number > 1 && <span className="pill pill-draft">v{estimate.revision_number}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div className="stat-value" style={{ fontSize: '2rem' }}>${Number(estimate.total).toFixed(0)}</div>
          <div className="text-small text-muted">{formatMinutes(totalMinutes)}</div>
        </div>
      </div>

      {/* Revised-draft notice */}
      {estimate.revision_number > 1 && estimate.status === 'draft' && (
        <div className="warning-banner" style={{ marginBottom: '1rem' }}>
          ⚠️ This estimate was revised and must be sent again before approval.
        </div>
      )}

      {/* Estimate summary */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="section-heading" style={{ marginBottom: '0.75rem' }}>Estimate Summary</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="card-row">
            <span className="text-small text-muted">Customer</span>
            <span className="text-small">{customerName}</span>
          </div>
          <div className="card-row">
            <span className="text-small text-muted">Property</span>
            <span className="text-small">{address}</span>
          </div>
          <div className="card-row">
            <span className="text-small text-muted">Status</span>
            <span className={`pill pill-${estimate.status}`}>{estimate.status}</span>
          </div>
          {estimate.revision_number > 1 && (
            <div className="card-row">
              <span className="text-small text-muted">Revision</span>
              <span className="pill pill-draft">v{estimate.revision_number}</span>
            </div>
          )}
          {inputs && (
            <div className="card-row">
              <span className="text-small text-muted">Service frequency</span>
              <span className="text-small">{FREQ_LABELS[inputs.frequency] ?? inputs.frequency}</span>
            </div>
          )}
          <div className="card-row">
            <span className="text-small text-muted">Total estimate</span>
            <span className="text-small font-bold">${Number(estimate.total).toFixed(2)}</span>
          </div>
          <div className="card-row">
            <span className="text-small text-muted">Estimated time</span>
            <span className="text-small">{formatMinutes(totalMinutes)}</span>
          </div>
          {property.estimated_mowable_acres && (
            <div className="card-row">
              <span className="text-small text-muted">Mowable acres</span>
              <span className="text-small">{Number(property.estimated_mowable_acres).toFixed(2)} ac</span>
            </div>
          )}
          <div className="card-row">
            <span className="text-small text-muted">Created</span>
            <span className="text-small">{formatTimestampDate(estimate.created_at, timeZone, {
              weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
            })}</span>
          </div>
          {estimate.revision_number > 1 && estimate.last_revised_at && (
            <div className="card-row">
              <span className="text-small text-muted">Last revised</span>
              <span className="text-small">{formatTimestampDate(estimate.last_revised_at, timeZone, {
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
              })}</span>
            </div>
          )}
          {estimate.last_sent_at && (
            <div className="card-row">
              <span className="text-small text-muted">Last sent</span>
              <span className="text-small">{formatTimestampDate(estimate.last_sent_at, timeZone, {
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
              })}</span>
            </div>
          )}
          {estimate.valid_until && (
            <div className="card-row">
              <span className="text-small text-muted">Valid until</span>
              <span className="text-small">{formatDateOnly(estimate.valid_until, {
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
              })}</span>
            </div>
          )}
          {estimate.visit_scheduled_date && (
            <div className="card-row">
              <span className="text-small text-muted">Visit scheduled</span>
              <span className="text-small">
                {formatDateOnly(estimate.visit_scheduled_date, {
                  weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                })}
                {estimate.visit_scheduled_time ? ` · ${estimate.visit_scheduled_time}` : ''}
              </span>
            </div>
          )}
          {quoteUrl && (
            <div className="card-row" style={{ alignItems: 'flex-start' }}>
              <span className="text-small text-muted">Public quote</span>
              <a href={quoteUrl} target="_blank" rel="noopener noreferrer" className="text-small" style={{ color: 'var(--color-primary)' }}>
                Open quote link
              </a>
            </div>
          )}
          {(estimate.status === 'approved' || estimate.status === 'converted') && (
            <>
              <div className="card-row">
                <span className="text-small text-muted">Approval status</span>
                <span className="text-small">
                  {estimate.approved_by_source === 'customer_quote' && 'Accepted by customer via quote link'}
                  {estimate.approved_by_source === 'manual' && 'Manually approved'}
                  {!estimate.approved_by_source && 'Approved'}
                </span>
              </div>
              {estimate.approved_by_source && (
                <div className="card-row">
                  <span className="text-small text-muted">Approval source</span>
                  <span className="text-small">{estimate.approved_by_source === 'customer_quote' ? 'Customer quote page' : 'Manual'}</span>
                </div>
              )}
              {estimate.approved_by_source === 'manual' && estimate.approval_note && (
                <div className="card-row" style={{ alignItems: 'flex-start' }}>
                  <span className="text-small text-muted">Approval note</span>
                  <span className="text-small" style={{ maxWidth: '70%', textAlign: 'right' }}>{estimate.approval_note}</span>
                </div>
              )}
              {estimate.approved_by_source === 'manual' && estimate.manually_approved_at && (
                <div className="card-row">
                  <span className="text-small text-muted">Manual approval time</span>
                  <span className="text-small">{fmtDateTime(estimate.manually_approved_at)}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="detail-section">
        <div className="section-heading">Action Center</div>
      </div>

      {/* Schedule Visit */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="section-heading" style={{ marginBottom: '0.75rem' }}>
          {estimate.visit_scheduled_date ? '📅 Visit Scheduled' : '📅 Schedule Visit'}
        </div>
        {estimate.visit_scheduled_date && (
          <div style={{ marginBottom: '10px', padding: '8px 10px', background: 'var(--color-success-bg, #f0fdf4)', borderRadius: '8px', border: '1px solid var(--color-success-border, #bbf7d0)' }}>
            <span className="text-small" style={{ fontWeight: 600 }}>{formatDateOnly(estimate.visit_scheduled_date, {
              weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
            })}</span>
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
            currentStatus={estimate.status}
          />
        </div>
      )}

      {/* Status actions */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="section-heading" style={{ marginBottom: '0.75rem' }}>Actions</div>
        <EstimateStatusActions estimate={estimate} localToday={localToday} />
        <div style={{ display: 'flex', gap: '8px', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          {estimate.status !== 'converted' && (
            <Link href={`/estimates/${estimate.id}/edit`} className="btn btn-sm btn-secondary">Edit</Link>
          )}
          <Link href={'/customers/' + estimate.customer_id} className="btn btn-sm btn-secondary">Customer</Link>
          <Link href={'/properties/' + estimate.property_id} className="btn btn-sm btn-secondary">Property</Link>
        </div>
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

      <EstimateDangerZone estimateId={estimate.id} />
    </div>
  )
}
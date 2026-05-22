'use client'

import { useActionState, useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { FormState, Job } from '@/types/database'
import { completeJob, markInProgress, skipJob, cancelJob, markPaid, markPartial, rescheduleJob } from '@/app/(protected)/jobs/actions'
import { Toast } from '@/components/Toast'

export function JobActions({ job, venmoHandle, customerPhone, customerFirstName, businessName, businessPhone, portalInvoiceUrl }: { job: Job; venmoHandle?: string | null; customerPhone?: string | null; customerFirstName?: string | null; businessName?: string | null; businessPhone?: string | null; portalInvoiceUrl?: string | null }) {
  const [panel,          setPanel]         = useState<'complete' | 'skip' | 'paid' | 'partial' | 'reschedule' | null>(null)
  const [completionPayStatus,  setCompletionPayStatus]  = useState('unpaid')
  const [completionPartialAmt, setCompletionPartialAmt] = useState('')
  const [reschedReason,    setReschedReason]    = useState('')
  const [reschedTimeWin,   setReschedTimeWin]   = useState('')
  const [laterPartialAmt,  setLaterPartialAmt]  = useState('')
  const [pendingReceipt,   setPendingReceipt]   = useState<{ smsBody: string; isPaidInFull: boolean } | null>(null)
  const router = useRouter()
  const notesRef = useRef<HTMLTextAreaElement>(null)

  const NOTE_TEMPLATES = [
    'Mowed, edged, blown',
    'Mowed only',
    'Mowed, edged, blown, trimmed shrubs',
    'Full service complete',
    'Gate locked — mowed front only',
  ]

  const [startState,    startAction,    startPending]    = useActionState<FormState, FormData>(markInProgress.bind(null, job.id), { error: null })
  const [completeState, completeAction, completePending] = useActionState<FormState, FormData>(completeJob.bind(null, job.id),    { error: null })
  const [skipState,     skipAction,     skipPending]     = useActionState<FormState, FormData>(skipJob.bind(null, job.id),        { error: null })
  const [cancelState,   cancelAction,   cancelPending]   = useActionState<FormState, FormData>(cancelJob.bind(null, job.id),      { error: null })
  const [paidState,       paidAction,       paidPending]       = useActionState<FormState, FormData>(markPaid.bind(null, job.id),        { error: null })
  const [partialState,    partialAction,    partialPending]    = useActionState<FormState, FormData>(markPartial.bind(null, job.id),     { error: null })
  const [reschedState,   reschedAction,   reschedPending]   = useActionState<FormState, FormData>(rescheduleJob.bind(null, job.id), { error: null })

  const anyError      = completeState.error ?? skipState.error ?? paidState.error ?? partialState.error ?? startState.error ?? cancelState.error ?? reschedState.error
  const anySuccess    = completeState.success ?? skipState.success ?? paidState.success ?? partialState.success ?? startState.success ?? cancelState.success ?? reschedState.success
  const justCompleted = !!completeState.success

  const todayLocal    = new Intl.DateTimeFormat('en-CA').format(new Date())

  const isActive         = job.status === 'scheduled' || job.status === 'in_progress'
  const canReschedule    = isActive || job.status === 'needs_reschedule'
  const isCompleted      = job.status === 'completed'
  const partialRemaining = Math.max(0, Number(job.price ?? 0) - Number(job.amount_paid ?? 0))

  // Build invoice SMS body using completion-time state so partial amounts are accurate
  // even before router.refresh() updates stale job props.
  const completionAmtForSms =
    completionPayStatus === 'paid'
      ? (job.price != null ? Number(job.price) : null)
      : completionPayStatus === 'partial'
        ? (parseFloat(completionPartialAmt) || null)
        : null  // 'unpaid' → null → full balance shown in SMS

  // Suppress SMS entirely for not_billable completions (no payment expected).
  const invoiceSmsBody = (customerPhone && completionPayStatus !== 'not_billable')
    ? buildInvoiceSms(customerFirstName, job, venmoHandle, completionAmtForSms, businessPhone, portalInvoiceUrl)
    : null

  // Refresh page data and auto-launch SMS compose when job is first marked complete.
  // router.refresh() re-fetches server component data so the UI reflects the new
  // job status regardless of payment method (unpaid, paid, or not_billable).
  useEffect(() => {
    if (justCompleted) {
      router.refresh()
      if (customerPhone && invoiceSmsBody) {
        window.location.href = `sms:${customerPhone}?&body=${encodeURIComponent(invoiceSmsBody)}`
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justCompleted])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Toast message={anySuccess} />
      {anyError && <div className="alert alert-error">{anyError}</div>}

      {/* ── Later payment receipt SMS (set at submit time; persists across route revalidation) ── */}
      {(paidState.success || partialState.success) && pendingReceipt && customerPhone && (
        <button
          type="button"
          className={`btn btn-full ${pendingReceipt.isPaidInFull ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            window.location.href = `sms:${customerPhone}?&body=${encodeURIComponent(pendingReceipt.smsBody)}`
            setPendingReceipt(null)
          }}
        >
          📱 {pendingReceipt.isPaidInFull ? 'Send Receipt' : 'Send Payment Receipt'}
        </button>
      )}

      {/* ── Completion SMS prompt (fallback / re-send) ── */}
      {justCompleted && customerPhone && invoiceSmsBody && (
        <a
          href={`sms:${customerPhone}?&body=${encodeURIComponent(invoiceSmsBody)}`}
          className="btn btn-primary btn-full"
        >
          📱 Send Invoice to Customer
        </a>
      )}

      {/* ── Active job actions ── */}
      {isActive && (
        <>
          {/* Start Job (scheduled only) */}
          {job.status === 'scheduled' && (
            <form action={startAction}>
              <button type="submit" disabled={startPending} className="btn btn-primary btn-full">
                {startPending ? 'Updating…' : '▶ Start Job'}
              </button>
            </form>
          )}

          {/* Complete Job (in_progress only) */}
          {job.status === 'in_progress' && (
            <>
              <button
                type="button"
                className="btn btn-primary btn-full"
                onClick={() => setPanel(panel === 'complete' ? null : 'complete')}
              >
                ✓ Complete Job
              </button>

              {panel === 'complete' && (
                <form action={completeAction} className="form action-panel">
                  <div className="form-field">
                    <label className="form-label">Completion Notes</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '6px' }}>
                      {NOTE_TEMPLATES.map(t => (
                        <button
                          key={t}
                          type="button"
                          className="pill pill-draft"
                          style={{ cursor: 'pointer', fontSize: '0.7rem', border: '1px solid var(--color-border)' }}
                          onClick={() => { if (notesRef.current) notesRef.current.value = t }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <textarea ref={notesRef} name="completion_notes" className="form-textarea" rows={2} placeholder="Any notes about this visit…" />
                  </div>
                  <div className="form-row">
                    <div className="form-field">
                      <label className="form-label">Final Price ($)</label>
                      <input
                        name="price"
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-input"
                        defaultValue={job.price ?? ''}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Minutes Worked</label>
                      <input
                        name="actual_minutes"
                        type="number"
                        min="1"
                        step="1"
                        className="form-input"
                        placeholder={job.started_at ? 'auto-calc' : '30'}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-field">
                      <label className="form-label">Payment</label>
                      <select
                        name="payment_status"
                        className="form-select"
                        value={completionPayStatus}
                        onChange={e => setCompletionPayStatus(e.target.value)}
                      >
                        <option value="unpaid">Unpaid</option>
                        <option value="partial">Partial payment</option>
                        <option value="paid">Paid in full</option>
                        <option value="not_billable">Not billable</option>
                      </select>
                    </div>
                  </div>

                  {completionPayStatus === 'partial' && (
                    <div className="form-field">
                      <label className="form-label">Payment Amount ($) *</label>
                      <input
                        name="partial_amount"
                        type="number"
                        min="1"
                        step="1"
                        className="form-input"
                        required
                        value={completionPartialAmt}
                        onChange={e => setCompletionPartialAmt(e.target.value)}
                        placeholder={job.price ? String(Number(job.price).toFixed(0)) : '0'}
                      />
                    </div>
                  )}

                  {(completionPayStatus === 'paid' || completionPayStatus === 'partial') && (
                    <div className="form-field">
                      <label className="form-label">Payment Method</label>
                      <select name="payment_method" className="form-select">
                        <option value="">Not specified</option>
                        <option value="cash">Cash</option>
                        <option value="check">Check</option>
                        <option value="venmo">Venmo</option>
                        <option value="cashapp">CashApp</option>
                        <option value="zelle">Zelle</option>
                      </select>
                    </div>
                  )}

                  <button type="submit" disabled={completePending} className="btn btn-primary btn-full">
                    {completePending ? 'Saving…' : 'Confirm Complete'}
                  </button>
                </form>
              )}
            </>
          )}

          {/* Skip + Cancel row */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setPanel(panel === 'skip' ? null : 'skip')}
            >
              Skip
            </button>
            <form action={cancelAction} style={{ flex: 1 }}>
              <button type="submit" disabled={cancelPending} className="btn btn-sm btn-danger btn-full">
                {cancelPending ? '…' : 'Cancel Job'}
              </button>
            </form>
          </div>

          {/* Skip panel */}
          {panel === 'skip' && (
            <form action={skipAction} className="form action-panel">
              <div className="form-field">
                <label className="form-label">Reason (optional)</label>
                <input name="reason" className="form-input" placeholder="Weather, customer request…" />
              </div>
              <button type="submit" disabled={skipPending} className="btn btn-secondary btn-full">
                {skipPending ? 'Saving…' : 'Confirm Skip'}
              </button>
            </form>
          )}
        </>
      )}

      {/* ── Reschedule Job ── */}
      {canReschedule && (
        <>
          <button
            type="button"
            className="btn btn-sm btn-secondary btn-full"
            onClick={() => {
              setPanel(panel === 'reschedule' ? null : 'reschedule')
              setReschedReason('')
              setReschedTimeWin('')
            }}
          >
            📅 Reschedule Job
          </button>

          {panel === 'reschedule' && (
            <form action={reschedAction} className="form action-panel">
              <div className="form-field">
                <label className="form-label">Reason *</label>
                <select
                  name="reason_code"
                  className="form-select"
                  required
                  value={reschedReason}
                  onChange={e => setReschedReason(e.target.value)}
                >
                  <option value="">— Select reason —</option>
                  <option value="rain_weather">Rain / Weather</option>
                  <option value="customer_requested">Customer requested</option>
                  <option value="equipment_issue">Equipment issue</option>
                  <option value="access_issue">Access issue / gate / pets</option>
                  <option value="unavailable_operator">Owner/operator unavailable</option>
                  <option value="yard_not_ready">Yard not ready</option>
                  <option value="route_change">Route change</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {reschedReason === 'other' && (
                <div className="form-field">
                  <label className="form-label">Describe reason *</label>
                  <input name="custom_reason" className="form-input" placeholder="Enter reason…" required />
                </div>
              )}

              <div className="form-row">
                <div className="form-field">
                  <label className="form-label">New Date *</label>
                  <input name="new_date" type="date" className="form-input" min={todayLocal} required />
                </div>
                <div className="form-field">
                  <label className="form-label">Time Window</label>
                  <select
                    name="new_time_window"
                    className="form-select"
                    value={reschedTimeWin}
                    onChange={e => setReschedTimeWin(e.target.value)}
                  >
                    <option value="">Anytime</option>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              {reschedTimeWin === 'custom' && (
                <div className="form-field">
                  <label className="form-label">Custom time window *</label>
                  <input name="custom_time_window" className="form-input" placeholder="e.g. 9am–11am" required />
                </div>
              )}

              <button type="submit" disabled={reschedPending} className="btn btn-secondary btn-full">
                {reschedPending ? 'Saving…' : 'Confirm Reschedule'}
              </button>
            </form>
          )}
        </>
      )}

      {/* ── Mark Paid (completed + unpaid) ── */}
      {isCompleted && job.payment_status === 'unpaid' && (
        <>
          {venmoHandle && customerPhone && job.price && (
            <a
              href={`sms:${customerPhone}?&body=${encodeURIComponent(`Hi ${customerFirstName ?? ''}, friendly reminder for $${Number(job.price).toFixed(0)} for the lawn service. Pay via Venmo: https://venmo.com/${venmoHandle}?txn=pay&amount=${Number(job.price).toFixed(0)}&note=${encodeURIComponent('Lawn service')}\n\nThanks!${businessName ? ` — ${businessName}` : ''}`)}`}
              className="btn btn-secondary btn-full"
            >
              📲 Send Pay Reminder
            </a>
          )}
          <button type="button" className="btn btn-primary btn-full" onClick={() => setPanel(panel === 'paid' ? null : 'paid')}>
            $ Mark Paid
          </button>
          <button type="button" className="btn btn-secondary btn-full" onClick={() => setPanel(panel === 'partial' ? null : 'partial')}>
            Add Partial Payment
          </button>

          {panel === 'paid' && (
            <form action={paidAction} className="form action-panel">
              <div className="form-field">
                <label className="form-label">Payment Method</label>
                <select name="payment_method" className="form-select">
                  <option value="">Not specified</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="venmo">Venmo</option>
                  <option value="cashapp">CashApp</option>
                  <option value="zelle">Zelle</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={paidPending}
                className="btn btn-primary btn-full"
                onClick={() => {
                  if (customerPhone) {
                    const amt = job.price != null ? Number(job.price) : 0
                    setPendingReceipt({
                      smsBody: buildPaymentReceiptSms(customerFirstName, amt, true, 0, portalInvoiceUrl, businessPhone),
                      isPaidInFull: true,
                    })
                  }
                }}
              >
                {paidPending ? 'Saving…' : 'Confirm Full Payment'}
              </button>
            </form>
          )}

          {panel === 'partial' && (
            <form action={partialAction} className="form action-panel">
              <div className="form-field">
                <label className="form-label">Payment Amount ($)</label>
                <input
                  type="number"
                  name="amount_paid"
                  min="1"
                  step="1"
                  className="form-input"
                  placeholder={job.price ? String(Number(job.price).toFixed(0)) : '0'}
                  value={laterPartialAmt}
                  onChange={e => setLaterPartialAmt(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Payment Method</label>
                <select name="payment_method" className="form-select">
                  <option value="">Not specified</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="venmo">Venmo</option>
                  <option value="cashapp">CashApp</option>
                  <option value="zelle">Zelle</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={partialPending}
                className="btn btn-secondary btn-full"
                onClick={() => {
                  const amt = parseFloat(laterPartialAmt) || 0
                  const willBePaidInFull = amt >= partialRemaining
                  if (customerPhone && amt > 0) {
                    setPendingReceipt({
                      smsBody: buildPaymentReceiptSms(customerFirstName, amt, willBePaidInFull, willBePaidInFull ? 0 : Math.max(0, partialRemaining - amt), portalInvoiceUrl, businessPhone),
                      isPaidInFull: willBePaidInFull,
                    })
                  }
                  setLaterPartialAmt('')
                  setPanel(null)
                }}
              >
                {partialPending ? 'Saving…' : 'Record Partial Payment'}
              </button>
            </form>
          )}

        </>
      )}

      {/* ── Mark remaining paid (partial) ── */}
      {isCompleted && job.payment_status === 'partial' && (
        <>
          <div className="text-small" style={{ color: 'var(--color-warning)', padding: '4px 0' }}>
            Partial: ${Number(job.amount_paid ?? 0).toFixed(0)} of ${Number(job.price ?? 0).toFixed(0)} paid
            &nbsp;— ${(Number(job.price ?? 0) - Number(job.amount_paid ?? 0)).toFixed(0)} remaining
          </div>
          {venmoHandle && customerPhone && partialRemaining > 0 && (
            <a
              href={`sms:${customerPhone}?&body=${encodeURIComponent(`Hi ${customerFirstName ?? ''}, friendly reminder for the remaining $${partialRemaining.toFixed(0)} balance for your lawn service. Pay via Venmo: https://venmo.com/${venmoHandle}?txn=pay&amount=${partialRemaining.toFixed(0)}&note=${encodeURIComponent('Lawn service')}\n\nThanks!${businessName ? ` — ${businessName}` : ''}`)}`}
              className="btn btn-secondary btn-full"
            >
              📲 Send Pay Reminder
            </a>
          )}
          <button type="button" className="btn btn-primary btn-full" onClick={() => setPanel(panel === 'paid' ? null : 'paid')}>
            $ Mark Remaining Paid
          </button>
          {panel === 'paid' && (
            <form action={paidAction} className="form action-panel">
              <div className="form-field">
                <label className="form-label">Payment Method</label>
                <select name="payment_method" className="form-select">
                  <option value="">Not specified</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="venmo">Venmo</option>
                  <option value="cashapp">CashApp</option>
                  <option value="zelle">Zelle</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={paidPending}
                className="btn btn-primary btn-full"
                onClick={() => {
                  if (customerPhone) {
                    setPendingReceipt({
                      smsBody: buildPaymentReceiptSms(customerFirstName, partialRemaining, true, 0, portalInvoiceUrl, businessPhone),
                      isPaidInFull: true,
                    })
                  }
                }}
              >
                {paidPending ? 'Saving…' : 'Confirm Full Payment'}
              </button>
            </form>
          )}

          <button type="button" className="btn btn-secondary btn-full" onClick={() => setPanel(panel === 'partial' ? null : 'partial')}>
            Add Another Payment
          </button>
          {panel === 'partial' && (
            <form action={partialAction} className="form action-panel">
              <div className="form-field">
                <label className="form-label">Payment Amount ($)</label>
                <input
                  type="number"
                  name="amount_paid"
                  min="1"
                  step="1"
                  className="form-input"
                  placeholder={
                    job.price != null
                      ? String(Math.max(0, Number(job.price) - Number(job.amount_paid ?? 0)).toFixed(0))
                      : '0'
                  }
                  value={laterPartialAmt}
                  onChange={e => setLaterPartialAmt(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Payment Method</label>
                <select name="payment_method" className="form-select">
                  <option value="">Not specified</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="venmo">Venmo</option>
                  <option value="cashapp">CashApp</option>
                  <option value="zelle">Zelle</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={partialPending}
                className="btn btn-secondary btn-full"
                onClick={() => {
                  const amt = parseFloat(laterPartialAmt) || 0
                  const willBePaidInFull = amt >= partialRemaining
                  if (customerPhone && amt > 0) {
                    setPendingReceipt({
                      smsBody: buildPaymentReceiptSms(customerFirstName, amt, willBePaidInFull, willBePaidInFull ? 0 : Math.max(0, partialRemaining - amt), portalInvoiceUrl, businessPhone),
                      isPaidInFull: willBePaidInFull,
                    })
                  }
                  setLaterPartialAmt('')
                  setPanel(null)
                }}
              >
                {partialPending ? 'Saving…' : 'Record Payment'}
              </button>
            </form>
          )}

        </>
      )}

      {/* ── Terminal states (no actions) ── */}
      {(job.status === 'cancelled' || job.status === 'skipped') && (
        <p className="text-small text-muted" style={{ textAlign: 'center', padding: '8px 0' }}>
          This job is {job.status}. No further actions available.
        </p>
      )}
    </div>
  )
}

function buildInvoiceSms(
  firstName: string | null | undefined,
  job: Job,
  venmoHandle: string | null | undefined,
  amountPaidOverride?: number | null,
  businessPhone?: string | null,
  portalInvoiceUrl?: string | null,
): string {
  const name          = firstName ?? 'there'
  const jobPrice      = job.price != null ? Number(job.price) : null
  const effectivePaid = amountPaidOverride != null ? Math.max(0, amountPaidOverride) : null
  const isPaidInFull  = effectivePaid != null && jobPrice != null && effectivePaid >= jobPrice
  const isPartial     = effectivePaid != null && jobPrice != null && effectivePaid > 0 && !isPaidInFull
  const remaining     = (isPartial && jobPrice != null && effectivePaid != null)
    ? Math.max(0, jobPrice - effectivePaid)
    : null

  const lines: string[] = []

  if (isPaidInFull) {
    lines.push(`Hi ${name}, your lawn service is complete and paid in full. Thank you! 🙏`)
    if (portalInvoiceUrl) {
      lines.push('', 'View your receipt:', portalInvoiceUrl)
    }
  } else {
    lines.push(`Hi ${name}, your lawn service is complete.`)
    if (jobPrice != null) {
      lines.push('')
      lines.push(`Total: $${jobPrice.toFixed(0)}`)
      if (isPartial && effectivePaid != null) {
        lines.push(`Paid: $${effectivePaid.toFixed(0)}`)
        lines.push(`Balance due: $${remaining!.toFixed(0)}`)
      } else {
        lines.push(`Balance due: $${jobPrice.toFixed(0)}`)
      }
    }
    const venmoAmt = isPartial ? remaining : jobPrice
    if (venmoHandle && venmoAmt != null && venmoAmt > 0) {
      const venmoUrl = `https://venmo.com/${venmoHandle}?txn=pay&amount=${venmoAmt.toFixed(0)}&note=${encodeURIComponent('Lawn service')}`
      lines.push('', `Pay via Venmo: ${venmoUrl}`)
      lines.push('Cash is also accepted.')
    } else {
      lines.push('', 'Payment accepted via cash.')
    }
    if (portalInvoiceUrl) {
      lines.push('', 'View your invoice:', portalInvoiceUrl)
    }
  }

  lines.push('', 'Thank you for your business! 🌿')
  if (businessPhone) {
    lines.push(`Questions? Call or text ${businessPhone}`)
  }
  return lines.join('\n')
}

function buildPaymentReceiptSms(
  firstName: string | null | undefined,
  amtReceived: number,
  isPaidInFull: boolean,
  remainingBalance: number,
  portalInvoiceUrl?: string | null,
  businessPhone?: string | null,
): string {
  const name  = firstName ?? 'there'
  const lines: string[] = []

  if (isPaidInFull) {
    lines.push(`Hi ${name}, we received your $${amtReceived.toFixed(0)} payment for your lawn service. You're all paid up — thank you! 🙏`)
    if (portalInvoiceUrl) {
      lines.push('', 'View your receipt:', portalInvoiceUrl)
    }
  } else {
    lines.push(`Hi ${name}, we received your $${amtReceived.toFixed(0)} payment for your lawn service. Your remaining balance is $${remainingBalance.toFixed(0)}.`)
    if (portalInvoiceUrl) {
      lines.push('', 'View your invoice:', portalInvoiceUrl)
    }
  }

  lines.push('', 'Thank you for your business! 🌿')
  if (businessPhone) {
    lines.push(`Questions? Call or text ${businessPhone}`)
  }
  return lines.join('\n')
}

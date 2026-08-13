'use client'

import { useActionState, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { FormState, Job } from '@/types/database'
import { completeJob, markInProgress, skipJob, cancelJob, markPaid, markPartial, rescheduleJob } from '@/app/(protected)/jobs/actions'
import { buildDefaultCompletionNotes } from '@/lib/jobScope'
import { Toast } from '@/components/Toast'
import { SmsLink, launchSms } from '@/components/SmsLink'
import type { SmsMode } from '@/lib/sms'
import { calcJobBalance } from '@/lib/money'
import { buildInvoiceSms, buildPaymentReceiptSms, buildPayReminderSms } from '@/lib/smsTemplates'

export function JobActions({ job, venmoHandle, customerPhone, customerFirstName, businessName, businessPhone, portalInvoiceUrl, smsMode = 'device' }: { job: Job; venmoHandle?: string | null; customerPhone?: string | null; customerFirstName?: string | null; businessName?: string | null; businessPhone?: string | null; portalInvoiceUrl?: string | null; smsMode?: SmsMode }) {
  const [panel,          setPanel]         = useState<'complete' | 'skip' | 'paid' | 'partial' | 'reschedule' | null>(null)
  const [completionPayStatus,  setCompletionPayStatus]  = useState('unpaid')
  const [completionPartialAmt, setCompletionPartialAmt] = useState('')
  const [reschedReason,    setReschedReason]    = useState('')
  const [reschedTimeWin,   setReschedTimeWin]   = useState('')
  const [laterPartialAmt,  setLaterPartialAmt]  = useState('')
  const [pendingReceipt,   setPendingReceipt]   = useState<{ smsBody: string; isPaidInFull: boolean } | null>(null)
  const router = useRouter()

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
  // calcJobBalance is the single balance authority; coalesce to 0 only for
  // local gating math (buttons below independently suppress null-price flows).
  const partialRemaining = calcJobBalance(job) ?? 0

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
      // Auto-launch only in device mode. Google Voice mode needs a user
      // gesture (intent:// navigation is blocked without one) — the visible
      // "Send Invoice to Customer" button below handles it instead.
      if (customerPhone && invoiceSmsBody && smsMode !== 'google_voice') {
        window.location.href = `sms:${customerPhone}?&body=${encodeURIComponent(invoiceSmsBody)}`
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justCompleted])

  // Clear the partial amount input after each successful submission.
  // setState is deferred via setTimeout to satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    if (!partialState.success) return
    const id = setTimeout(() => setLaterPartialAmt(''), 0)
    return () => clearTimeout(id)
  }, [partialState])

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
            launchSms(customerPhone, pendingReceipt.smsBody, smsMode)
            setPendingReceipt(null)
          }}
        >
          📱 {pendingReceipt.isPaidInFull ? 'Send Receipt' : 'Send Payment Receipt'}
        </button>
      )}

      {/* ── Completion SMS prompt (fallback / re-send) ── */}
      {justCompleted && customerPhone && invoiceSmsBody && (
        <SmsLink phone={customerPhone} body={invoiceSmsBody} mode={smsMode} className="btn btn-primary btn-full">
          📱 Send Invoice to Customer
        </SmsLink>
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
                    <textarea name="completion_notes" className="form-textarea" rows={2} placeholder="Any notes about this visit…" defaultValue={buildDefaultCompletionNotes(job.job_inputs as Record<string, unknown> | null, job.service_package as string | null)} />
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
                      <p className="text-small text-muted" style={{ marginTop: '4px' }}>
                        Enter a price to record the correct payment amount and generate an invoice.
                      </p>
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
            <SmsLink
              phone={customerPhone}
              body={buildPayReminderSms(customerFirstName, Number(job.price), venmoHandle, businessName, false)}
              mode={smsMode}
              className="btn btn-secondary btn-full"
            >
              📲 Send Pay Reminder
            </SmsLink>
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
                  // No receipt when price is null — no dollar amount is calculable,
                  // and a "$0 payment" receipt is forbidden for null-price jobs.
                  if (customerPhone && job.price != null) {
                    setPendingReceipt({
                      smsBody: buildPaymentReceiptSms(customerFirstName, Number(job.price), true, 0, portalInvoiceUrl, businessPhone),
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
          {venmoHandle && customerPhone && partialRemaining > 0 && (
            <SmsLink
              phone={customerPhone}
              body={buildPayReminderSms(customerFirstName, partialRemaining, venmoHandle, businessName, true)}
              mode={smsMode}
              className="btn btn-secondary btn-full"
            >
              📲 Send Pay Reminder
            </SmsLink>
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
                  // Null price → partialRemaining coerces to $0; suppress the receipt
                  // rather than sending a "$0 payment" SMS.
                  if (customerPhone && job.price != null) {
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
                      ? String((calcJobBalance(job) ?? 0).toFixed(0))
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

'use client'

import { useActionState, useState, useRef, useEffect } from 'react'
import type { FormState, Job } from '@/types/database'
import { completeJob, markInProgress, skipJob, cancelJob, markPaid, rescheduleJob } from '@/app/(protected)/jobs/actions'
import { Toast } from '@/components/Toast'

export function JobActions({ job, venmoHandle, customerPhone, customerFirstName }: { job: Job; venmoHandle?: string | null; customerPhone?: string | null; customerFirstName?: string | null }) {
  const [panel,      setPanel]      = useState<'complete' | 'skip' | 'paid' | 'reschedule' | null>(null)
  const [markAsPaid, setMarkAsPaid] = useState(false)
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
  const [reschedState,   reschedAction,   reschedPending]   = useActionState<FormState, FormData>(rescheduleJob.bind(null, job.id), { error: null })

  const anyError      = completeState.error ?? skipState.error ?? paidState.error ?? startState.error ?? cancelState.error ?? reschedState.error
  const anySuccess    = completeState.success ?? skipState.success ?? paidState.success ?? startState.success ?? cancelState.success ?? reschedState.success
  const justCompleted = !!completeState.success

  const isActive    = job.status === 'scheduled' || job.status === 'in_progress'
  const isCompleted = job.status === 'completed'

  // Build invoice SMS body (used both for auto-launch and manual button)
  const invoiceSmsBody = customerPhone
    ? buildInvoiceSms(customerFirstName, job, venmoHandle)
    : null

  // Auto-launch SMS compose when job is first marked complete
  useEffect(() => {
    if (justCompleted && customerPhone && invoiceSmsBody) {
      window.location.href = `sms:${customerPhone}?&body=${encodeURIComponent(invoiceSmsBody)}`
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justCompleted])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Toast message={anySuccess} />
      {anyError && <div className="alert alert-error">{anyError}</div>}

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
                        defaultValue="unpaid"
                        onChange={e => setMarkAsPaid(e.target.value === 'paid')}
                      >
                        <option value="unpaid">Unpaid</option>
                        <option value="paid">Paid now</option>
                        <option value="not_billable">Not billable</option>
                      </select>
                    </div>
                  </div>

                  {markAsPaid && (
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

          {/* Rain Reschedule */}
          <button
            type="button"
            className="btn btn-sm btn-secondary btn-full"
            onClick={() => setPanel(panel === 'reschedule' ? null : 'reschedule')}
          >
            🌧 Rain Reschedule
          </button>

          {panel === 'reschedule' && (
            <form action={reschedAction} className="form action-panel">
              <div className="form-field">
                <label className="form-label">New Date</label>
                <input name="new_date" type="date" className="form-input" required />
              </div>
              <div className="form-field">
                <label className="form-label">Notes (optional)</label>
                <input name="internal_notes" className="form-input" placeholder="Rained out — rescheduled" defaultValue="Rained out — rescheduled" />
              </div>
              <button type="submit" disabled={reschedPending} className="btn btn-secondary btn-full">
                {reschedPending ? 'Saving…' : 'Confirm Reschedule'}
              </button>
            </form>
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

      {/* ── Mark Paid (completed + unpaid) ── */}
      {isCompleted && job.payment_status === 'unpaid' && (
        <>
          {venmoHandle && customerPhone && job.price && (
            <a
              href={`sms:${customerPhone}?&body=${encodeURIComponent(`Hi ${customerFirstName ?? ''}, friendly reminder for $${Number(job.price).toFixed(0)} for the lawn service. Pay via Venmo: https://venmo.com/${venmoHandle}?txn=pay&amount=${Number(job.price).toFixed(0)}&note=${encodeURIComponent('Lawn service')}\n\nThanks!`)}`}
              className="btn btn-secondary btn-full"
            >
              📲 Send Pay Reminder
            </a>
          )}
          <button
            type="button"
            className="btn btn-primary btn-full"
            onClick={() => setPanel(panel === 'paid' ? null : 'paid')}
          >
            $ Mark Paid
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
              <button type="submit" disabled={paidPending} className="btn btn-primary btn-full">
                {paidPending ? 'Saving…' : 'Confirm Payment'}
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
): string {
  const name = firstName ?? 'there'
  const lines: string[] = [
    `Hi ${name}, your lawn service is complete! ✅`,
    '',
  ]
  if (job.service_package) {
    lines.push(`Service: ${job.service_package.replace(/_/g, ' ')}`)
  }
  if (job.completed_at) {
    const d = new Date(job.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    lines.push(`Date: ${d}`)
  }
  if (job.price != null) {
    lines.push(`Total: $${Number(job.price).toFixed(0)}`)
  }
  if (venmoHandle && job.price != null) {
    const venmoUrl = `https://venmo.com/${venmoHandle}?txn=pay&amount=${Number(job.price).toFixed(0)}&note=${encodeURIComponent('Lawn service')}`
    lines.push('', `Pay via Venmo: ${venmoUrl}`)
    lines.push('Cash is also accepted.')
  } else {
    lines.push('', 'Payment accepted via cash.')
  }
  lines.push('', 'Thank you for your business! 🌿')
  return lines.join('\n')
}

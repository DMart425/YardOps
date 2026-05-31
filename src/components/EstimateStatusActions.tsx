'use client'

import { useActionState, useState } from 'react'
import type { FormState } from '@/types/database'
import { convertToJob, manuallyApproveEstimate, updateEstimateStatus } from '@/app/(protected)/estimates/actions'
import { Toast } from '@/components/Toast'

export function EstimateStatusActions({
  estimate,
  localToday,
}: {
  estimate: { id: string; status: string; total: number; revision_number: number }
  localToday: string
}) {
  const [panel, setPanel] = useState<'approve' | 'convert' | null>(null)

  const [sentState,     sentAction,     sentPending]     = useActionState<FormState, FormData>(
    updateEstimateStatus.bind(null, estimate.id, 'sent'), { error: null }
  )
  const [approvedState, approvedAction, approvedPending] = useActionState<FormState, FormData>(
    manuallyApproveEstimate.bind(null, estimate.id), { error: null }
  )
  const [declinedState, declinedAction, declinedPending] = useActionState<FormState, FormData>(
    updateEstimateStatus.bind(null, estimate.id, 'declined'), { error: null }
  )
  const [convertState, convertAction, convertPending] = useActionState<FormState, FormData>(
    convertToJob.bind(null, estimate.id), { error: null }
  )

  const anySuccess = sentState.success ?? approvedState.success ?? declinedState.success ?? convertState.success
  const anyError   = sentState.error   ?? approvedState.error   ?? declinedState.error   ?? convertState.error

  const today = localToday

  if (estimate.status === 'converted') {
    return <p className="text-small text-muted" style={{ textAlign: 'center', padding: '8px 0' }}>This estimate has been converted to a job.</p>
  }
  if (estimate.status === 'declined') {
    return <p className="text-small text-muted" style={{ textAlign: 'center', padding: '8px 0' }}>This estimate was declined.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Toast message={anySuccess} />
      {anyError && <div className="alert alert-error">{anyError}</div>}

      {/* Mark sent */}
      {estimate.status === 'draft' && (
        <form action={sentAction}>
          <button type="submit" disabled={sentPending} className="btn btn-secondary btn-full">
            {sentPending ? '…' : estimate.revision_number > 1 ? '📤 Send Revised Estimate' : '📤 Mark as Sent'}
          </button>
        </form>
      )}

      {/* Mark approved */}
      {(estimate.status === 'draft' || estimate.status === 'sent') && (
        <>
          <button
            type="button"
            className="btn btn-secondary btn-full"
            onClick={() => setPanel(panel === 'approve' ? null : 'approve')}
          >
            ✓ Mark as Approved
          </button>

          {panel === 'approve' && (
            <form action={approvedAction} className="form action-panel">
              <div className="form-field">
                <label className="form-label" htmlFor="approval_note">Approval note</label>
                <textarea
                  id="approval_note"
                  name="approval_note"
                  className="form-textarea"
                  rows={3}
                  required
                  placeholder="How was this approved? Text, call, or in-person details..."
                />
              </div>
              <button type="submit" disabled={approvedPending} className="btn btn-secondary btn-full">
                {approvedPending ? 'Saving…' : 'Confirm Manual Approval'}
              </button>
            </form>
          )}
        </>
      )}

      {/* Convert to job */}
      {estimate.status === 'approved' && (
        <>
          <button
            type="button"
            className="btn btn-primary btn-full"
            onClick={() => setPanel(panel === 'convert' ? null : 'convert')}
          >
            ▶ Convert to Job
          </button>

          {panel === 'convert' && (
            <form action={convertAction} className="form action-panel">
              <div className="form-row">
                <div className="form-field">
                  <label className="form-label">Scheduled Date</label>
                  <input name="scheduled_date" type="date" className="form-input" defaultValue={today} />
                </div>
                <div className="form-field">
                  <label className="form-label">Time Window</label>
                  <select name="scheduled_time_window" className="form-select" defaultValue="">
                    <option value="">Any time</option>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                  </select>
                </div>
              </div>
              <div className="card-row">
                <span className="text-small text-muted">Price from estimate</span>
                <span className="font-bold">${Number(estimate.total).toFixed(2)}</span>
              </div>
              <button type="submit" disabled={convertPending} className="btn btn-primary btn-full">
                {convertPending ? 'Creating…' : 'Confirm — Create Job'}
              </button>
            </form>
          )}
        </>
      )}

      {/* Decline */}
      {estimate.status !== 'declined' && estimate.status !== 'converted' && (
        <form action={declinedAction}>
          <button type="submit" disabled={declinedPending} className="btn btn-sm btn-danger btn-full">
            {declinedPending ? '…' : 'Mark Declined'}
          </button>
        </form>
      )}
    </div>
  )
}

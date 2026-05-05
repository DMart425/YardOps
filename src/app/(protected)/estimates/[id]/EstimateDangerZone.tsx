'use client'

import { useActionState } from 'react'
import type { FormState } from '@/types/database'
import { deleteEstimate } from './actions'

export default function EstimateDangerZone({ estimateId }: { estimateId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    deleteEstimate.bind(null, estimateId),
    { error: null }
  )

  return (
    <div className="detail-section" style={{ marginTop: '16px' }}>
      <div className="section-heading" style={{ color: 'var(--color-danger)' }}>Estimate Danger Zone</div>
      <div className="card" style={{ borderColor: '#fca5a5' }}>
        {state.error && <div className="alert alert-error" style={{ marginBottom: '10px' }}>{state.error}</div>}
        <p className="text-small text-muted" style={{ marginBottom: '10px' }}>
          This permanently deletes the estimate record and its estimate line items.
        </p>
        <p className="text-small text-muted" style={{ marginBottom: '10px' }}>
          This does not delete the customer, property, jobs, message logs, payments, expenses, or other business records.
        </p>
        <p className="text-small text-muted" style={{ marginBottom: '10px' }}>
          If a job was created from this estimate, that job will remain.
        </p>

        <form action={action} className="form">
          <div className="form-field" style={{ marginBottom: '8px' }}>
            <label className="form-label" htmlFor="estimate_delete_confirmation">Type DELETE to confirm</label>
            <input
              id="estimate_delete_confirmation"
              name="delete_confirmation"
              className="form-input"
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>

          <button type="submit" disabled={pending} className="btn btn-danger">
            {pending ? 'Deleting...' : 'Delete Estimate'}
          </button>
        </form>
      </div>
    </div>
  )
}

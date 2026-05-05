'use client'

import { useActionState } from 'react'
import type { FormState } from '@/types/database'
import { reassignProperty, restoreProperty } from '../actions'

type CustomerOption = {
  id: string
  first_name: string
  last_name: string | null
}

export function PropertyAssignmentSection({
  propertyId,
  currentCustomerName,
  currentCustomerStatus,
  currentCustomerId,
  customers,
  propertyStatus,
}: {
  propertyId: string
  currentCustomerName: string
  currentCustomerStatus: string | null
  currentCustomerId: string
  customers: CustomerOption[]
  propertyStatus: string
}) {
  const [reassignState, reassignAction, reassignPending] = useActionState<FormState, FormData>(
    reassignProperty.bind(null, propertyId),
    { error: null }
  )
  const [restoreState, restoreAction, restorePending] = useActionState<FormState, FormData>(
    restoreProperty.bind(null, propertyId),
    { error: null }
  )

  const message = reassignState.error ?? restoreState.error ?? reassignState.success ?? restoreState.success
  const isError = Boolean(reassignState.error ?? restoreState.error)

  return (
    <div className="detail-section">
      <div className="section-heading">Property Assignment</div>
      <div className="card">
        {message && (
          <div className={isError ? 'alert alert-error' : 'alert alert-success'} style={{ marginBottom: '10px' }}>
            {message}
          </div>
        )}

        <div className="card-row" style={{ marginBottom: '10px' }}>
          <span className="text-small text-muted">Currently assigned to</span>
          <span className="text-small">
            {currentCustomerName}
            {currentCustomerStatus ? ` (${currentCustomerStatus})` : ''}
          </span>
        </div>

        <p className="text-small text-muted" style={{ marginBottom: '10px' }}>
          This only changes who the property is assigned to going forward. Existing jobs and estimates remain unchanged.
        </p>

        <form action={reassignAction} className="form">
          <div className="form-field" style={{ marginBottom: '10px' }}>
            <label className="form-label" htmlFor="new_customer_id">Assign to customer</label>
            <select
              id="new_customer_id"
              name="new_customer_id"
              className="form-select"
              defaultValue={currentCustomerId}
            >
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.first_name}{c.last_name ? ` ${c.last_name}` : ''}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-secondary" disabled={reassignPending}>
            {reassignPending ? 'Reassigning...' : 'Reassign Property'}
          </button>
        </form>

        {propertyStatus === 'archived' && (
          <>
            <div className="divider" />
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>Restore Property</div>
              <p className="text-small text-muted" style={{ marginBottom: '10px' }}>
                This will unarchive the property and set its status back to active.
              </p>
              <form action={restoreAction}>
                <button type="submit" className="btn btn-secondary" disabled={restorePending}>
                  {restorePending ? 'Restoring...' : 'Restore Property'}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

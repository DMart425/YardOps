'use client'

import { useActionState } from 'react'
import type { FormState } from '@/types/database'
import { archiveCustomer, deleteCustomerPermanently, deleteTestCustomerWithLinkedTestRecords } from '../actions'

export function CustomerDangerZone({ customerId }: { customerId: string }) {
  const [archiveState, archiveAction, archivePending] = useActionState<FormState, FormData>(
    archiveCustomer.bind(null, customerId),
    { error: null }
  )
  const [deleteState, deleteAction, deletePending] = useActionState<FormState, FormData>(
    deleteCustomerPermanently.bind(null, customerId),
    { error: null }
  )
  const [deleteTestState, deleteTestAction, deleteTestPending] = useActionState<FormState, FormData>(
    deleteTestCustomerWithLinkedTestRecords.bind(null, customerId),
    { error: null }
  )

  const errorMessage = archiveState.error ?? deleteState.error ?? deleteTestState.error

  return (
    <div className="detail-section">
      <div className="section-heading" style={{ color: 'var(--color-danger)' }}>Danger Zone</div>
      <div className="card" style={{ borderColor: '#fca5a5' }}>
        {errorMessage && <div className="alert alert-error" style={{ marginBottom: '10px' }}>{errorMessage}</div>}

        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Archive Customer</div>
          <p className="text-small text-muted" style={{ marginBottom: '8px' }}>
            Hides this customer from normal active lists but keeps all business history.
          </p>
          <form
            action={archiveAction}
            onSubmit={(e) => {
              if (!confirm('Archive this customer? This will hide them from normal active lists but keep history.')) {
                e.preventDefault()
              }
            }}
          >
            <button type="submit" disabled={archivePending} className="btn btn-secondary">
              {archivePending ? 'Archiving...' : 'Archive Customer'}
            </button>
          </form>
        </div>

        <div className="divider" />

        <div style={{ marginTop: '14px' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--color-danger)' }}>Permanent Delete</div>
          <p className="text-small text-muted" style={{ marginBottom: '8px' }}>
            Deletes this customer permanently only when there is no business history. Type DELETE to confirm.
          </p>
          <form action={deleteAction} className="form">
            <div className="form-field" style={{ marginBottom: '8px' }}>
              <label className="form-label" htmlFor="customer_delete_confirmation">Type DELETE to confirm</label>
              <input
                id="customer_delete_confirmation"
                name="delete_confirmation"
                className="form-input"
                placeholder="DELETE"
                autoComplete="off"
              />
            </div>
            <button type="submit" disabled={deletePending} className="btn btn-danger">
              {deletePending ? 'Deleting...' : 'Permanently Delete Customer'}
            </button>
          </form>
        </div>

        <div className="divider" />

        <div style={{ marginTop: '14px' }}>
          <div style={{ fontWeight: 700, marginBottom: '4px', color: 'var(--color-danger)' }}>
            Delete Test Customer + Linked Test Records
          </div>
          <p className="text-small" style={{ marginBottom: '8px', color: 'var(--color-danger)' }}>
            Extreme danger: this is only for fake localhost test data cleanup and cannot be undone.
          </p>
          <p className="text-small text-muted" style={{ marginBottom: '8px' }}>
            This removes linked records owned by you for this customer, then deletes the customer.
          </p>
          <form action={deleteTestAction} className="form">
            <div className="form-field" style={{ marginBottom: '8px' }}>
              <label className="form-label" htmlFor="customer_delete_test_confirmation">Type DELETE TEST DATA to confirm</label>
              <input
                id="customer_delete_test_confirmation"
                name="delete_test_confirmation"
                className="form-input"
                placeholder="DELETE TEST DATA"
                autoComplete="off"
              />
            </div>
            <button type="submit" disabled={deleteTestPending} className="btn btn-danger">
              {deleteTestPending ? 'Deleting Test Data...' : 'Delete Test Customer + Linked Test Records'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

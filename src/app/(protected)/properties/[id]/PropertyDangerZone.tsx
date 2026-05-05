'use client'

import { useActionState } from 'react'
import type { FormState } from '@/types/database'
import { archiveProperty, deletePropertyPermanently } from '../actions'

export function PropertyDangerZone({ propertyId }: { propertyId: string }) {
  const [archiveState, archiveAction, archivePending] = useActionState<FormState, FormData>(
    archiveProperty.bind(null, propertyId),
    { error: null }
  )
  const [deleteState, deleteAction, deletePending] = useActionState<FormState, FormData>(
    deletePropertyPermanently.bind(null, propertyId),
    { error: null }
  )

  const errorMessage = archiveState.error ?? deleteState.error

  return (
    <div className="detail-section">
      <div className="section-heading" style={{ color: 'var(--color-danger)' }}>Danger Zone</div>
      <div className="card" style={{ borderColor: '#fca5a5' }}>
        {errorMessage && <div className="alert alert-error" style={{ marginBottom: '10px' }}>{errorMessage}</div>}

        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Archive Property</div>
          <p className="text-small text-muted" style={{ marginBottom: '8px' }}>
            Hides this property from normal active lists but keeps all business history.
          </p>
          <form
            action={archiveAction}
            onSubmit={(e) => {
              if (!confirm('Archive this property? This will hide it from normal active lists but keep history.')) {
                e.preventDefault()
              }
            }}
          >
            <button type="submit" disabled={archivePending} className="btn btn-secondary">
              {archivePending ? 'Archiving...' : 'Archive Property'}
            </button>
          </form>
        </div>

        <div className="divider" />

        <div style={{ marginTop: '14px' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--color-danger)' }}>Permanent Delete</div>
          <p className="text-small text-muted" style={{ marginBottom: '8px' }}>
            Deletes this property permanently only when there is no business history. Type DELETE to confirm.
          </p>
          <form action={deleteAction} className="form">
            <div className="form-field" style={{ marginBottom: '8px' }}>
              <label className="form-label" htmlFor="property_delete_confirmation">Type DELETE to confirm</label>
              <input
                id="property_delete_confirmation"
                name="delete_confirmation"
                className="form-input"
                placeholder="DELETE"
                autoComplete="off"
              />
            </div>
            <button type="submit" disabled={deletePending} className="btn btn-danger">
              {deletePending ? 'Deleting...' : 'Permanently Delete Property'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

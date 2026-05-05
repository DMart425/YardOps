'use client'

import { useActionState } from 'react'
import type { FormState } from '@/types/database'
import { convertWebsiteLead, dismissWebsiteLead } from '../../actions'
import { deleteWebsiteLead } from '../../actions'

export function WebsiteLeadStatusActions({ leadId }: { leadId: string }) {
  const [convertState, convertAction, convertPending] = useActionState<FormState, FormData>(
    convertWebsiteLead.bind(null, leadId),
    { error: null }
  )
  const [dismissState, dismissAction, dismissPending] = useActionState<FormState, FormData>(
    dismissWebsiteLead.bind(null, leadId),
    { error: null }
  )
  const anyError = convertState.error ?? dismissState.error

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {anyError && <div className="alert alert-error">{anyError}</div>}
      <form action={convertAction}>
        <button type="submit" disabled={convertPending} className="btn btn-primary btn-full">
          {convertPending ? 'Converting…' : '✓ Convert to Lead'}
        </button>
      </form>
      <form action={dismissAction}>
        <button type="submit" disabled={dismissPending} className="btn btn-sm btn-secondary btn-full">
          {dismissPending ? '…' : 'Dismiss (keep archived)'}
        </button>
      </form>
    </div>
  )
}

export function WebsiteLeadDangerZone({ leadId }: { leadId: string }) {
  const [deleteState, deleteAction, deletePending] = useActionState<FormState, FormData>(
    deleteWebsiteLead,
    { error: null }
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {deleteState.error && <div className="alert alert-error">{deleteState.error}</div>}
      <div className="card" style={{ borderColor: '#fca5a5', background: 'var(--color-bg-secondary)' }}>
        <div className="section-heading" style={{ color: 'var(--color-danger)', marginBottom: '8px' }}>Danger Zone</div>
        <p className="text-small text-muted" style={{ marginBottom: '8px' }}>
          Permanently deletes only this website lead request. This cannot be undone.
        </p>
        <form action={deleteAction} className="form">
          <input type="hidden" name="lead_id" value={leadId} />
          <div className="form-field" style={{ marginBottom: '8px' }}>
            <label className="form-label" htmlFor="website_lead_delete_confirmation">Type DELETE to confirm</label>
            <input
              id="website_lead_delete_confirmation"
              name="delete_confirmation"
              className="form-input"
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>
          <button type="submit" disabled={deletePending} className="btn btn-sm btn-danger btn-full">
            {deletePending ? '…' : 'Permanently Delete Website Lead'}
          </button>
        </form>
      </div>
    </div>
  )
}

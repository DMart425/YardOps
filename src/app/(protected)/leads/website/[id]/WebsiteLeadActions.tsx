'use client'

import { useActionState } from 'react'
import type { FormState } from '@/types/database'
import { convertWebsiteLead, dismissWebsiteLead } from '../../actions'
import { deleteWebsiteLead } from '../../actions'

export function WebsiteLeadActions({ leadId }: { leadId: string }) {
  const [convertState, convertAction, convertPending] = useActionState<FormState, FormData>(
    convertWebsiteLead.bind(null, leadId),
    { error: null }
  )
  const [dismissState, dismissAction, dismissPending] = useActionState<FormState, FormData>(
    dismissWebsiteLead.bind(null, leadId),
    { error: null }
  )
  const [deleteState, deleteAction, deletePending] = useActionState<FormState, FormData>(
    deleteWebsiteLead,
    { error: null }
  )

  const anyError = convertState.error ?? dismissState.error ?? deleteState.error

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
      <form
        action={deleteAction}
        onSubmit={(e) => {
          if (!confirm('Permanently delete this lead?')) e.preventDefault()
        }}
      >
        <input type="hidden" name="lead_id" value={leadId} />
        <button type="submit" disabled={deletePending} className="btn btn-sm btn-danger btn-full">
          {deletePending ? '…' : 'Delete'}
        </button>
      </form>
    </div>
  )
}

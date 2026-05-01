'use client'

import { useActionState } from 'react'
import type { FormState } from '@/types/database'
import { deleteWebsiteLead, clearAllWebsiteLeads } from './actions'

export function DeleteWebsiteLeadButton({ leadId }: { leadId: string }) {
  const [, action, pending] = useActionState<FormState, FormData>(deleteWebsiteLead, { error: null })

  return (
    <form action={action} onClick={(e) => e.stopPropagation()}>
      <input type="hidden" name="lead_id" value={leadId} />
      <button
        type="submit"
        disabled={pending}
        className="btn btn-sm btn-danger"
        title="Delete"
        style={{ padding: '4px 8px', minWidth: 0 }}
      >
        {pending ? '…' : '✕'}
      </button>
    </form>
  )
}

export function ClearAllWebsiteLeadsButton() {
  const [, action, pending] = useActionState<FormState, FormData>(clearAllWebsiteLeads, { error: null })

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm('Delete ALL website leads? This cannot be undone.')) e.preventDefault()
      }}
    >
      <button type="submit" disabled={pending} className="btn btn-sm btn-danger">
        {pending ? 'Deleting…' : 'Clear All'}
      </button>
    </form>
  )
}

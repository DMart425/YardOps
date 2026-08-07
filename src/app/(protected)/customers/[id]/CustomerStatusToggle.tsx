'use client'

import { useActionState } from 'react'
import type { FormState } from '@/types/database'
import { restoreArchivedCustomer, setCustomerActiveStatus } from '../actions'

// Status control on the customer info card's Status row.
// - active ⇄ inactive: inactive customers keep full history but stop
//   appearing in the Today retention alerts.
// - archived → restore: comes back as inactive (never straight to active,
//   so restoring can't instantly resurface someone in alerts).
export function CustomerStatusToggle({
  customerId,
  currentStatus,
}: {
  customerId: string
  currentStatus: 'active' | 'inactive' | 'archived'
}) {
  const isArchived = currentStatus === 'archived'
  const boundAction = isArchived
    ? restoreArchivedCustomer.bind(null, customerId)
    : setCustomerActiveStatus.bind(null, customerId, currentStatus === 'active' ? 'inactive' : 'active')

  const [state, action, pending] = useActionState<FormState, FormData>(boundAction, { error: null })

  return (
    <div>
      {state.error && <div className="alert alert-error" style={{ marginBottom: '8px' }}>{state.error}</div>}
      {state.success && <div className="alert alert-success" style={{ marginBottom: '8px' }}>{state.success}</div>}
      <form action={action}>
        <button type="submit" disabled={pending} className="btn btn-secondary btn-sm">
          {pending
            ? 'Updating…'
            : isArchived
              ? '♻ Restore Customer'
              : currentStatus === 'active'
                ? '⏸ Mark Inactive'
                : '▶ Mark Active'}
        </button>
      </form>
    </div>
  )
}

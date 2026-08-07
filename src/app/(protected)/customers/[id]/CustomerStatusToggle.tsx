'use client'

import { useActionState } from 'react'
import type { FormState } from '@/types/database'
import { setCustomerActiveStatus } from '../actions'

// Small active/inactive toggle shown on the customer detail header area.
// Inactive customers keep their full history but stop appearing in the
// Today retention alerts.
export function CustomerStatusToggle({
  customerId,
  currentStatus,
}: {
  customerId: string
  currentStatus: 'active' | 'inactive'
}) {
  const nextStatus = currentStatus === 'active' ? 'inactive' : 'active'
  const [state, action, pending] = useActionState<FormState, FormData>(
    setCustomerActiveStatus.bind(null, customerId, nextStatus),
    { error: null }
  )

  return (
    <div>
      {state.error && <div className="alert alert-error" style={{ marginBottom: '8px' }}>{state.error}</div>}
      {state.success && <div className="alert alert-success" style={{ marginBottom: '8px' }}>{state.success}</div>}
      <form action={action}>
        <button type="submit" disabled={pending} className="btn btn-secondary btn-sm">
          {pending
            ? 'Updating…'
            : currentStatus === 'active'
              ? '⏸ Mark Inactive'
              : '▶ Mark Active'}
        </button>
      </form>
    </div>
  )
}

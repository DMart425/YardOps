'use client'

import { useActionState } from 'react'
import type { FormState } from '@/types/database'
import { markLeadCustomerActive } from '../actions'

export function LeadStatusActions({ customerId }: { customerId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    markLeadCustomerActive.bind(null, customerId),
    { error: null }
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {state.success && <div className="alert alert-success">{state.success}</div>}
      <form action={action}>
        <button type="submit" disabled={pending} className="btn btn-primary btn-full">
          {pending ? 'Updating…' : 'Mark as Active Customer'}
        </button>
      </form>
    </div>
  )
}

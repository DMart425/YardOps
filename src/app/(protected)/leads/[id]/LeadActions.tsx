'use client'

import { useActionState } from 'react'
import type { FormState } from '@/types/database'
import { archiveLead } from '../actions'

export function LeadActions({ customerId }: { customerId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    archiveLead.bind(null, customerId),
    { error: null }
  )

  return (
    <>
      {state.error && <div className="alert alert-error">{state.error}</div>}
      <form action={action}>
        <button type="submit" disabled={pending} className="btn btn-sm btn-danger btn-full">
          {pending ? '…' : 'Archive Lead'}
        </button>
      </form>
    </>
  )
}

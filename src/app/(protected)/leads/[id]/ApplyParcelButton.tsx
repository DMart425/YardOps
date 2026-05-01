'use client'

import { useActionState } from 'react'
import type { FormState } from '@/types/database'
import { applyParcelToProperty } from '@/app/(protected)/properties/actions'

type Props = {
  propertyId: string
  parcelId: string
  parcelAcres: number
  mowableAcres: number
  alreadyApplied: boolean
}

export function ApplyParcelButton({ propertyId, parcelId, parcelAcres, mowableAcres, alreadyApplied }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(applyParcelToProperty, { error: null })

  if (alreadyApplied) {
    return <p className="text-small" style={{ color: 'var(--color-primary)' }}>✓ Parcel data already applied</p>
  }

  return (
    <>
      {state.error && <p className="text-small" style={{ color: 'var(--color-danger)' }}>{state.error}</p>}
      {state.success && <p className="text-small" style={{ color: 'var(--color-primary)' }}>✓ {state.success}</p>}
      {!state.success && (
        <form action={action}>
          <input type="hidden" name="property_id" value={propertyId} />
          <input type="hidden" name="parcel_id" value={parcelId} />
          <input type="hidden" name="parcel_acres" value={parcelAcres} />
          <input type="hidden" name="mowable_acres" value={mowableAcres} />
          <button type="submit" disabled={pending} className="btn btn-sm btn-secondary">
            {pending ? 'Applying…' : 'Apply to Property'}
          </button>
        </form>
      )}
    </>
  )
}

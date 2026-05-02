'use client'

import { useActionState } from 'react'
import type { FormState } from '@/types/database'
import { backfillPropertyCoordinates } from '@/app/(protected)/properties/actions'
import { Toast } from '@/components/Toast'

export function BackfillCoordinatesButton() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    backfillPropertyCoordinates,
    { error: null }
  )

  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <div className="section-heading" style={{ marginBottom: '0.5rem' }}>Property Coordinates</div>
      <p className="text-small text-muted" style={{ marginBottom: '0.75rem' }}>
        Geocode any properties missing latitude/longitude so weather forecasts work.
        This may take a moment — about 1 second per property.
      </p>
      <Toast message={state.success} />
      {state.error && <div className="alert alert-error" style={{ marginBottom: '8px' }}>{state.error}</div>}
      <form action={action}>
        <button type="submit" disabled={pending} className="btn btn-secondary">
          {pending ? 'Geocoding…' : 'Backfill Missing Coordinates'}
        </button>
      </form>
    </div>
  )
}

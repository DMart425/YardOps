'use client'

import { useState } from 'react'
import type { Property } from '@/types/database'
import { PropertyForm } from '@/components/forms/PropertyForm'
import { updateProperty } from '../actions'

type CustomerOption = {
  id: string
  first_name: string
  last_name: string | null
  status?: string | null
}

export function PropertyEditSection({
  propertyId,
  customers,
  defaultValues,
  safeReturnTo,
}: {
  propertyId: string
  customers: CustomerOption[]
  defaultValues: Property
  safeReturnTo?: string
}) {
  const [isEditing, setIsEditing] = useState(false)

  if (!isEditing) {
    return (
      <div className="detail-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="section-heading" style={{ marginBottom: 0 }}>Property Info</div>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setIsEditing(true)}>
            Edit Property
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="detail-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div className="section-heading" style={{ marginBottom: 0 }}>Edit Property</div>
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => setIsEditing(false)}>
          Close
        </button>
      </div>
      <div className="card">
        <PropertyForm
          action={updateProperty.bind(null, propertyId)}
          submitLabel="Save Changes"
          cancelHref={safeReturnTo ?? '/properties'}
          returnTo={safeReturnTo}
          customers={customers}
          defaultValues={defaultValues}
        />
      </div>
    </div>
  )
}

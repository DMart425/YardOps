'use client'

import { useState } from 'react'
import type { Customer } from '@/types/database'
import { CustomerEditForm } from './_form'

type CustomerWithTags = Customer & { tags?: string[] | null }

export function CustomerInfoSection({ customer }: { customer: CustomerWithTags }) {
  const [isEditing, setIsEditing] = useState(false)

  const tags = customer.tags ?? []

  if (isEditing) {
    return (
      <div className="detail-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div className="section-heading" style={{ marginBottom: 0 }}>Edit Customer Info</div>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setIsEditing(false)}>
            Close
          </button>
        </div>
        <div className="card">
          <CustomerEditForm customer={customer} />
        </div>
      </div>
    )
  }

  return (
    <div className="detail-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div className="section-heading" style={{ marginBottom: 0 }}>Customer Info</div>
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => setIsEditing(true)}>
          Edit Customer
        </button>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {customer.phone && <div className="card-meta">📞 {customer.phone}</div>}
        {customer.email && <div className="card-meta">✉ {customer.email}</div>}
        {customer.preferred_contact_method && (
          <div className="card-meta">Preferred contact: {customer.preferred_contact_method.replace(/_/g, ' ')}</div>
        )}
        <div className="card-meta">Status: {customer.status.replace(/_/g, ' ')}</div>
        {customer.notes && <div className="card-meta">Notes: {customer.notes}</div>}
        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
            {tags.map((tag) => (
              <span key={tag} className="pill pill-draft">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

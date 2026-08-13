'use client'

import { useState } from 'react'
import type { Customer } from '@/types/database'
import { CustomerEditForm } from './_form'
import { CustomerStatusToggle } from './CustomerStatusToggle'
import { SmsLink } from '@/components/SmsLink'
import type { SmsMode } from '@/lib/sms'

type CustomerWithTags = Customer & { tags?: string[] | null }

export function CustomerInfoSection({ customer, mapsAddress, smsMode = 'device' }: { customer: CustomerWithTags; mapsAddress?: string | null; smsMode?: SmsMode }) {
  const [isEditing, setIsEditing] = useState(false)

  const tags = customer.tags ?? []
  const mapUrl = mapsAddress ? `https://maps.google.com/?q=${encodeURIComponent(mapsAddress)}` : null

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
        {/* Status lives with the customer record (not the testing-only danger
            zone): inactive customers keep history but leave the Today alerts. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <span className="card-meta">Status: {customer.status.replace(/_/g, ' ')}</span>
          {(customer.status === 'active' || customer.status === 'inactive' || customer.status === 'archived') && (
            <CustomerStatusToggle customerId={customer.id} currentStatus={customer.status} />
          )}
        </div>
        {customer.notes && <div className="card-meta">Notes: {customer.notes}</div>}

        {(customer.phone || customer.email || mapUrl) && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            {customer.phone && (
              <a href={`tel:${customer.phone}`} className="btn btn-sm btn-secondary">📞 Call</a>
            )}
            {customer.phone && (
              <SmsLink phone={customer.phone} body={`Hi ${customer.first_name}, `} mode={smsMode} className="btn btn-sm btn-secondary">💬 Text</SmsLink>
            )}
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="btn btn-sm btn-secondary">✉ Email</a>
            )}
            {mapUrl && (
              <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary">
                📍 Maps
              </a>
            )}
          </div>
        )}

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

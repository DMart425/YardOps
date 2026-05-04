'use client'

import { useActionState } from 'react'
import { updateCustomer } from '../actions'
import Link from 'next/link'
import type { Customer, FormState } from '@/types/database'
import { Toast } from '@/components/Toast'

const CUSTOMER_TAGS = ['Seasonal', 'Commercial', 'Priority', 'Cash Only', 'Key Holder', 'HOA']

type CustomerWithTags = Customer & { tags?: string[] | null }

export function CustomerEditForm({ customer }: { customer: Customer }) {
  const currentTags: string[] = (customer as CustomerWithTags).tags ?? []
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateCustomer.bind(null, customer.id),
    { error: null }
  )

  return (
    <form action={action} className="form">
      <Toast message={state.success} />
      {state.error && <div className="alert alert-error">{state.error}</div>}

      <div className="form-row">
        <div className="form-field">
          <label className="form-label" htmlFor="edit_first_name">First Name *</label>
          <input
            id="edit_first_name"
            name="first_name"
            required
            className="form-input"
            defaultValue={customer.first_name}
            autoCapitalize="words"
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="edit_last_name">Last Name</label>
          <input
            id="edit_last_name"
            name="last_name"
            className="form-input"
            defaultValue={customer.last_name ?? ''}
            autoCapitalize="words"
          />
        </div>
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="edit_phone">Phone</label>
        <input id="edit_phone" name="phone" type="tel" className="form-input" defaultValue={customer.phone ?? ''} />
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="edit_email">Email</label>
        <input id="edit_email" name="email" type="email" className="form-input" defaultValue={customer.email ?? ''} />
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="edit_preferred_contact_method">Preferred Contact</label>
        <select
          id="edit_preferred_contact_method"
          name="preferred_contact_method"
          className="form-select"
          defaultValue={customer.preferred_contact_method ?? ''}
        >
          <option value="">Not specified</option>
          <option value="sms">Text / SMS</option>
          <option value="phone">Phone call</option>
          <option value="email">Email</option>
        </select>
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="edit_status">Status</label>
        <select id="edit_status" name="status" className="form-select" defaultValue={customer.status}>
          <option value="lead">Lead</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="edit_notes">Notes</label>
        <textarea
          id="edit_notes"
          name="notes"
          className="form-textarea"
          defaultValue={customer.notes ?? ''}
          rows={3}
        />
      </div>

      <div className="form-field">
        <label className="form-label">Tags</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {CUSTOMER_TAGS.map(tag => (
            <label key={tag} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                name="tags"
                value={tag}
                defaultChecked={currentTags.includes(tag)}
              />
              {tag}
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <Link href="/customers" className="btn btn-secondary" style={{ flex: 1 }}>Cancel</Link>
        <button type="submit" disabled={pending} className="btn btn-primary" style={{ flex: 2 }}>
          {pending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

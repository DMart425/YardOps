'use client'

import { useActionState } from 'react'
import { createCustomer } from '../actions'
import Link from 'next/link'
import type { FormState } from '@/types/database'

export default function NewCustomerPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(createCustomer, { error: null })

  return (
    <div className="page">
      <Link href="/customers" className="back-link">← Customers</Link>
      <div className="page-header">
        <h1 className="page-title">Add Customer</h1>
      </div>

      <div className="card">
        <form action={action} className="form">
          {state.error && <div className="alert alert-error">{state.error}</div>}

          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="first_name">First Name *</label>
              <input id="first_name" name="first_name" required className="form-input" placeholder="John" autoCapitalize="words" />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="last_name">Last Name</label>
              <input id="last_name" name="last_name" className="form-input" placeholder="Smith" autoCapitalize="words" />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="phone">Phone</label>
            <input id="phone" name="phone" type="tel" className="form-input" placeholder="(334) 555-0123" />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" className="form-input" placeholder="john@example.com" />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="preferred_contact_method">Preferred Contact</label>
            <select id="preferred_contact_method" name="preferred_contact_method" className="form-select">
              <option value="">Not specified</option>
              <option value="sms">Text / SMS</option>
              <option value="phone">Phone call</option>
              <option value="email">Email</option>
            </select>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="status">Status</label>
            <select id="status" name="status" className="form-select" defaultValue="lead">
              <option value="lead">Lead</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" className="form-textarea" placeholder="Any notes about this customer…" rows={3} />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <Link href="/customers" className="btn btn-secondary" style={{ flex: 1 }}>Cancel</Link>
            <button type="submit" disabled={pending} className="btn btn-primary" style={{ flex: 2 }}>
              {pending ? 'Saving…' : 'Add Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

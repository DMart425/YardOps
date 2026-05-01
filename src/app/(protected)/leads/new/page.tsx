'use client'

import { useActionState } from 'react'
import { createLead } from '../actions'
import Link from 'next/link'
import type { FormState } from '@/types/database'

export default function NewLeadPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(createLead, { error: null })

  return (
    <div className="page">
      <Link href="/leads" className="back-link">← Leads</Link>
      <div className="page-header">
        <h1 className="page-title">New Lead</h1>
      </div>

      <div className="card">
        <form action={action} className="form">
          {state.error && <div className="alert alert-error">{state.error}</div>}

          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="first_name">First Name *</label>
              <input
                id="first_name"
                name="first_name"
                required
                className="form-input"
                placeholder="John"
                autoCapitalize="words"
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="last_name">Last Name</label>
              <input
                id="last_name"
                name="last_name"
                className="form-input"
                placeholder="Smith"
                autoCapitalize="words"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="phone">Phone</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                className="form-input"
                placeholder="(334) 555-0123"
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-input"
                placeholder="john@example.com"
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="service_address">Service Address *</label>
            <input
              id="service_address"
              name="service_address"
              required
              className="form-input"
              placeholder="123 Main St, Wicksburg"
              autoCapitalize="words"
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="service_frequency">Frequency</label>
            <select
              id="service_frequency"
              name="service_frequency"
              className="form-select"
              defaultValue="biweekly"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="one_time">One-Time</option>
            </select>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              className="form-textarea"
              rows={3}
              placeholder="Yard condition, gate access, lot size, anything helpful…"
            />
          </div>

          <button type="submit" disabled={pending} className="btn btn-primary btn-full">
            {pending ? 'Saving…' : 'Save Lead'}
          </button>
        </form>
      </div>
    </div>
  )
}

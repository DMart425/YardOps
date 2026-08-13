'use client'

import { formatPhoneInput } from '@/lib/format'
import type { CustomerOption } from './shared'

export function CustomerSection({
  inlineEnabled,
  customerMode,
  setCustomerMode,
  newCustomerFirstName,
  setNewCustomerFirstName,
  newCustomerLastName,
  setNewCustomerLastName,
  newCustomerPhone,
  setNewCustomerPhone,
  newCustomerEmail,
  setNewCustomerEmail,
  isLocked,
  lockedCustomer,
  customerId,
  onCustomerChange,
  customers,
  selectedCustomer,
}: {
  inlineEnabled: boolean
  customerMode: 'existing' | 'new'
  setCustomerMode: (mode: 'existing' | 'new') => void
  newCustomerFirstName: string
  setNewCustomerFirstName: (value: string) => void
  newCustomerLastName: string
  setNewCustomerLastName: (value: string) => void
  newCustomerPhone: string
  setNewCustomerPhone: (value: string) => void
  newCustomerEmail: string
  setNewCustomerEmail: (value: string) => void
  isLocked: boolean
  lockedCustomer: CustomerOption | null
  customerId: string
  onCustomerChange: (id: string) => void
  customers: CustomerOption[]
  selectedCustomer: CustomerOption | undefined
}) {
  return (
    <>
      <div className="form-section-label">Customer &amp; Property</div>

      {inlineEnabled && (
        <div className="form-field">
          <label className="form-label">Customer Entry Mode</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <label className="checkbox-label" style={{ margin: 0 }}>
              <input
                type="radio"
                name="customer_mode_ui"
                value="existing"
                checked={customerMode === 'existing'}
                onChange={() => setCustomerMode('existing')}
              />
              Existing Customer
            </label>
            <label className="checkbox-label" style={{ margin: 0 }}>
              <input
                type="radio"
                name="customer_mode_ui"
                value="new"
                checked={customerMode === 'new'}
                onChange={() => setCustomerMode('new')}
              />
              New Customer
            </label>
          </div>
        </div>
      )}

      {inlineEnabled && customerMode === 'new' && (
        <div className="card" style={{ marginBottom: '0.75rem', padding: '10px' }}>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">First name</label>
              <input
                name="new_customer_first_name"
                className="form-input"
                placeholder="First name"
                autoCapitalize="words"
                value={newCustomerFirstName}
                onChange={e => setNewCustomerFirstName(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label">Last name</label>
              <input
                name="new_customer_last_name"
                className="form-input"
                placeholder="Last name"
                autoCapitalize="words"
                value={newCustomerLastName}
                onChange={e => setNewCustomerLastName(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Phone</label>
              <input
                name="new_customer_phone"
                type="tel"
                className="form-input"
                placeholder="(334) 555-0123"
                value={newCustomerPhone}
                onChange={e => setNewCustomerPhone(formatPhoneInput(e.target.value))}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label">Email (optional)</label>
              <input
                name="new_customer_email"
                type="email"
                className="form-input"
                placeholder="name@example.com"
                value={newCustomerEmail}
                onChange={e => setNewCustomerEmail(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {isLocked ? (
        <div className="form-field">
          <label className="form-label">Customer</label>
          <div className="form-input" style={{ color: 'var(--text-muted, #888)', cursor: 'default', userSelect: 'none' }}>
            {lockedCustomer
              ? `${lockedCustomer.first_name}${lockedCustomer.last_name ? ' ' + lockedCustomer.last_name : ''}`
              : customerId}
          </div>
          <input type="hidden" name="customer_id" value={customerId} />
        </div>
      ) : (!inlineEnabled || customerMode === 'existing') && (
        <div className="form-field">
          <label className="form-label">Customer *</label>
          <select
            name="customer_id"
            className="form-select"
            required={!inlineEnabled || customerMode === 'existing'}
            value={customerId}
            onChange={e => onCustomerChange(e.target.value)}>
            <option value="">— Select customer —</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.first_name}{c.last_name ? ' ' + c.last_name : ''}</option>
            ))}
          </select>
          {selectedCustomer && (
            selectedCustomer.phone ? (
              <p className="form-hint">
                SMS phone on file: {selectedCustomer.phone}
              </p>
            ) : (
              <p className="form-hint" style={{ color: 'var(--color-warning)' }}>
                No customer phone on file. SMS estimate sending will not be available until a phone number is added.
              </p>
            )
          )}
        </div>
      )}
    </>
  )
}

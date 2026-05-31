'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import type { FormState } from '@/types/database'
import { Toast } from '@/components/Toast'

interface CustomerOption {
  id: string; first_name: string; last_name: string | null; status: string
}
interface PropertyOption {
  id: string; customer_id: string; property_name: string | null
  service_address: string; city: string | null
  default_price: number | null; default_service_package: string | null
  service_frequency: string; auto_schedule_next: boolean
  default_mowing_enabled?: boolean | null
  default_weed_eating_enabled?: boolean | null
  default_edging_enabled?: boolean | null
  default_blow_off_enabled?: boolean | null
}
interface JobFormProps {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
  submitLabel: string
  cancelHref: string
  customers: CustomerOption[]
  properties: PropertyOption[]
  defaultCustomerId?: string
  defaultPropertyId?: string
  localToday: string
  defaultValues?: Record<string, string | number | boolean | null>
}

function deriveServicePackageFromBooleans(p: PropertyOption | null): string {
  if (!p) return ''
  const hasMow  = Boolean(p.default_mowing_enabled)
  const hasWeed = Boolean(p.default_weed_eating_enabled)
  const hasEdge = Boolean(p.default_edging_enabled)
  const hasBlow = Boolean(p.default_blow_off_enabled)
  if (!hasMow && !hasWeed && !hasEdge && !hasBlow) return ''
  if (hasMow && !hasWeed && !hasEdge && !hasBlow)  return 'mow_only'
  if (hasMow && hasWeed && !hasEdge && hasBlow)    return 'mow_trim_blow'
  if (!hasMow && (hasWeed || hasEdge || hasBlow))  return 'trim_cleanup'
  if (hasMow && (hasWeed || hasEdge || hasBlow))   return 'full_service'
  return ''
}

function deriveJobTypeFromFrequency(frequency?: string | null): string {
  return frequency === 'weekly' || frequency === 'biweekly' ? 'recurring' : 'one_time'
}

function getPropertyDefaults(properties: PropertyOption[], propertyId?: string) {
  if (!propertyId) return null
  return properties.find((property) => property.id === propertyId) ?? null
}

export function JobForm({
  action, submitLabel, cancelHref,
  customers, properties,
  defaultCustomerId, defaultPropertyId, localToday, defaultValues,
}: JobFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, { error: null })
  const initialProperty = getPropertyDefaults(properties, defaultPropertyId)

  const [selectedCustomerId, setSelectedCustomerId] = useState(defaultCustomerId ?? '')
  const [selectedPropertyId, setSelectedPropertyId] = useState(defaultPropertyId ?? '')
  const [price, setPrice] = useState(() => {
    if (defaultValues?.price != null) return String(defaultValues.price)
    return initialProperty?.default_price != null ? String(initialProperty.default_price) : ''
  })
  const [servicePackage, setServicePackage] = useState(() => {
    if (typeof defaultValues?.service_package === 'string') return defaultValues.service_package
    if (initialProperty) {
      return deriveServicePackageFromBooleans(initialProperty) || initialProperty.default_service_package || ''
    }
    return ''
  })
  const [jobType, setJobType] = useState(() => {
    if (defaultValues?.job_type) return String(defaultValues.job_type)
    if (initialProperty) return deriveJobTypeFromFrequency(initialProperty.service_frequency)
    return 'one_time'
  })

  const filteredProperties = selectedCustomerId
    ? properties.filter(p => p.customer_id === selectedCustomerId)
    : properties

  // Reset property if customer changes and current property doesn't belong to new customer
  const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value
    setSelectedCustomerId(newId)
    const currentProp = properties.find(p => p.id === selectedPropertyId)
    if (currentProp && currentProp.customer_id !== newId) setSelectedPropertyId('')
  }

  const handlePropertyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const propertyId = e.target.value
    setSelectedPropertyId(propertyId)
    const property = getPropertyDefaults(properties, propertyId)
    if (!property) return
    // Price: only prefill if a default exists; leave operator input untouched otherwise
    if (property.default_price != null) setPrice(String(property.default_price))
    // Package: prefer boolean source-of-truth, fallback to legacy default_service_package
    const pkgFromBooleans = deriveServicePackageFromBooleans(property)
    setServicePackage(pkgFromBooleans || property.default_service_package || '')
    // Job type: derive from property frequency
    setJobType(deriveJobTypeFromFrequency(property.service_frequency))
  }

  const today = localToday

  return (
    <form action={formAction} className="form">
      <Toast message={state.success} />
      {state.error && <div className="alert alert-error">{state.error}</div>}

      {/* Customer */}
      <div className="form-field">
        <label className="form-label" htmlFor="jf_customer">Customer *</label>
        <select
          id="jf_customer"
          name="customer_id"
          className="form-select"
          required
          value={selectedCustomerId}
          onChange={handleCustomerChange}
        >
          <option value="">— Select customer —</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>
              {c.first_name}{c.last_name ? ' ' + c.last_name : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Property */}
      <div className="form-field">
        <label className="form-label" htmlFor="jf_property">Property *</label>
        <select
          id="jf_property"
          name="property_id"
          className="form-select"
          required
          value={selectedPropertyId}
          onChange={handlePropertyChange}
        >
          <option value="">— Select property —</option>
          {filteredProperties.map(p => (
            <option key={p.id} value={p.id}>
              {p.property_name ?? p.service_address}{p.city ? ', ' + p.city : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Date + Time Window */}
      <div className="form-row">
        <div className="form-field">
          <label className="form-label" htmlFor="jf_date">Scheduled Date</label>
          <input
            id="jf_date"
            name="scheduled_date"
            type="date"
            className="form-input"
            defaultValue={(defaultValues?.scheduled_date as string) ?? today}
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="jf_time">Time Window</label>
          <select id="jf_time" name="scheduled_time_window" className="form-select" defaultValue={(defaultValues?.scheduled_time_window as string) ?? ''}>
            <option value="">Any time</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
          </select>
        </div>
      </div>

      {/* Job Type + Package */}
      <div className="form-row">
        <div className="form-field">
          <label className="form-label" htmlFor="jf_type">Job Type</label>
          <select id="jf_type" name="job_type" className="form-select"
            value={jobType} onChange={e => setJobType(e.target.value)}>
            <option value="recurring">Recurring</option>
            <option value="one_time">One-time</option>
          </select>
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="jf_package">Package</label>
          <select
            id="jf_package"
            name="service_package"
            className="form-select"
            value={servicePackage}
            onChange={e => setServicePackage(e.target.value)}
          >
            <option value="">Standard mow</option>
            <option value="mow_trim_blow">Mow, Trim &amp; Blow</option>
            <option value="mow_only">Mow Only</option>
            <option value="trim_cleanup">Trim &amp; Cleanup</option>
            <option value="full_service">Full Service</option>
          </select>
        </div>
      </div>

      {/* Price + Payment */}
      <div className="form-row">
        <div className="form-field">
          <label className="form-label" htmlFor="jf_price">Price ($)</label>
          <input
            id="jf_price"
            name="price"
            type="number"
            min="0"
            step="0.01"
            className="form-input"
            placeholder="0.00"
            value={price}
            onChange={e => setPrice(e.target.value)}
          />
          {selectedPropertyId && price === '' && (
            <p className="text-small text-muted" style={{ marginTop: '4px' }}>
              No default price set — enter price before completing this job.
            </p>
          )}
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="jf_payment">Payment</label>
          <select id="jf_payment" name="payment_status" className="form-select" defaultValue={(defaultValues?.payment_status as string) ?? 'unpaid'}>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="not_billable">Not Billable</option>
          </select>
        </div>
      </div>

      {/* Notes */}
      <div className="form-field">
        <label className="form-label" htmlFor="jf_notes">Internal Notes</label>
        <textarea
          id="jf_notes"
          name="internal_notes"
          className="form-textarea"
          rows={2}
          defaultValue={(defaultValues?.internal_notes as string) ?? ''}
        />
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <Link href={cancelHref} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</Link>
        <button type="submit" disabled={pending} className="btn btn-primary" style={{ flex: 2 }}>
          {pending ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

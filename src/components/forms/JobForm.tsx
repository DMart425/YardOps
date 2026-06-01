'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import type { FormState } from '@/types/database'
import { Toast } from '@/components/Toast'
import { formatFrequencyLabel } from '@/lib/frequency'

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

type SvcCheckboxes = { mow: boolean; weed: boolean; edge: boolean; blow: boolean }

// Expand a legacy service_package code into individual service booleans.
// Used as fallback when a property has no per-service booleans saved yet.
function checkboxesFromPackage(pkg: string | null): SvcCheckboxes {
  switch (pkg) {
    case 'mow_only':      return { mow: true,  weed: false, edge: false, blow: false }
    case 'mow_trim_blow': return { mow: true,  weed: true,  edge: false, blow: true  }
    case 'trim_cleanup':  return { mow: false, weed: true,  edge: true,  blow: false }
    case 'full_service':  return { mow: true,  weed: true,  edge: true,  blow: true  }
    default:              return { mow: true,  weed: false, edge: false, blow: false }
  }
}

// Derive initial service checkbox state from a property.
// Prefers per-service booleans; falls back to legacy default_service_package.
function getPropertyCheckboxDefaults(p: PropertyOption | null): SvcCheckboxes {
  if (!p) return { mow: true, weed: false, edge: false, blow: false }
  const hasBooleans =
    p.default_mowing_enabled != null ||
    p.default_weed_eating_enabled != null ||
    p.default_edging_enabled != null ||
    p.default_blow_off_enabled != null
  if (hasBooleans) {
    return {
      mow:  Boolean(p.default_mowing_enabled),
      weed: Boolean(p.default_weed_eating_enabled),
      edge: Boolean(p.default_edging_enabled),
      blow: Boolean(p.default_blow_off_enabled),
    }
  }
  return checkboxesFromPackage(p.default_service_package ?? null)
}

function deriveJobTypeFromFrequency(frequency?: string | null): string {
  return frequency === 'weekly' || frequency === 'biweekly' ? 'recurring' : 'one_time'
}

// Returns true if the property has any useful defaults that would prefill the form.
function hasPropertyDefaults(p: PropertyOption): boolean {
  if (p.default_price != null) return true
  if (p.service_frequency && p.service_frequency !== '') return true
  if (p.default_mowing_enabled != null) return true
  if (p.default_weed_eating_enabled != null) return true
  if (p.default_edging_enabled != null) return true
  if (p.default_blow_off_enabled != null) return true
  if (p.default_service_package) return true
  return false
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
  const initialCheckboxes = getPropertyCheckboxDefaults(initialProperty)

  const [selectedCustomerId, setSelectedCustomerId] = useState(defaultCustomerId ?? '')
  const [selectedPropertyId, setSelectedPropertyId] = useState(defaultPropertyId ?? '')
  const [price, setPrice] = useState(() => {
    if (defaultValues?.price != null) return String(defaultValues.price)
    return initialProperty?.default_price != null ? String(initialProperty.default_price) : ''
  })
  const [jobType, setJobType] = useState(() => {
    if (defaultValues?.job_type) return String(defaultValues.job_type)
    if (initialProperty) return deriveJobTypeFromFrequency(initialProperty.service_frequency)
    return 'one_time'
  })

  // Core service checkboxes — source of truth for service scope on new jobs
  const [svcMowing,     setSvcMowing]     = useState(initialCheckboxes.mow)
  const [svcWeedEating, setSvcWeedEating] = useState(initialCheckboxes.weed)
  const [svcEdging,     setSvcEdging]     = useState(initialCheckboxes.edge)
  const [svcBlowOff,    setSvcBlowOff]    = useState(initialCheckboxes.blow)

  // Add-on selections
  const [baggingLevel,     setBaggingLevel]     = useState('none')
  const [stickPickupLevel, setStickPickupLevel] = useState('none')
  const [leafCleanupLevel, setLeafCleanupLevel] = useState('none')
  const [haulOffLevel,     setHaulOffLevel]     = useState('none')
  const [shrubSmallCount,  setShrubSmallCount]  = useState(0)
  const [shrubMediumCount, setShrubMediumCount] = useState(0)
  const [shrubLargeCount,  setShrubLargeCount]  = useState(0)

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
    // Job type: derive from property frequency
    setJobType(deriveJobTypeFromFrequency(property.service_frequency))
    // Service checkboxes: prefer per-service booleans, fall back to legacy package
    const cbs = getPropertyCheckboxDefaults(property)
    setSvcMowing(cbs.mow)
    setSvcWeedEating(cbs.weed)
    setSvcEdging(cbs.edge)
    setSvcBlowOff(cbs.blow)
  }

  const today = localToday

  // Derived frequency label — shown read-only to operator; updates when property changes.
  // Falls back to prompt text when no property is selected yet.
  const selectedProperty = selectedPropertyId
    ? (properties.find(p => p.id === selectedPropertyId) ?? null)
    : null
  const frequencyLabel = selectedProperty
    ? formatFrequencyLabel(selectedProperty.service_frequency)
    : null

  const prefillNote: { text: string; isDefaults: boolean } = selectedProperty
    ? hasPropertyDefaults(selectedProperty)
      ? { text: 'Using property defaults — edit any field before creating the job.', isDefaults: true }
      : { text: 'Manual entry — this property has no defaults set.', isDefaults: false }
    : { text: 'Manual entry — choose a property to load defaults, or fill the job manually.', isDefaults: false }

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

      {/* Prefill source note */}
      <p
        className="text-small text-muted"
        style={{
          marginTop: '-4px',
          marginBottom: '4px',
          paddingLeft: '2px',
          fontStyle: 'italic',
          color: prefillNote.isDefaults ? 'var(--color-primary)' : undefined,
        }}
      >
        {prefillNote.isDefaults ? '✦ ' : ''}{prefillNote.text}
      </p>

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

      {/* Job type — derived from property frequency; not operator-editable.
           Submitted as a hidden field so today-page gap detection and
           Needs Follow-up queries (which filter on job_type = 'recurring') continue
           to work correctly without any action changes. */}
      <input type="hidden" name="job_type" value={jobType} />

      {/* Frequency display — read-only context for the operator */}
      <div className="form-field">
        <label className="form-label">Frequency</label>
        <p className="text-small text-muted" style={{ marginTop: '2px' }}>
          {frequencyLabel ?? 'Choose a property to load its service frequency.'}
        </p>
      </div>

      {/* Service Scope */}
      <div className="form-field">
        <label className="form-label">Services</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', paddingTop: '4px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="svc_mowing"
              checked={svcMowing}
              onChange={e => setSvcMowing(e.target.checked)}
            />
            Mowing
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="svc_weed_eating"
              checked={svcWeedEating}
              onChange={e => setSvcWeedEating(e.target.checked)}
            />
            Weed eating
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="svc_edging"
              checked={svcEdging}
              onChange={e => setSvcEdging(e.target.checked)}
            />
            Edging
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="svc_blow_off"
              checked={svcBlowOff}
              onChange={e => setSvcBlowOff(e.target.checked)}
            />
            Blow off
          </label>
        </div>
      </div>

      {/* Add-ons */}
      <div className="form-field">
        <label className="form-label">
          Add-ons{' '}
          <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="form-row">
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="jf_bagging" style={{ fontSize: '0.85rem' }}>Bagging</label>
              <select id="jf_bagging" name="bagging_level" className="form-select"
                value={baggingLevel} onChange={e => setBaggingLevel(e.target.value)}>
                <option value="none">None</option>
                <option value="light">Light</option>
                <option value="normal">Normal</option>
                <option value="heavy">Heavy</option>
              </select>
            </div>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="jf_stick" style={{ fontSize: '0.85rem' }}>Stick / limb pickup</label>
              <select id="jf_stick" name="stick_pickup_level" className="form-select"
                value={stickPickupLevel} onChange={e => setStickPickupLevel(e.target.value)}>
                <option value="none">None</option>
                <option value="light">Light</option>
                <option value="normal">Normal</option>
                <option value="heavy">Heavy</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="jf_leaf" style={{ fontSize: '0.85rem' }}>Leaf cleanup</label>
              <select id="jf_leaf" name="leaf_cleanup_level" className="form-select"
                value={leafCleanupLevel} onChange={e => setLeafCleanupLevel(e.target.value)}>
                <option value="none">None</option>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="jf_haul" style={{ fontSize: '0.85rem' }}>Haul-off</label>
              <select id="jf_haul" name="haul_off_level" className="form-select"
                value={haulOffLevel} onChange={e => setHaulOffLevel(e.target.value)}>
                <option value="none">None</option>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
          <div>
            <label className="form-label" style={{ fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>Shrub trimming</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <div>
                <label className="form-label" htmlFor="jf_shrub_sm" style={{ fontSize: '0.8rem', opacity: 0.7 }}>Small</label>
                <input
                  id="jf_shrub_sm"
                  name="shrub_small_count"
                  type="number"
                  min="0"
                  className="form-input"
                  value={shrubSmallCount}
                  onChange={e => setShrubSmallCount(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="jf_shrub_md" style={{ fontSize: '0.8rem', opacity: 0.7 }}>Medium</label>
                <input
                  id="jf_shrub_md"
                  name="shrub_medium_count"
                  type="number"
                  min="0"
                  className="form-input"
                  value={shrubMediumCount}
                  onChange={e => setShrubMediumCount(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="jf_shrub_lg" style={{ fontSize: '0.8rem', opacity: 0.7 }}>Large</label>
                <input
                  id="jf_shrub_lg"
                  name="shrub_large_count"
                  type="number"
                  min="0"
                  className="form-input"
                  value={shrubLargeCount}
                  onChange={e => setShrubLargeCount(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>
            </div>
          </div>
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

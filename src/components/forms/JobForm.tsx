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
// Structured prefill data derived from an approved estimate.
// Passed from jobs/new page when ?estimate_id= is present and valid,
// and as a list in approvedEstimates for the source selector.
export interface EstimatePrefill {
  estimateId: string
  estimateNumber: string | null
  customerId: string
  propertyId: string
  price: number | null
  frequency: string | null
  svcMowing: boolean
  svcWeedEating: boolean
  svcEdging: boolean
  svcBlowOff: boolean
  baggingLevel: string
  stickPickupLevel: string
  leafCleanupLevel: string
  haulOffLevel: string
  shrubSmallCount: number
  shrubMediumCount: number
  shrubLargeCount: number
}

// Structured prefill data derived from a completed source job.
// Passed from jobs/new page when ?source_job_id= is present and valid.
export interface SourceJobPrefill {
  sourceJobId: string
  customerId: string
  propertyId: string
  price: number | null
  jobType: string       // from source job.job_type
  svcMowing: boolean
  svcWeedEating: boolean
  svcEdging: boolean
  svcBlowOff: boolean
  baggingLevel: string
  stickPickupLevel: string
  leafCleanupLevel: string
  haulOffLevel: string
  shrubSmallCount: number
  shrubMediumCount: number
  shrubLargeCount: number
}

// Source of prefill data for the new job form.
// 'estimate'     — uses a selected approved estimate; submits hidden estimate_id.
// 'property'     — uses property defaults; no estimate linked.
// 'custom'       — manual entry; fields left as-is; no estimate linked.
// 'previous_job' — prefilled from a completed source job; submits hidden source_job_id.
type JobSource = 'estimate' | 'property' | 'custom' | 'previous_job'

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
  estimatePrefill?: EstimatePrefill | null
  estimateWarning?: string | null
  // All currently approved estimates for this business. Used to populate the
  // source selector dropdown when a property with approved estimates is selected.
  approvedEstimates?: EstimatePrefill[]
  // Prefill data from a completed source job (?source_job_id=).
  sourcePrefill?: SourceJobPrefill | null
  sourceJobWarning?: string | null
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
  estimatePrefill, estimateWarning,
  approvedEstimates,
  sourcePrefill, sourceJobWarning,
}: JobFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, { error: null })
  const initialProperty = getPropertyDefaults(properties, defaultPropertyId)
  const initialCheckboxes = getPropertyCheckboxDefaults(initialProperty)

  const [selectedCustomerId, setSelectedCustomerId] = useState(defaultCustomerId ?? '')
  const [selectedPropertyId, setSelectedPropertyId] = useState(defaultPropertyId ?? '')
  const [price, setPrice] = useState(() => {
    if (sourcePrefill?.price != null) return String(sourcePrefill.price)
    if (estimatePrefill?.price != null) return String(estimatePrefill.price)
    if (defaultValues?.price != null) return String(defaultValues.price)
    return initialProperty?.default_price != null ? String(initialProperty.default_price) : ''
  })
  const [jobType, setJobType] = useState(() => {
    if (sourcePrefill?.jobType) return sourcePrefill.jobType
    if (estimatePrefill?.frequency) return deriveJobTypeFromFrequency(estimatePrefill.frequency)
    if (defaultValues?.job_type) return String(defaultValues.job_type)
    if (initialProperty) return deriveJobTypeFromFrequency(initialProperty.service_frequency)
    return 'one_time'
  })

  // Source selector state — which data source is driving the form fields.
  const [source, setSource] = useState<JobSource>(() => {
    if (sourcePrefill) return 'previous_job'
    if (estimatePrefill) return 'estimate'
    if (initialProperty && hasPropertyDefaults(initialProperty)) return 'property'
    return 'custom'
  })
  // The estimate currently selected in the estimate picker (by estimateId).
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(
    estimatePrefill?.estimateId ?? null
  )

  // Core service checkboxes — source of truth for service scope on new jobs
  const [svcMowing,     setSvcMowing]     = useState(sourcePrefill ? sourcePrefill.svcMowing     : estimatePrefill ? estimatePrefill.svcMowing     : initialCheckboxes.mow)
  const [svcWeedEating, setSvcWeedEating] = useState(sourcePrefill ? sourcePrefill.svcWeedEating : estimatePrefill ? estimatePrefill.svcWeedEating : initialCheckboxes.weed)
  const [svcEdging,     setSvcEdging]     = useState(sourcePrefill ? sourcePrefill.svcEdging     : estimatePrefill ? estimatePrefill.svcEdging     : initialCheckboxes.edge)
  const [svcBlowOff,    setSvcBlowOff]    = useState(sourcePrefill ? sourcePrefill.svcBlowOff    : estimatePrefill ? estimatePrefill.svcBlowOff    : initialCheckboxes.blow)

  // Add-on selections
  const [baggingLevel,     setBaggingLevel]     = useState(sourcePrefill?.baggingLevel     ?? estimatePrefill?.baggingLevel     ?? 'none')
  const [stickPickupLevel, setStickPickupLevel] = useState(sourcePrefill?.stickPickupLevel ?? estimatePrefill?.stickPickupLevel ?? 'none')
  const [leafCleanupLevel, setLeafCleanupLevel] = useState(sourcePrefill?.leafCleanupLevel ?? estimatePrefill?.leafCleanupLevel ?? 'none')
  const [haulOffLevel,     setHaulOffLevel]     = useState(sourcePrefill?.haulOffLevel     ?? estimatePrefill?.haulOffLevel     ?? 'none')
  const [shrubSmallCount,  setShrubSmallCount]  = useState(sourcePrefill?.shrubSmallCount  ?? estimatePrefill?.shrubSmallCount  ?? 0)
  const [shrubMediumCount, setShrubMediumCount] = useState(sourcePrefill?.shrubMediumCount ?? estimatePrefill?.shrubMediumCount ?? 0)
  const [shrubLargeCount,  setShrubLargeCount]  = useState(sourcePrefill?.shrubLargeCount  ?? estimatePrefill?.shrubLargeCount  ?? 0)

  // ── Derived values ────────────────────────────────────────────────────────
  const allEstimates = approvedEstimates ?? []
  // Estimates available for the currently selected property.
  const propertyEstimates = allEstimates.filter(e => e.propertyId === selectedPropertyId)
  // The estimate currently active in the picker (may be null if none selected yet).
  const activeEstimate = propertyEstimates.find(e => e.estimateId === selectedEstimateId) ?? null
  // Estimate source is fully active only when source=estimate, an estimate is selected,
  // and it belongs to the currently selected property.
  const isEstimateActive = source === 'estimate' && activeEstimate != null && activeEstimate.propertyId === selectedPropertyId

  // Previous job source is active when source=previous_job and the source job's property
  // still matches the currently selected property (operator hasn't switched properties).
  const isSourceJobActive = source === 'previous_job' && sourcePrefill != null && selectedPropertyId === sourcePrefill.propertyId

  const filteredProperties = selectedCustomerId
    ? properties.filter(p => p.customer_id === selectedCustomerId)
    : properties

  // ── Field-population helpers ──────────────────────────────────────────────
  // Apply all scope fields from an estimate prefill object.
  // Date is intentionally excluded — it is a scheduling decision, not scope data.
  const applyEstimateFields = (ep: EstimatePrefill) => {
    if (ep.price != null) setPrice(String(ep.price))
    setJobType(deriveJobTypeFromFrequency(ep.frequency))
    setSvcMowing(ep.svcMowing)
    setSvcWeedEating(ep.svcWeedEating)
    setSvcEdging(ep.svcEdging)
    setSvcBlowOff(ep.svcBlowOff)
    setBaggingLevel(ep.baggingLevel)
    setStickPickupLevel(ep.stickPickupLevel)
    setLeafCleanupLevel(ep.leafCleanupLevel)
    setHaulOffLevel(ep.haulOffLevel)
    setShrubSmallCount(ep.shrubSmallCount)
    setShrubMediumCount(ep.shrubMediumCount)
    setShrubLargeCount(ep.shrubLargeCount)
  }

  // Apply all scope fields from a previous completed job.
  const applySourceJobFields = (sp: SourceJobPrefill) => {
    if (sp.price != null) setPrice(String(sp.price))
    setJobType(sp.jobType)
    setSvcMowing(sp.svcMowing)
    setSvcWeedEating(sp.svcWeedEating)
    setSvcEdging(sp.svcEdging)
    setSvcBlowOff(sp.svcBlowOff)
    setBaggingLevel(sp.baggingLevel)
    setStickPickupLevel(sp.stickPickupLevel)
    setLeafCleanupLevel(sp.leafCleanupLevel)
    setHaulOffLevel(sp.haulOffLevel)
    setShrubSmallCount(sp.shrubSmallCount)
    setShrubMediumCount(sp.shrubMediumCount)
    setShrubLargeCount(sp.shrubLargeCount)
  }

  // Apply property defaults and reset add-ons to none/0.
  const applyPropertyFields = (p: PropertyOption) => {
    setPrice(p.default_price != null ? String(p.default_price) : '')
    setJobType(deriveJobTypeFromFrequency(p.service_frequency))
    const cbs = getPropertyCheckboxDefaults(p)
    setSvcMowing(cbs.mow)
    setSvcWeedEating(cbs.weed)
    setSvcEdging(cbs.edge)
    setSvcBlowOff(cbs.blow)
    setBaggingLevel('none')
    setStickPickupLevel('none')
    setLeafCleanupLevel('none')
    setHaulOffLevel('none')
    setShrubSmallCount(0)
    setShrubMediumCount(0)
    setShrubLargeCount(0)
  }

  // ── Event handlers ────────────────────────────────────────────────────────
  const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value
    setSelectedCustomerId(newId)
    const currentProp = properties.find(p => p.id === selectedPropertyId)
    if (currentProp && currentProp.customer_id !== newId) setSelectedPropertyId('')
  }

  const handlePropertyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const propertyId = e.target.value
    setSelectedPropertyId(propertyId)
    // Reset estimate selection whenever the property changes.
    setSelectedEstimateId(null)
    // If estimate or previous_job source was active, fall back to property defaults.
    if (source === 'estimate' || source === 'previous_job') setSource('property')
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

  // Handle source selector radio change.
  const handleSourceChange = (newSource: JobSource) => {
    if (newSource === source) return
    setSource(newSource)
    if (newSource === 'previous_job') {
      // Restore prefill from the source job.
      if (sourcePrefill) applySourceJobFields(sourcePrefill)
    } else if (newSource === 'estimate') {
      // Auto-select the first available estimate when switching to Estimate source.
      const target = activeEstimate ?? propertyEstimates[0] ?? null
      if (target) {
        setSelectedEstimateId(target.estimateId)
        applyEstimateFields(target)
      }
    } else if (newSource === 'property') {
      setSelectedEstimateId(null)
      const property = getPropertyDefaults(properties, selectedPropertyId)
      if (property) applyPropertyFields(property)
    } else {
      // 'custom' — leave all current field values as-is; just clear the estimate link.
      setSelectedEstimateId(null)
    }
  }

  // Handle estimate picker dropdown change.
  const handleEstimatePickerChange = (estimateId: string) => {
    setSelectedEstimateId(estimateId)
    const est = propertyEstimates.find(e => e.estimateId === estimateId) ?? null
    if (est) applyEstimateFields(est)
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

  // Prefill source note — reflects current source selection.
  const prefillNote: { text: string; isDefaults: boolean } = isSourceJobActive
    ? { text: 'Prefilled from previous job — edit any field before creating the follow-up.', isDefaults: true }
    : isEstimateActive
      ? {
          text: `Prefilled from Estimate${activeEstimate!.estimateNumber ? ` #${activeEstimate!.estimateNumber}` : ''} — edit any field before creating the job.`,
          isDefaults: true,
        }
      : source === 'custom'
        ? { text: 'Custom / Manual — fields will be submitted as-is.', isDefaults: false }
        : selectedProperty
          ? hasPropertyDefaults(selectedProperty)
            ? { text: 'Using property defaults — edit any field before creating the job.', isDefaults: true }
            : { text: 'Manual entry — this property has no defaults set.', isDefaults: false }
          : { text: 'Manual entry — choose a property to load defaults, or fill the job manually.', isDefaults: false }

  return (
    <form action={formAction} className="form">
      <Toast message={state.success} />
      {state.error && <div className="alert alert-error">{state.error}</div>}
      {estimateWarning && (
        <div className="alert alert-error" style={{ marginBottom: '12px' }}>
          ⚠ {estimateWarning}
        </div>
      )}

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

      {/* Source job warning — shown when next_job_created_id is already set */}
      {sourceJobWarning && (
        <div className="alert alert-error" style={{ marginBottom: '12px' }}>
          ⚠ {sourceJobWarning}
        </div>
      )}

      {/* Source selector — shown when the property has approved estimates OR when
           a source job prefill is active. Lets the operator choose whether to
           fill the form from a previous job, an estimate, property defaults, or manually. */}
      {selectedPropertyId && (sourcePrefill != null || propertyEstimates.length > 0) && (
        <div className="form-field" style={{ marginTop: '-2px', marginBottom: '4px' }}>
          <label className="form-label">Job source</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* Previous Job option — only shown when sourcePrefill is present */}
            {sourcePrefill != null && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="jf_source"
                  checked={source === 'previous_job'}
                  onChange={() => handleSourceChange('previous_job')}
                />
                <span className="text-small">Previous job</span>
              </label>
            )}
            {/* Estimate option */}
            {propertyEstimates.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="jf_source"
                  checked={source === 'estimate'}
                  onChange={() => handleSourceChange('estimate')}
                />
                <span className="text-small">Estimate</span>
              </label>
            )}
            {source === 'estimate' && propertyEstimates.length > 0 && (
              <select
                className="form-select"
                style={{ marginLeft: '24px' }}
                value={selectedEstimateId ?? ''}
                onChange={e => handleEstimatePickerChange(e.target.value)}
              >
                {propertyEstimates.map(e => (
                  <option key={e.estimateId} value={e.estimateId}>
                    {e.estimateNumber ? `Estimate #${e.estimateNumber}` : 'Estimate'}
                    {' · '}${e.price != null ? Number(e.price).toFixed(0) : '?'}
                    {' · '}{e.frequency ? formatFrequencyLabel(e.frequency) : 'One-time'}
                  </option>
                ))}
              </select>
            )}
            {/* Property defaults option */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="jf_source"
                checked={source === 'property'}
                onChange={() => handleSourceChange('property')}
              />
              <span className="text-small">Property defaults</span>
            </label>
            {/* Custom / Manual option */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="jf_source"
                checked={source === 'custom'}
                onChange={() => handleSourceChange('custom')}
              />
              <span className="text-small">Custom / Manual</span>
            </label>
          </div>
        </div>
      )}

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

      {/* Estimate source — included only while isEstimateActive is true.
           isEstimateActive requires source==='estimate', an activeEstimate,
           and the active estimate's property matching the selected property.
           If operator switches source or changes property the field is removed. */}
      {isEstimateActive && (
        <input type="hidden" name="estimate_id" value={activeEstimate!.estimateId} />
      )}

      {/* Previous job source — included only while isSourceJobActive is true.
           Removed from DOM when operator switches source or changes property,
           so createJob never receives it accidentally. Submitting this field
           causes createJob to set recurrence_source on the new job and update
           next_job_created_id on the source job. Never coexists with estimate_id. */}
      {isSourceJobActive && (
        <input type="hidden" name="source_job_id" value={sourcePrefill!.sourceJobId} />
      )}

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

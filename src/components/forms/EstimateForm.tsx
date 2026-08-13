'use client'

import { useActionState, useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { FormState } from '@/types/database'
import { Toast } from '@/components/Toast'
import { calculateEstimate, DEFAULT_SETTINGS, acrestoMowMinutes, estimateMowableAcres } from '@/lib/pricing'
import type { EstimateInputs } from '@/lib/pricing'
import type { ImportedParcel } from '@/components/ParcelLookup'
import { parseWebsiteServiceInterests } from '@/lib/frequency'
import { addDays } from '@/lib/date'
import {
  defaultInputs,
  mapPropertyFrequency,
  packageDefaults,
  serviceInterestDefaults,
  propertyBooleanDefaults,
} from './estimate/shared'
import type { CustomerOption, PropertyOption, ParcelResult } from './estimate/shared'
import { CustomerSection } from './estimate/CustomerSection'
import { PropertySection } from './estimate/PropertySection'
import { MowingSetupSection } from './estimate/MowingSetupSection'
import { ServiceInputsSection } from './estimate/ServiceInputsSection'
import { AddOnsSection } from './estimate/AddOnsSection'
import { EstimateSummary } from './estimate/EstimateSummary'

export function EstimateForm({
  action,
  customers,
  properties,
  enableInlineEntry,
  defaultCustomerId,
  defaultPropertyId,
  defaultHourlyRate,
  defaultMinimumPrice,
  initialInputs,
  initialValidUntil,
  initialNotes,
  initialPriceOverride,
  localToday,
  submitLabel,
  cancelHref,
  defaultSourceJobId,
  sourceJobTitle,
  sourceJobDateLabel,
  sourceJobWarning,
  defaultSetsPropertyDefaults,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
  customers: CustomerOption[]
  properties: PropertyOption[]
  enableInlineEntry?: boolean
  defaultCustomerId?: string
  defaultPropertyId?: string
  defaultHourlyRate?: number
  defaultMinimumPrice?: number
  initialInputs?: EstimateInputs
  initialValidUntil?: string | null
  initialNotes?: string | null
  initialPriceOverride?: number | null
  localToday: string
  submitLabel?: string
  cancelHref?: string
  // Source-job context — set when estimate is created from a completed job detail page.
  // When defaultSourceJobId is present the form locks customer + property to the source
  // job's values and persists source_job_id on submit.
  defaultSourceJobId?: string | null
  sourceJobTitle?: string | null
  sourceJobDateLabel?: string | null
  sourceJobWarning?: string | null
  // Operator intent: when true, approval of this estimate will replace the
  // property's default service agreement (frequency, scope, price).
  defaultSetsPropertyDefaults?: boolean
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, { error: null })
  const inlineEnabled = enableInlineEntry === true
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing')
  const [propertyMode, setPropertyMode] = useState<'existing' | 'new'>('existing')
  const [propertyReassignmentConfirmed, setPropertyReassignmentConfirmed] = useState(false)
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? '')
  const [propertyId, setPropertyId] = useState(defaultPropertyId ?? '')
  const [newCustomerFirstName, setNewCustomerFirstName] = useState('')
  const [newCustomerLastName, setNewCustomerLastName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const [inputs, setInputs] = useState<EstimateInputs>(() => initialInputs ?? defaultInputs(defaultHourlyRate))
  const [validUntil, setValidUntil] = useState(() => {
    if (initialValidUntil !== undefined) return initialValidUntil ?? ''
    return addDays(localToday, 14)
  })
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [rateStr, setRateStr] = useState(() => String(inputs.hourlyRate))
  const [priceOverride, setPriceOverride] = useState<number | null>(initialPriceOverride ?? null)
  const [newPropertyAddress, setNewPropertyAddress] = useState('')
  const [newPropertyCity, setNewPropertyCity] = useState('')
  const [newPropertyCounty, setNewPropertyCounty] = useState('')
  const [newPropertyState, setNewPropertyState] = useState('AL')
  const [newPropertyParcelAcres, setNewPropertyParcelAcres] = useState('')
  const [newPropertyMowableAcres, setNewPropertyMowableAcres] = useState('')
  const [newPropertyParcelMessage, setNewPropertyParcelMessage] = useState<string | null>(null)
  const [parcelLookupPending, setParcelLookupPending] = useState(false)
  const [importedEstimateParcel, setImportedEstimateParcel] = useState<ImportedParcel | null>(null)
  const userChangedPropertyRef = useRef(false)

  // Source-job locking — when a source job is linked, customer + property are
  // fixed to the source job's values and cannot be changed by the operator.
  const isLocked = !!defaultSourceJobId
  const lockedCustomer = isLocked ? (customers.find(c => c.id === customerId) ?? null) : null
  const lockedProperty = isLocked ? (properties.find(p => p.id === propertyId) ?? null) : null

  const filteredProps = customerId ? properties.filter(p => p.customer_id === customerId) : properties
  const selectedProp  = properties.find(p => p.id === propertyId)
  const selectedCustomer = customers.find(c => c.id === customerId)

  useEffect(() => {
    if (!selectedProp) return
    if (initialInputs != null && !userChangedPropertyRef.current) {
      return
    }
    const acres = selectedProp.estimated_mowable_acres ?? selectedProp.parcel_acres
    const mappedFrequency = mapPropertyFrequency(selectedProp.service_frequency)
    const boolDefaults = propertyBooleanDefaults(selectedProp)
    const serviceInterests = selectedCustomer?.notes ? parseWebsiteServiceInterests(selectedCustomer.notes) : new Set<string>()
    const resolvedServiceDefaults =
      boolDefaults !== null
        ? boolDefaults
        : serviceInterests.size > 0
          ? serviceInterestDefaults(serviceInterests)
          : packageDefaults(selectedProp.default_service_package)
    const shouldZeroMowing = selectedProp.default_mowing_enabled === false

    setInputs(prev => ({
      ...prev,
      ...(acres && acres > 0 && !shouldZeroMowing ? { mowingMinutes: acrestoMowMinutes(acres) } : {}),
      ...(shouldZeroMowing ? { mowingMinutes: 0 } : {}),
      ...(mappedFrequency ? { frequency: mappedFrequency } : {}),
      ...resolvedServiceDefaults,
    }))
  }, [propertyId, customerId]) // eslint-disable-line

  function set<K extends keyof EstimateInputs>(key: K, value: EstimateInputs[K]) {
    setInputs(prev => ({ ...prev, [key]: value }))
  }

  function toggleObstacle(key: string) {
    setInputs(prev => ({
      ...prev,
      obstacles: prev.obstacles.includes(key)
        ? prev.obstacles.filter(o => o !== key)
        : [...prev.obstacles, key],
    }))
  }

  async function handleNewPropertyParcelLookup() {
    const query = newPropertyAddress.trim()

    if (!query) {
      setNewPropertyParcelMessage('Enter a street address to search parcels.')
      return
    }

    setParcelLookupPending(true)
    setNewPropertyParcelMessage(null)

    try {
      const res = await fetch('/api/parcels/search?q=' + encodeURIComponent(query))
      if (!res.ok) throw new Error('Parcel search failed')

      const results = (await res.json()) as ParcelResult[]
      const best = results.find(r => (r.lot_sqft ?? 0) > 0)
      if (!best || !best.lot_sqft) {
        setNewPropertyParcelMessage('No parcel with lot size data found for that address search.')
        return
      }

      const parcelAcresRaw = best.lot_sqft / 43560
      const parcelAcres = Math.round(parcelAcresRaw * 100) / 100
      const toNum = (value: unknown) => {
        const n = parseFloat(String(value))
        return Number.isNaN(n) ? null : n
      }
      const timberAcres = toNum(best.raw_json?.attributes?.TimberAcres)
      const effectiveTimber = (timberAcres != null && timberAcres > 0 && timberAcres < parcelAcres) ? timberAcres : 0
      const mowableAcresRaw = estimateMowableAcres(parcelAcres, effectiveTimber, best.land_use)
      const mowableAcres = Math.round(mowableAcresRaw * 100) / 100
      const mowMinutes = acrestoMowMinutes(mowableAcres)

      setNewPropertyParcelAcres(parcelAcres.toFixed(2))
      setNewPropertyMowableAcres(mowableAcres.toFixed(2))
      set('mowingMinutes', mowMinutes)
      setNewPropertyParcelMessage(`Parcel imported. ${parcelAcres.toFixed(2)} ac total, ~${mowableAcres.toFixed(2)} mowable, ${mowMinutes} min mow time.`)
    } catch {
      setNewPropertyParcelMessage('Unable to search parcels right now. You can enter acres manually.')
    } finally {
      setParcelLookupPending(false)
    }
  }

  const pricingOverride = useMemo(() => ({
    ...DEFAULT_SETTINGS,
    ...(defaultMinimumPrice != null ? { minimumServicePrice: defaultMinimumPrice } : {}),
  }), [defaultMinimumPrice])
  const result     = useMemo(() => calculateEstimate(inputs, pricingOverride), [inputs, pricingOverride])
  const { breakdown, totalMinutes, finalEstimate } = result

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget
    const setHidden = (name: string, val: string) => {
      let el = form.querySelector<HTMLInputElement>('input[name="' + name + '"]')
      if (!el) {
        el = document.createElement('input')
        el.type = 'hidden'
        el.name = name
        form.appendChild(el)
      }
      el.value = val
    }
    setHidden('estimate_inputs_json', JSON.stringify(inputs))
    setHidden('final_estimate',       String(priceOverride ?? finalEstimate))
    setHidden('estimated_minutes',    String(totalMinutes))
    setHidden('frequency',            inputs.frequency)
    if (inlineEnabled && customerMode === 'new' && propertyMode === 'existing') {
      setHidden('property_reassignment_confirmed', propertyReassignmentConfirmed ? 'true' : 'false')
    }
  }

  const acres      = selectedProp ? (selectedProp.estimated_mowable_acres ?? selectedProp.parcel_acres) : null

  return (
    <form action={formAction} onSubmit={handleSubmit} className="form">
      <Toast message={state.success} />
      {state.error && <div className="alert alert-error">{state.error}</div>}
      <input type="hidden" name="customer_mode" value={inlineEnabled ? customerMode : 'existing'} />
      <input type="hidden" name="property_mode" value={inlineEnabled ? propertyMode : 'existing'} />
      {/* Hidden source_job_id — only present when form is locked to a source job */}
      {isLocked && <input type="hidden" name="source_job_id" value={defaultSourceJobId!} />}

      {/* Source job banner */}
      {defaultSourceJobId && (
        <div style={{
          marginBottom: '1rem', padding: '8px 12px', borderRadius: '6px',
          background: 'rgba(79,142,247,0.08)', border: '1px solid rgba(79,142,247,0.3)',
          fontSize: '0.875rem',
        }}>
          📋 <strong>Linked to completed job:</strong>{' '}
          {sourceJobTitle ?? 'Completed Job'}{sourceJobDateLabel ? ` · ${sourceJobDateLabel}` : ''}
        </div>
      )}
      {sourceJobWarning && (
        <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
          ⚠ {sourceJobWarning}
        </div>
      )}

      <CustomerSection
        inlineEnabled={inlineEnabled}
        customerMode={customerMode}
        setCustomerMode={setCustomerMode}
        newCustomerFirstName={newCustomerFirstName}
        setNewCustomerFirstName={setNewCustomerFirstName}
        newCustomerLastName={newCustomerLastName}
        setNewCustomerLastName={setNewCustomerLastName}
        newCustomerPhone={newCustomerPhone}
        setNewCustomerPhone={setNewCustomerPhone}
        newCustomerEmail={newCustomerEmail}
        setNewCustomerEmail={setNewCustomerEmail}
        isLocked={isLocked}
        lockedCustomer={lockedCustomer}
        customerId={customerId}
        onCustomerChange={id => { setCustomerId(id); if (selectedProp?.customer_id !== id) setPropertyId('') }}
        customers={customers}
        selectedCustomer={selectedCustomer}
      />

      <PropertySection
        inlineEnabled={inlineEnabled}
        customerMode={customerMode}
        propertyMode={propertyMode}
        setPropertyMode={setPropertyMode}
        propertyReassignmentConfirmed={propertyReassignmentConfirmed}
        setPropertyReassignmentConfirmed={setPropertyReassignmentConfirmed}
        newPropertyAddress={newPropertyAddress}
        setNewPropertyAddress={setNewPropertyAddress}
        newPropertyCity={newPropertyCity}
        setNewPropertyCity={setNewPropertyCity}
        newPropertyCounty={newPropertyCounty}
        setNewPropertyCounty={setNewPropertyCounty}
        newPropertyState={newPropertyState}
        setNewPropertyState={setNewPropertyState}
        newPropertyParcelAcres={newPropertyParcelAcres}
        setNewPropertyParcelAcres={setNewPropertyParcelAcres}
        newPropertyMowableAcres={newPropertyMowableAcres}
        setNewPropertyMowableAcres={setNewPropertyMowableAcres}
        newPropertyParcelMessage={newPropertyParcelMessage}
        parcelLookupPending={parcelLookupPending}
        onParcelLookup={handleNewPropertyParcelLookup}
        isLocked={isLocked}
        lockedProperty={lockedProperty}
        propertyId={propertyId}
        onPropertyChange={id => { userChangedPropertyRef.current = true; setPropertyId(id) }}
        filteredProps={filteredProps}
        customerId={customerId}
        selectedProp={selectedProp}
        acres={acres}
      />

      <MowingSetupSection
        showParcelLookup={!inlineEnabled || propertyMode === 'existing'}
        importedParcel={importedEstimateParcel}
        onImportParcel={(parcel) => {
          setImportedEstimateParcel(parcel)
          if (parcel.mowingMinutes != null) set('mowingMinutes', parcel.mowingMinutes)
        }}
        inputs={inputs}
        set={set}
      />

      <ServiceInputsSection
        inputs={inputs}
        set={set}
        toggleObstacle={toggleObstacle}
        rateStr={rateStr}
        setRateStr={setRateStr}
      />

      <AddOnsSection inputs={inputs} set={set} />

      <div className="form-section-label">Notes &amp; Validity</div>
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">Valid Until</label>
          <input type="date" name="valid_until" className="form-input" value={validUntil}
            onChange={e => setValidUntil(e.target.value)} />
        </div>
      </div>
      <div className="form-field">
        <label className="form-label">Notes (optional)</label>
        <textarea name="notes" className="form-textarea" rows={2}
          value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Gate code, fence type, areas to avoid..." />
      </div>

      {/* Live estimate */}
      <EstimateSummary
        inputs={inputs}
        breakdown={breakdown}
        totalMinutes={totalMinutes}
        finalEstimate={finalEstimate}
        priceOverride={priceOverride}
        setPriceOverride={setPriceOverride}
        defaultMinimumPrice={defaultMinimumPrice}
      />

      {defaultSourceJobId && (
        <div className="form-field" style={{ marginTop: '0.5rem' }}>
          <label className="checkbox-label">
            <input type="checkbox" name="satisfies_follow_up" />
            Use the job created from this estimate as the follow-up for the completed job
          </label>
          <p className="form-hint" style={{ marginTop: '4px' }}>
            When the estimate is converted to a job, it will close the original job&apos;s follow-up slot.
          </p>
        </div>
      )}

      <div className="form-field" style={{ marginTop: '0.5rem' }}>
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="sets_property_defaults"
            defaultChecked={defaultSetsPropertyDefaults ?? false}
          />
          When approved, apply this estimate&apos;s frequency, scope, and price as the property&apos;s new default service agreement
        </label>
        <p className="form-hint" style={{ marginTop: '4px' }}>
          Use this only when this estimate replaces the property&apos;s ongoing agreement.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <Link href={cancelHref ?? '/estimates'} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</Link>
        <button type="submit" disabled={pending} className="btn btn-primary" style={{ flex: 2 }}>
          {pending ? 'Saving...' : (submitLabel ?? 'Create Estimate')}
        </button>
      </div>
    </form>
  )
}

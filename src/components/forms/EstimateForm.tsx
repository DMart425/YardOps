'use client'

import { useActionState, useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { FormState } from '@/types/database'
import { Toast } from '@/components/Toast'
import { calculateEstimate, DEFAULT_SETTINGS, formatMinutes, acrestoMowMinutes, estimateMowableAcres } from '@/lib/pricing'
import type { EstimateInputs } from '@/lib/pricing'
import ParcelLookup from '@/components/ParcelLookup'
import type { ImportedParcel } from '@/components/ParcelLookup'
import { parseWebsiteServiceInterests, formatFrequencyLabel } from '@/lib/frequency'
import { addDays } from '@/lib/date'
import { formatPhoneInput } from '@/lib/format'

interface CustomerOption { id: string; first_name: string; last_name: string | null; phone?: string | null; notes?: string | null }
interface PropertyOption {
  id: string; customer_id: string; property_name: string | null
  service_address: string; city: string | null
  parcel_acres: number | null; estimated_mowable_acres: number | null
  service_frequency: string | null; default_service_package: string | null
  default_mowing_enabled: boolean | null
  default_weed_eating_enabled: boolean | null
  default_edging_enabled: boolean | null
  default_blow_off_enabled: boolean | null
}

interface ParcelResult {
  id: string
  situs_address: string | null
  owner_name: string | null
  land_use: string | null
  lot_sqft: number | null
  raw_json: { attributes?: Record<string, unknown> } | null
}

const S = DEFAULT_SETTINGS

function defaultInputs(rate?: number): EstimateInputs {
  return {
    mowingMinutes:         60,
    setupMinutes:          S.defaultSetupMinutes,
    weedEatingLevel:       'normal',
    edgingLevel:           'normal',
    blowOffLevel:          'normal',
    grassCondition:        'maintained',
    terrain:               'flat',
    frequency:             'weekly',
    obstacles:             [],
    customObstacleMinutes: 0,
    baggingLevel:          'none',
    haulOffLevel:          'none',
    haulOffCustom:         0,
    leafCleanupLevel:      'none',
    leafCleanupCustom:     0,
    shrubSmallCount:       0,
    shrubMediumCount:      0,
    shrubLargeCount:       0,
    stickPickupLevel:      'none',
    travelFee:             0,
    hourlyRate:            rate ?? S.targetHourlyRate,
  }
}

const OBSTACLE_OPTIONS = [
  { key: 'fence_line',         label: 'Fence line (+10 min)' },
  { key: 'many_trees',         label: 'Many trees (+10 min)' },
  { key: 'playset_trampoline', label: 'Playset / Trampoline (+5 min)' },
  { key: 'sheds_outbuildings', label: 'Sheds / Outbuildings (+5 min)' },
  { key: 'flower_beds',        label: 'Flower beds / Landscape borders (+10 min)' },
  { key: 'tight_gate',         label: 'Tight gate (+5 min)' },
  { key: 'pool_area',          label: 'Pool area (+10 min)' },
  { key: 'ditch',              label: 'Ditch (+15 min)' },
]

function mapPropertyFrequency(value: string | null): EstimateInputs['frequency'] | null {
  if (!value) return null
  if (value === 'weekly' || value === 'biweekly' || value === 'one_time' || value === 'monthly') {
    return value
  }
  return null
}

function packageDefaults(packageCode: string | null): Partial<EstimateInputs> {
  switch (packageCode) {
    case 'mow_only':
      return {
        weedEatingLevel: 'none',
        edgingLevel: 'none',
        blowOffLevel: 'none',
      }
    case 'mow_blow':
      return {
        weedEatingLevel: 'none',
        edgingLevel: 'none',
        blowOffLevel: 'normal',
      }
    case 'full_service_mow_edge_trim_blow':
      return {
        weedEatingLevel: 'normal',
        edgingLevel: 'normal',
        blowOffLevel: 'normal',
      }
    case 'first_cut_overgrown':
      return {
        grassCondition: 'overgrown',
        weedEatingLevel: 'heavy',
        edgingLevel: 'normal',
        blowOffLevel: 'heavy_cleanup',
      }
    case 'leaf_cleanup':
      return {
        leafCleanupLevel: 'medium',
      }
    default:
      return {}
  }
}

function serviceInterestDefaults(interests: Set<string>): Partial<EstimateInputs> {
  if (interests.size === 0) return {}
  
  return {
    weedEatingLevel: interests.has('weed_eating') ? 'normal' : 'none',
    edgingLevel: interests.has('edging') ? 'normal' : 'none',
    blowOffLevel: interests.has('blow_off') ? 'normal' : 'none',
  }
}

function propertyBooleanDefaults(prop: PropertyOption): Partial<EstimateInputs> | null {
  if (
    prop.default_mowing_enabled      == null &&
    prop.default_weed_eating_enabled == null &&
    prop.default_edging_enabled      == null &&
    prop.default_blow_off_enabled    == null
  ) return null
  const result: Partial<EstimateInputs> = {}
  if (prop.default_weed_eating_enabled != null) {
    result.weedEatingLevel = prop.default_weed_eating_enabled ? 'normal' : 'none'
  }
  if (prop.default_edging_enabled != null) {
    result.edgingLevel = prop.default_edging_enabled ? 'normal' : 'none'
  }
  if (prop.default_blow_off_enabled != null) {
    result.blowOffLevel = prop.default_blow_off_enabled ? 'normal' : 'none'
  }
  return result
}

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
  const freqLabels: Record<string, string> = {
    weekly: 'Weekly', biweekly: 'Bi-Weekly', one_time: 'One-Time', monthly: 'Monthly',
  }

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
            onChange={e => { setCustomerId(e.target.value); if (selectedProp?.customer_id !== e.target.value) setPropertyId('') }}>
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

      {inlineEnabled && (
        <div className="form-field">
          <label className="form-label">Property Entry Mode</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <label className="checkbox-label" style={{ margin: 0 }}>
              <input
                type="radio"
                name="property_mode_ui"
                value="existing"
                checked={propertyMode === 'existing'}
                onChange={() => setPropertyMode('existing')}
              />
              Existing Property
            </label>
            <label className="checkbox-label" style={{ margin: 0 }}>
              <input
                type="radio"
                name="property_mode_ui"
                value="new"
                checked={propertyMode === 'new'}
                onChange={() => setPropertyMode('new')}
              />
              New Property
            </label>
          </div>
        </div>
      )}

      {inlineEnabled && customerMode === 'new' && propertyMode === 'existing' && (
        <div className="alert alert-warning" style={{ marginBottom: '0.75rem' }}>
          <div style={{ marginBottom: '8px', fontWeight: 600 }}>⚠ Property Reassignment</div>
          <p style={{ marginBottom: '8px', fontSize: '0.875rem' }}>
            This will move the selected property from its current customer to the new customer. This is typically used for tenant/customer turnover.
          </p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={propertyReassignmentConfirmed}
              onChange={e => setPropertyReassignmentConfirmed(e.target.checked)}
            />
            I understand this will move the property to the new customer
          </label>
        </div>
      )}

      {inlineEnabled && propertyMode === 'new' && (
        <div className="card" style={{ marginBottom: '0.75rem', padding: '10px' }}>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Street address</label>
              <input
                name="new_property_service_address"
                className="form-input"
                placeholder="123 Main St"
                autoCapitalize="words"
                value={newPropertyAddress}
                onChange={e => setNewPropertyAddress(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label">City</label>
              <input
                name="new_property_city"
                className="form-input"
                placeholder="Wicksburg"
                autoCapitalize="words"
                value={newPropertyCity}
                onChange={e => setNewPropertyCity(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">County</label>
              <input
                name="new_property_county"
                className="form-input"
                placeholder="Houston"
                autoCapitalize="words"
                value={newPropertyCounty}
                onChange={e => setNewPropertyCounty(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label">State</label>
              <input
                name="new_property_state"
                className="form-input"
                value={newPropertyState}
                onChange={e => setNewPropertyState(e.target.value.toUpperCase())}
                required
              />
            </div>
          </div>
          <div className="form-field">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleNewPropertyParcelLookup}
              disabled={parcelLookupPending}
            >
              {parcelLookupPending ? 'Searching Parcel…' : 'Lookup Parcel From Address'}
            </button>
            {newPropertyParcelMessage && (
              <p className="form-hint" style={{ marginTop: '6px' }}>{newPropertyParcelMessage}</p>
            )}
          </div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Parcel acres (optional)</label>
              <input
                name="new_property_parcel_acres"
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                placeholder="0.00"
                value={newPropertyParcelAcres}
                onChange={e => setNewPropertyParcelAcres(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Mowable acres (optional)</label>
              <input
                name="new_property_estimated_mowable_acres"
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                placeholder="0.00"
                value={newPropertyMowableAcres}
                onChange={e => setNewPropertyMowableAcres(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {isLocked ? (
        <div className="form-field">
          <label className="form-label">Property</label>
          <div className="form-input" style={{ color: 'var(--text-muted, #888)', cursor: 'default', userSelect: 'none' }}>
            {lockedProperty
              ? `${lockedProperty.property_name ?? lockedProperty.service_address}${lockedProperty.city ? ', ' + lockedProperty.city : ''}`
              : propertyId}
          </div>
          <input type="hidden" name="property_id" value={propertyId} />
        </div>
      ) : (!inlineEnabled || propertyMode === 'existing') && (
        <div className="form-field">
          <label className="form-label">Property *</label>
          <select
            name="property_id"
            className="form-select"
            required={!inlineEnabled || propertyMode === 'existing'}
            value={propertyId}
            onChange={e => {
              userChangedPropertyRef.current = true
              setPropertyId(e.target.value)
            }}>
            <option value="">— Select property —</option>
            {filteredProps.map(p => (
              <option key={p.id} value={p.id}>{p.property_name ?? p.service_address}{p.city ? ', ' + p.city : ''}</option>
            ))}
          </select>
          {customerId && filteredProps.length === 0 && (
            <>
              <p className="form-hint" style={{ color: 'var(--color-warning)' }}>
                This customer has no active properties yet. Add a full property from the customer/lead detail page first.
              </p>
              <Link href={`/customers/${customerId}`} className="btn btn-sm btn-secondary" style={{ marginTop: '8px' }}>
                Open Contact
              </Link>
            </>
          )}
          {acres && (
            <p className="form-hint">
              ~{Number(acres).toFixed(2)} mowable acres — mow time set to {acrestoMowMinutes(acres)} min
            </p>
          )}
          {selectedProp?.service_frequency && mapPropertyFrequency(selectedProp.service_frequency) && (
            <p className="form-hint">
              Frequency defaulted from property: {formatFrequencyLabel(selectedProp.service_frequency)}
            </p>
          )}
          {(() => {
            if (!selectedProp) return null
            const boolDefaults = propertyBooleanDefaults(selectedProp)
            if (boolDefaults !== null) {
              const enabled = [
                selectedProp.default_mowing_enabled !== false && 'Mowing',
                selectedProp.default_weed_eating_enabled === true && 'Weed eating',
                selectedProp.default_edging_enabled === true && 'Edging',
                selectedProp.default_blow_off_enabled === true && 'Blow off',
              ].filter(Boolean)
              return (
                <p className="form-hint">
                  Service defaults applied from property: {enabled.length > 0 ? enabled.join(', ') : 'None'}
                </p>
              )
            }
            if (selectedProp.default_service_package) {
              return (
                <p className="form-hint">
                  Service defaults applied from legacy package: {selectedProp.default_service_package.replace(/_/g, ' ')}
                </p>
              )
            }
            return null
          })()}
        </div>
      )}

      <div className="form-section-label">Mowing &amp; Setup</div>
      {(!inlineEnabled || propertyMode === 'existing') && (
        <div className="form-field">
          <label className="form-label">Look up parcel by address</label>
          <ParcelLookup onImport={(parcel) => {
            setImportedEstimateParcel(parcel)
            if (parcel.mowingMinutes != null) set('mowingMinutes', parcel.mowingMinutes)
          }} />
          <p className="form-hint">Search parcel data to override mow time when needed, even after property defaults are applied</p>

          {importedEstimateParcel && (
            <div className="card" style={{ marginTop: '10px' }}>
              <div className="section-heading" style={{ marginBottom: '8px' }}>Imported Parcel</div>

              {(importedEstimateParcel.streetAddress || importedEstimateParcel.address) && (
                <div className="card-row">
                  <span className="text-muted text-small">Address</span>
                  <span className="text-small">{importedEstimateParcel.streetAddress || importedEstimateParcel.address}</span>
                </div>
              )}

              {(importedEstimateParcel.city || importedEstimateParcel.state || importedEstimateParcel.postalCode) && (
                <div className="card-row">
                  <span className="text-muted text-small">City / State / ZIP</span>
                  <span className="text-small">
                    {[
                      importedEstimateParcel.city,
                      importedEstimateParcel.state,
                      importedEstimateParcel.postalCode,
                    ].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}

              <div className="card-row">
                <span className="text-muted text-small">County</span>
                <span className="text-small">{importedEstimateParcel.county || 'Not provided'}</span>
              </div>

              {importedEstimateParcel.parcelAcres != null && (
                <div className="card-row">
                  <span className="text-muted text-small">Parcel Acres</span>
                  <span className="text-small">{importedEstimateParcel.parcelAcres.toFixed(2)} ac</span>
                </div>
              )}

              {importedEstimateParcel.mowableAcres != null && (
                <div className="card-row">
                  <span className="text-muted text-small">Est. Mowable Acres</span>
                  <span className="text-small">~{importedEstimateParcel.mowableAcres.toFixed(2)} ac</span>
                </div>
              )}

              {importedEstimateParcel.mowingMinutes != null && (
                <div className="card-row">
                  <span className="text-muted text-small">Est. Mowing Minutes</span>
                  <span className="text-small">{importedEstimateParcel.mowingMinutes} min</span>
                </div>
              )}

              {importedEstimateParcel.parcelAcres == null && (
                <div className="card-row">
                  <span className="text-muted text-small">Lot Size</span>
                  <span className="text-small">No usable lot size data</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">Mow time (min)</label>
          <input type="number" min="0" step="5" className="form-input"
            value={inputs.mowingMinutes === 0 ? '' : inputs.mowingMinutes}
            placeholder="0"
            onChange={e => set('mowingMinutes', e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)} />
          <p className="form-hint">Auto-filled from parcel data</p>
        </div>
        <div className="form-field">
          <label className="form-label">Setup / Load (min)</label>
          <input type="number" min="0" step="5" className="form-input"
            value={inputs.setupMinutes === 0 ? '' : inputs.setupMinutes}
            placeholder="0"
            onChange={e => set('setupMinutes', e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)} />
        </div>
      </div>

      <div className="form-section-label">Service Levels</div>
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">Weed Eating</label>
          <select className="form-select" value={inputs.weedEatingLevel} onChange={e => set('weedEatingLevel', e.target.value)}>
            <option value="none">None (0 min)</option>
            <option value="light">Light (10 min)</option>
            <option value="normal">Normal (20 min)</option>
            <option value="heavy">Heavy (35 min)</option>
            <option value="very_heavy">Very Heavy (50 min)</option>
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Edging</label>
          <select className="form-select" value={inputs.edgingLevel} onChange={e => set('edgingLevel', e.target.value)}>
            <option value="none">None (0 min)</option>
            <option value="light">Light (5 min)</option>
            <option value="normal">Normal (10 min)</option>
            <option value="heavy">Heavy (20 min)</option>
            <option value="very_heavy">Very Heavy (30 min)</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">Blow Off</label>
          <select className="form-select" value={inputs.blowOffLevel} onChange={e => set('blowOffLevel', e.target.value)}>
            <option value="none">None (0 min)</option>
            <option value="basic">Basic (5 min)</option>
            <option value="normal">Normal (10 min)</option>
            <option value="large_area">Large Area (15 min)</option>
            <option value="heavy_cleanup">Heavy Cleanup (25 min)</option>
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Frequency</label>
          <select className="form-select" value={inputs.frequency} onChange={e => set('frequency', e.target.value)}>
            <option value="weekly">Weekly (x1.0)</option>
            <option value="biweekly">Bi-Weekly (x1.15)</option>
            <option value="one_time">One-Time (x1.35)</option>
            <option value="monthly">Monthly (x1.5)</option>
          </select>
        </div>
      </div>

      <div className="form-section-label">Conditions</div>
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">Grass Condition</label>
          <select className="form-select" value={inputs.grassCondition} onChange={e => set('grassCondition', e.target.value)}>
            <option value="maintained">Maintained (x1.0)</option>
            <option value="slightly_tall">Slightly Tall (x1.15)</option>
            <option value="overgrown">Overgrown (x1.5)</option>
            <option value="severely_overgrown">Severely Overgrown (x2.0)</option>
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Terrain</label>
          <select className="form-select" value={inputs.terrain} onChange={e => set('terrain', e.target.value)}>
            <option value="flat">Flat / Easy (x1.0)</option>
            <option value="slight_slope">Slight Slope (x1.1)</option>
            <option value="ditches">Ditches / Uneven (x1.2)</option>
            <option value="difficult">Difficult Terrain (x1.35)</option>
          </select>
        </div>
      </div>

      <div className="form-section-label">Obstacles</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
        {OBSTACLE_OPTIONS.map(o => (
          <label key={o.key} className="checkbox-label">
            <input type="checkbox"
              checked={inputs.obstacles.includes(o.key)}
              onChange={() => toggleObstacle(o.key)} />
            {o.label}
          </label>
        ))}
      </div>
      <div className="form-field">
        <label className="form-label">Other obstacles (extra minutes)</label>
        <input type="number" min="0" step="5" className="form-input"
          value={inputs.customObstacleMinutes || ''}
          onChange={e => set('customObstacleMinutes', parseInt(e.target.value) || 0)}
          placeholder="0" />
      </div>

      <div className="form-section-label">Rate &amp; Travel</div>
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">Hourly rate ($/hr)</label>
          <input type="number" min="1" step="1" className="form-input"
            value={rateStr}
            onChange={e => {
              setRateStr(e.target.value)
              const parsed = parseFloat(e.target.value)
              if (!isNaN(parsed) && parsed > 0) set('hourlyRate', parsed)
            }}
            onBlur={() => {
              const parsed = parseFloat(rateStr)
              if (isNaN(parsed) || parsed <= 0) setRateStr(String(inputs.hourlyRate))
            }} />
          <p className="form-hint">Adjust for weekly vs bi-weekly</p>
        </div>
        <div className="form-field">
          <label className="form-label">Travel fee ($)</label>
          <input type="number" min="0" step="5" className="form-input"
            value={inputs.travelFee || ''}
            onChange={e => set('travelFee', parseFloat(e.target.value) || 0)}
            placeholder="0" />
        </div>
      </div>

      <div className="form-section-label">Add-On Services</div>
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">Bagging clippings</label>
          <select className="form-select" value={inputs.baggingLevel} onChange={e => set('baggingLevel', e.target.value)}>
            <option value="none">None</option>
            <option value="light">Light (+$25)</option>
            <option value="normal">Normal (+$50)</option>
            <option value="heavy">Heavy (+$75)</option>
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Stick / Limb pickup</label>
          <select className="form-select" value={inputs.stickPickupLevel} onChange={e => set('stickPickupLevel', e.target.value)}>
            <option value="none">None</option>
            <option value="light">Light (+$25)</option>
            <option value="normal">Normal (+$50)</option>
            <option value="heavy">Heavy (+$100)</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">Leaf cleanup</label>
          <select className="form-select" value={inputs.leafCleanupLevel} onChange={e => set('leafCleanupLevel', e.target.value)}>
            <option value="none">None</option>
            <option value="small">Small (+$75)</option>
            <option value="medium">Medium (+$150)</option>
            <option value="large">Large (+$250)</option>
            <option value="custom">Custom price</option>
          </select>
          {inputs.leafCleanupLevel === 'custom' && (
            <input type="number" min="0" className="form-input" style={{ marginTop: '6px' }}
              value={inputs.leafCleanupCustom || ''}
              onChange={e => set('leafCleanupCustom', parseFloat(e.target.value) || 0)}
              placeholder="Enter amount" />
          )}
        </div>
        <div className="form-field">
          <label className="form-label">Haul-off</label>
          <select className="form-select" value={inputs.haulOffLevel} onChange={e => set('haulOffLevel', e.target.value)}>
            <option value="none">None</option>
            <option value="small">Small (+$50)</option>
            <option value="medium">Medium (+$100)</option>
            <option value="large">Large (custom)</option>
          </select>
          {inputs.haulOffLevel === 'large' && (
            <input type="number" min="0" className="form-input" style={{ marginTop: '6px' }}
              value={inputs.haulOffCustom || ''}
              onChange={e => set('haulOffCustom', parseFloat(e.target.value) || 0)}
              placeholder="Enter amount" />
          )}
        </div>
      </div>
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">Small shrubs @ $15 ea</label>
          <input type="number" min="0" step="1" className="form-input" placeholder="0"
            value={inputs.shrubSmallCount || ''}
            onChange={e => set('shrubSmallCount', parseInt(e.target.value) || 0)} />
        </div>
        <div className="form-field">
          <label className="form-label">Medium shrubs @ $25 ea</label>
          <input type="number" min="0" step="1" className="form-input" placeholder="0"
            value={inputs.shrubMediumCount || ''}
            onChange={e => set('shrubMediumCount', parseInt(e.target.value) || 0)} />
        </div>
      </div>
      <div className="form-field" style={{ maxWidth: '50%' }}>
        <label className="form-label">Large shrubs @ $40 ea</label>
        <input type="number" min="0" step="1" className="form-input" placeholder="0"
          value={inputs.shrubLargeCount || ''}
          onChange={e => set('shrubLargeCount', parseInt(e.target.value) || 0)} />
      </div>

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
      <div className="estimate-total-row" style={{ flexDirection: 'column', gap: '10px', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="font-bold">Recommended Estimate</div>
            <div className="card-meta" style={{ color: 'var(--color-primary)' }}>
              {formatMinutes(totalMinutes)} &middot; {freqLabels[inputs.frequency]} &middot; ${inputs.hourlyRate}/hr
            </div>
          </div>
          <span className="stat-value" style={{ fontSize: '2rem' }}>${priceOverride ?? finalEstimate}</span>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Setup</span><span>{breakdown.setupMinutes} min</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Mowing</span><span>{breakdown.mowingMinutes} min</span>
          </div>
          {breakdown.weedEatingMinutes > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Weed Eating</span><span>{breakdown.weedEatingMinutes} min</span>
            </div>
          )}
          {breakdown.edgingMinutes > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Edging</span><span>{breakdown.edgingMinutes} min</span>
            </div>
          )}
          {breakdown.blowOffMinutes > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Blow Off</span><span>{breakdown.blowOffMinutes} min</span>
            </div>
          )}
          {breakdown.obstacleMinutes > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Obstacles</span><span>+{breakdown.obstacleMinutes} min</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: '3px', marginTop: '1px' }}>
            <span>Base labor</span><span>{breakdown.baseLaborMinutes} min</span>
          </div>
          {breakdown.grassAdjustedMinutes !== breakdown.baseLaborMinutes && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>After grass condition</span><span>{breakdown.grassAdjustedMinutes} min</span>
            </div>
          )}
          {breakdown.terrainAdjustedMinutes !== breakdown.grassAdjustedMinutes && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>After terrain</span><span>{breakdown.terrainAdjustedMinutes} min</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Labor ({breakdown.estimatedHours} hr x ${inputs.hourlyRate})</span>
            <span>${breakdown.laborPrice.toFixed(2)}</span>
          </div>
          {breakdown.frequencyMultiplier !== 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Frequency x{breakdown.frequencyMultiplier}</span>
              <span>${breakdown.frequencyAdjustedPrice.toFixed(2)}</span>
            </div>
          )}
          {breakdown.addOnsTotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Add-ons</span><span>+${breakdown.addOnsTotal.toFixed(2)}</span>
            </div>
          )}
          {breakdown.travelFee > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Travel</span><span>+${breakdown.travelFee.toFixed(2)}</span>
            </div>
          )}
          {breakdown.minimumApplied && (
            <div style={{ color: 'var(--color-warning)' }}>
              Minimum charge of ${defaultMinimumPrice ?? S.minimumServicePrice} applied
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, borderTop: '1px solid var(--color-border)', paddingTop: '3px', marginTop: '1px' }}>
            <span>Final (rounded to $5)</span><span>${finalEstimate}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--color-border)' }}>
            <label className="form-label" style={{ margin: 0, flexShrink: 0 }}>Override price ($)</label>
            <input
              type="number" min="0" step="5" className="form-input" style={{ width: '100px', margin: 0 }}
              placeholder={String(finalEstimate)}
              value={priceOverride ?? ''}
              onChange={e => setPriceOverride(e.target.value === '' ? null : parseFloat(e.target.value) || null)} />
            {priceOverride != null && (
              <button type="button" className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                onClick={() => setPriceOverride(null)}>Reset</button>
            )}
          </div>
        </div>
      </div>

      {defaultSourceJobId && (
        <div className="form-field" style={{ marginTop: '0.5rem' }}>
          <label className="checkbox-label">
            <input type="checkbox" name="satisfies_follow_up" />
            This estimate satisfies the follow-up for that completed job
          </label>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px' }}>
        <Link href={cancelHref ?? '/estimates'} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</Link>
        <button type="submit" disabled={pending} className="btn btn-primary" style={{ flex: 2 }}>
          {pending ? 'Saving...' : (submitLabel ?? 'Create Estimate')}
        </button>
      </div>
    </form>
  )
}
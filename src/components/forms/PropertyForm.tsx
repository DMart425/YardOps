'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import type { FormState, Property } from '@/types/database'
import { Toast } from '@/components/Toast'
import ParcelLookup from '@/components/ParcelLookup'
import type { ImportedParcel } from '@/components/ParcelLookup'

type CustomerOption = { id: string; first_name: string; last_name: string | null; status?: string | null }

function deriveDefaultServiceBooleans(defaultValues?: Partial<Property>): {
  mowing: boolean; weedEating: boolean; edging: boolean; blowOff: boolean
} {
  const hasAny =
    defaultValues?.default_mowing_enabled      != null ||
    defaultValues?.default_weed_eating_enabled != null ||
    defaultValues?.default_edging_enabled      != null ||
    defaultValues?.default_blow_off_enabled    != null
  if (hasAny) {
    return {
      mowing:     defaultValues?.default_mowing_enabled      ?? true,
      weedEating: defaultValues?.default_weed_eating_enabled ?? false,
      edging:     defaultValues?.default_edging_enabled      ?? false,
      blowOff:    defaultValues?.default_blow_off_enabled    ?? false,
    }
  }
  switch (defaultValues?.default_service_package) {
    case 'mow_only':                        return { mowing: true, weedEating: false, edging: false, blowOff: false }
    case 'mow_blow':                        return { mowing: true, weedEating: false, edging: false, blowOff: true  }
    case 'full_service_mow_edge_trim_blow': return { mowing: true, weedEating: true,  edging: true,  blowOff: true  }
    case 'first_cut_overgrown':             return { mowing: true, weedEating: true,  edging: true,  blowOff: true  }
    default:                                return { mowing: true, weedEating: false, edging: false, blowOff: false }
  }
}

type Props = {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
  submitLabel: string
  cancelHref: string
  returnTo?: string
  customers: CustomerOption[]
  defaultValues?: Partial<Property>
  defaultCustomerId?: string
}

export function PropertyForm({
  action,
  submitLabel,
  cancelHref,
  returnTo,
  customers,
  defaultValues,
  defaultCustomerId,
}: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, { error: null })
  const [serviceAddress, setServiceAddress] = useState(defaultValues?.service_address ?? '')
  const [city, setCity] = useState(defaultValues?.city ?? '')
  const [stateCode, setStateCode] = useState(defaultValues?.state ?? '')
  const [postalCode, setPostalCode] = useState(defaultValues?.postal_code ?? '')
  const [county, setCounty] = useState(defaultValues?.county ?? '')
  const [parcelId, setParcelId] = useState(defaultValues?.parcel_id ?? '')
  const [parcelAcres, setParcelAcres] = useState(defaultValues?.parcel_acres?.toFixed(2) ?? '')
  const [mowableAcres, setMowableAcres] = useState(defaultValues?.estimated_mowable_acres?.toFixed(2) ?? '')
  const [lotSizeSource, setLotSizeSource] = useState(defaultValues?.lot_size_source ?? 'manual')
  const [parcelHelper, setParcelHelper] = useState<string | null>(null)

  const initSvc = deriveDefaultServiceBooleans(defaultValues)
  const [svcMowing,     setSvcMowing]     = useState(initSvc.mowing)
  const [svcWeedEating, setSvcWeedEating] = useState(initSvc.weedEating)
  const [svcEdging,     setSvcEdging]     = useState(initSvc.edging)
  const [svcBlowOff,    setSvcBlowOff]    = useState(initSvc.blowOff)

  function handleParcelImport(parcel: ImportedParcel) {
    setServiceAddress(parcel.streetAddress || parcel.address)
    if (parcel.city) setCity(parcel.city)
    if (parcel.state) setStateCode(parcel.state)
    if (parcel.postalCode) setPostalCode(parcel.postalCode)
    if (parcel.county) setCounty(parcel.county)
    setParcelId(parcel.parcelId ?? '')
    setParcelAcres(parcel.parcelAcres != null ? parcel.parcelAcres.toFixed(2) : '')
    setMowableAcres(parcel.mowableAcres != null ? parcel.mowableAcres.toFixed(2) : '')
    setLotSizeSource(parcel.lotSizeSource)

    const helperBits = [
      parcel.landUse ? `Land use: ${parcel.landUse}` : null,
      parcel.source ? `Source: ${parcel.source}` : null,
    ].filter(Boolean)
    setParcelHelper(helperBits.length > 0 ? helperBits.join(' · ') : null)
  }

  return (
    <form action={formAction} className="form">
      <Toast message={state.success} />
      {state.error && <div className="alert alert-error">{state.error}</div>}
      <input type="hidden" name="parcel_id" value={parcelId} />
      <input type="hidden" name="lot_size_source" value={lotSizeSource} />
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}

      {/* Customer */}
      <div className="form-section-label">Customer</div>
      <div className="form-field">
        <label className="form-label" htmlFor="customer_id">Customer *</label>
        <select
          id="customer_id"
          name="customer_id"
          required
          className="form-select"
          defaultValue={defaultValues?.customer_id ?? defaultCustomerId ?? ''}
        >
          <option value="">Select a customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.first_name}{c.last_name ? ` ${c.last_name}` : ''}{c.status === 'lead' ? ' (Lead)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Parcel lookup */}
      <div className="form-section-label">Parcel Lookup</div>
      <div className="form-field">
        <label className="form-label">Search parcel by address</label>
        <ParcelLookup onImport={handleParcelImport} />
        <span className="form-hint">Import parcel-backed address and acreage, then adjust any fields below before saving.</span>
        {parcelHelper && <span className="form-hint">{parcelHelper}</span>}
      </div>

      {/* Address */}
      <div className="form-section-label">Address</div>
      <div className="form-field">
        <label className="form-label" htmlFor="property_name">Property Name</label>
        <input
          id="property_name"
          name="property_name"
          className="form-input"
          placeholder="e.g. Smith Residence, Back Lot"
          defaultValue={defaultValues?.property_name ?? ''}
          autoCapitalize="words"
        />
        <span className="form-hint">Optional label — makes the property easier to identify</span>
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="service_address">Street Address *</label>
        <input
          id="service_address"
          name="service_address"
          required
          className="form-input"
          placeholder="123 Main St"
          value={serviceAddress}
          onChange={e => setServiceAddress(e.target.value)}
          autoCapitalize="words"
        />
      </div>

      <div className="form-row">
        <div className="form-field">
          <label className="form-label" htmlFor="city">City *</label>
          <input
            id="city"
            name="city"
            className="form-input"
            placeholder="Wicksburg"
            value={city}
            onChange={e => setCity(e.target.value)}
            autoCapitalize="words"
            required
          />
          <span className="form-hint">Parcel import may not include city. Verify before saving.</span>
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="postal_code">ZIP</label>
          <input
            id="postal_code"
            name="postal_code"
            className="form-input"
            placeholder="36352"
            value={postalCode}
            onChange={e => setPostalCode(e.target.value)}
            inputMode="numeric"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label className="form-label" htmlFor="county">County *</label>
          <input
            id="county"
            name="county"
            className="form-input"
            placeholder="County name"
            value={county}
            onChange={e => setCounty(e.target.value)}
            autoCapitalize="words"
            required
          />
          <span className="form-hint">Parcel import may not include county. Verify before saving.</span>
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="state">State *</label>
          <input
            id="state"
            name="state"
            className="form-input"
            value={stateCode}
            onChange={e => setStateCode(e.target.value.toUpperCase())}
            required
          />
          <span className="form-hint">Parcel import may not include state. Verify before saving.</span>
        </div>
      </div>

      {/* Lot size */}
      <div className="form-section-label">Lot Size</div>
      <div className="form-row">
        <div className="form-field">
          <label className="form-label" htmlFor="parcel_acres">Parcel Acres</label>
          <input
            id="parcel_acres"
            name="parcel_acres"
            type="number"
            step="0.01"
            min="0"
            className="form-input"
            placeholder="0.00"
            value={parcelAcres}
            onChange={e => setParcelAcres(e.target.value)}
            inputMode="decimal"
          />
          <span className="form-hint">From county records</span>
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="estimated_mowable_acres">Mowable Acres</label>
          <input
            id="estimated_mowable_acres"
            name="estimated_mowable_acres"
            type="number"
            step="0.01"
            min="0"
            className="form-input"
            placeholder="0.00"
            value={mowableAcres}
            onChange={e => setMowableAcres(e.target.value)}
            inputMode="decimal"
          />
          <span className="form-hint">Your estimate — used for pricing</span>
        </div>
      </div>

      {/* Service settings */}
      <div className="form-section-label">Service Settings</div>
      <div className="form-row">
        <div className="form-field">
          <label className="form-label" htmlFor="service_frequency">Frequency *</label>
          <select
            id="service_frequency"
            name="service_frequency"
            className="form-select"
            defaultValue={defaultValues?.service_frequency ?? 'one_time'}
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="one_time">One-time</option>
            <option value="custom">Custom</option>
            <option value="paused">Paused</option>
          </select>
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="preferred_service_day">Preferred Day</label>
          <select
            id="preferred_service_day"
            name="preferred_service_day"
            className="form-select"
            defaultValue={defaultValues?.preferred_service_day ?? ''}
          >
            <option value="">Any day</option>
            <option value="monday">Monday</option>
            <option value="tuesday">Tuesday</option>
            <option value="wednesday">Wednesday</option>
            <option value="thursday">Thursday</option>
            <option value="friday">Friday</option>
            <option value="saturday">Saturday</option>
          </select>
        </div>
      </div>

      <div className="form-field">
        <div className="form-label">Default Services</div>
        <span className="form-hint">Used as starting defaults for estimates and recurring work. You can still change each estimate before sending.</span>
        <div className="check-row" style={{ marginTop: '8px' }}>
          <input
            id="default_mowing_enabled"
            name="default_mowing_enabled"
            type="checkbox"
            checked={svcMowing}
            onChange={e => setSvcMowing(e.target.checked)}
          />
          <label htmlFor="default_mowing_enabled">Mowing</label>
        </div>
        <div className="check-row">
          <input
            id="default_weed_eating_enabled"
            name="default_weed_eating_enabled"
            type="checkbox"
            checked={svcWeedEating}
            onChange={e => setSvcWeedEating(e.target.checked)}
          />
          <label htmlFor="default_weed_eating_enabled">Weed eating / trimming</label>
        </div>
        <div className="check-row">
          <input
            id="default_edging_enabled"
            name="default_edging_enabled"
            type="checkbox"
            checked={svcEdging}
            onChange={e => setSvcEdging(e.target.checked)}
          />
          <label htmlFor="default_edging_enabled">Edging</label>
        </div>
        <div className="check-row">
          <input
            id="default_blow_off_enabled"
            name="default_blow_off_enabled"
            type="checkbox"
            checked={svcBlowOff}
            onChange={e => setSvcBlowOff(e.target.checked)}
          />
          <label htmlFor="default_blow_off_enabled">Blow off walkways / driveway / patio</label>
        </div>
      </div>

      <div className="form-field" style={{ marginTop: '16px' }}>
        <label className="form-label" htmlFor="default_price">Default Price ($)</label>
        <input
          id="default_price"
          name="default_price"
          type="number"
          step="0.01"
          min="0"
          className="form-input"
          placeholder="0.00"
          defaultValue={defaultValues?.default_price ?? ''}
          inputMode="decimal"
        />
      </div>

      {/* Access & warnings */}
      <div className="form-section-label">Access &amp; Warnings</div>

      <div className="form-field">
        <label className="form-label" htmlFor="gate_code">Gate Code</label>
        <input
          id="gate_code"
          name="gate_code"
          className="form-input"
          placeholder="e.g. #1234"
          defaultValue={defaultValues?.gate_code ?? ''}
        />
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="pet_warning">Pet Warning</label>
        <input
          id="pet_warning"
          name="pet_warning"
          className="form-input"
          placeholder="e.g. Large dog in back yard — secure before mowing"
          defaultValue={defaultValues?.pet_warning ?? ''}
        />
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="access_notes">Access Notes</label>
        <textarea
          id="access_notes"
          name="access_notes"
          className="form-textarea"
          rows={2}
          placeholder="Gate location, key box, etc."
          defaultValue={defaultValues?.access_notes ?? ''}
        />
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="obstacle_notes">Obstacle Notes</label>
        <textarea
          id="obstacle_notes"
          name="obstacle_notes"
          className="form-textarea"
          rows={2}
          placeholder="Slopes, ditches, tight spaces, etc."
          defaultValue={defaultValues?.obstacle_notes ?? ''}
        />
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="parking_notes">Parking Notes</label>
        <input
          id="parking_notes"
          name="parking_notes"
          className="form-input"
          placeholder="Where to park the truck/trailer"
          defaultValue={defaultValues?.parking_notes ?? ''}
        />
      </div>

      {/* Internal */}
      <div className="form-section-label">Internal</div>

      <div className="form-field">
        <label className="form-label" htmlFor="internal_notes">Internal Notes</label>
        <textarea
          id="internal_notes"
          name="internal_notes"
          className="form-textarea"
          rows={2}
          placeholder="Notes only you see"
          defaultValue={defaultValues?.internal_notes ?? ''}
        />
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="prop_status">Status</label>
        <select
          id="prop_status"
          name="status"
          className="form-select"
          defaultValue={defaultValues?.status ?? 'active'}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="archived">Archived</option>
        </select>
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

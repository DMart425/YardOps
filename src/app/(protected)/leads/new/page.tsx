'use client'

import { useActionState, useState } from 'react'
import { createLead } from '../actions'
import Link from 'next/link'
import type { FormState } from '@/types/database'
import ParcelLookup from '@/components/ParcelLookup'
import type { ImportedParcel } from '@/components/ParcelLookup'
import { formatPhoneInput } from '@/lib/format'

export default function NewLeadPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(createLead, { error: null })
  const [serviceAddress, setServiceAddress] = useState('')
  const [city, setCity] = useState('')
  const [stateCode, setStateCode] = useState('AL')
  const [postalCode, setPostalCode] = useState('')
  const [county, setCounty] = useState('')
  const [parcelId, setParcelId] = useState('')
  const [parcelAcres, setParcelAcres] = useState('')
  const [mowableAcres, setMowableAcres] = useState('')
  const [lotSizeSource, setLotSizeSource] = useState('manual')
  const [phone, setPhone] = useState('')

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
  }

  return (
    <div className="page">
      <Link href="/leads" className="back-link">← Leads</Link>
      <div className="page-header">
        <h1 className="page-title">New Lead</h1>
      </div>

      <div className="card">
        <p className="text-small text-muted" style={{ marginBottom: '10px' }}>
          Create a lead contact and full property together so estimate setup can begin immediately.
        </p>
        <form action={action} className="form">
          {state.error && <div className="alert alert-error">{state.error}</div>}
          <input type="hidden" name="parcel_id" value={parcelId} />
          <input type="hidden" name="lot_size_source" value={lotSizeSource} />

          <div className="form-section-label">Lead Contact</div>
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
                value={phone}
                onChange={e => setPhone(formatPhoneInput(e.target.value))}
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
            <label className="form-label" htmlFor="notes">Lead Notes</label>
            <textarea
              id="notes"
              name="notes"
              className="form-textarea"
              rows={2}
              placeholder="Scheduling preference, callback notes, anything helpful…"
            />
          </div>

          <div className="form-section-label">Parcel Lookup</div>
          <div className="form-field">
            <label className="form-label">Search parcel by address</label>
            <ParcelLookup onImport={handleParcelImport} />
            <span className="form-hint">Import parcel-backed address and acreage, then adjust any fields below before saving.</span>
          </div>

          <div className="form-section-label">Property</div>
          <div className="form-field">
            <label className="form-label" htmlFor="property_name">Property Name</label>
            <input
              id="property_name"
              name="property_name"
              className="form-input"
              placeholder="e.g. Smith Residence"
              autoCapitalize="words"
            />
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
                required
                className="form-input"
                placeholder="Wicksburg"
                value={city}
                onChange={e => setCity(e.target.value)}
                autoCapitalize="words"
              />
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
                required
                className="form-input"
                placeholder="Houston"
                value={county}
                onChange={e => setCounty(e.target.value)}
                autoCapitalize="words"
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="state">State *</label>
              <input
                id="state"
                name="state"
                required
                className="form-input"
                value={stateCode}
                onChange={e => setStateCode(e.target.value.toUpperCase())}
              />
            </div>
          </div>

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
              />
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
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="service_frequency">Requested Frequency *</label>
            <select
              id="service_frequency"
              name="service_frequency"
              className="form-select"
              defaultValue="one_time"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-Weekly</option>
              <option value="one_time">One-Time</option>
              <option value="custom">Custom</option>
              <option value="paused">Paused</option>
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">Requested Services</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
              <label className="checkbox-label">
                <input type="checkbox" name="svc_mowing" value="true" defaultChecked />
                Mowing
              </label>
              <label className="checkbox-label">
                <input type="checkbox" name="svc_weed_eating" value="true" />
                Weed Eating / Trimming
              </label>
              <label className="checkbox-label">
                <input type="checkbox" name="svc_edging" value="true" />
                Edging
              </label>
              <label className="checkbox-label">
                <input type="checkbox" name="svc_blow_off" value="true" />
                Blow Off Hard Surfaces
              </label>
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="access_notes">Access Notes</label>
              <textarea
                id="access_notes"
                name="access_notes"
                className="form-textarea"
                rows={2}
                placeholder="Gate location, key box, etc."
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="internal_notes">Internal Property Notes</label>
              <textarea
                id="internal_notes"
                name="internal_notes"
                className="form-textarea"
                rows={2}
                placeholder="Notes only visible in YardOps"
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="obstacle_notes">Obstacle Notes</label>
            <textarea
              id="obstacle_notes"
              name="obstacle_notes"
              className="form-textarea"
              rows={2}
              placeholder="Slopes, ditches, tight spaces, etc."
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

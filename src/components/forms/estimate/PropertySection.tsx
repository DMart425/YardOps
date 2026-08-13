'use client'

import Link from 'next/link'
import { acrestoMowMinutes } from '@/lib/pricing'
import { formatFrequencyLabel } from '@/lib/frequency'
import { mapPropertyFrequency, propertyBooleanDefaults } from './shared'
import type { PropertyOption } from './shared'

export function PropertySection({
  inlineEnabled,
  customerMode,
  propertyMode,
  setPropertyMode,
  propertyReassignmentConfirmed,
  setPropertyReassignmentConfirmed,
  newPropertyAddress,
  setNewPropertyAddress,
  newPropertyCity,
  setNewPropertyCity,
  newPropertyCounty,
  setNewPropertyCounty,
  newPropertyState,
  setNewPropertyState,
  newPropertyParcelAcres,
  setNewPropertyParcelAcres,
  newPropertyMowableAcres,
  setNewPropertyMowableAcres,
  newPropertyParcelMessage,
  parcelLookupPending,
  onParcelLookup,
  isLocked,
  lockedProperty,
  propertyId,
  onPropertyChange,
  filteredProps,
  customerId,
  selectedProp,
  acres,
}: {
  inlineEnabled: boolean
  customerMode: 'existing' | 'new'
  propertyMode: 'existing' | 'new'
  setPropertyMode: (mode: 'existing' | 'new') => void
  propertyReassignmentConfirmed: boolean
  setPropertyReassignmentConfirmed: (value: boolean) => void
  newPropertyAddress: string
  setNewPropertyAddress: (value: string) => void
  newPropertyCity: string
  setNewPropertyCity: (value: string) => void
  newPropertyCounty: string
  setNewPropertyCounty: (value: string) => void
  newPropertyState: string
  setNewPropertyState: (value: string) => void
  newPropertyParcelAcres: string
  setNewPropertyParcelAcres: (value: string) => void
  newPropertyMowableAcres: string
  setNewPropertyMowableAcres: (value: string) => void
  newPropertyParcelMessage: string | null
  parcelLookupPending: boolean
  onParcelLookup: () => void
  isLocked: boolean
  lockedProperty: PropertyOption | null
  propertyId: string
  onPropertyChange: (id: string) => void
  filteredProps: PropertyOption[]
  customerId: string
  selectedProp: PropertyOption | undefined
  acres: number | null
}) {
  return (
    <>
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
              onClick={onParcelLookup}
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
            onChange={e => onPropertyChange(e.target.value)}>
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
    </>
  )
}

'use client'

import type { EstimateInputs } from '@/lib/pricing'
import ParcelLookup from '@/components/ParcelLookup'
import type { ImportedParcel } from '@/components/ParcelLookup'
import type { SetEstimateInput } from './shared'

export function MowingSetupSection({
  showParcelLookup,
  importedParcel,
  onImportParcel,
  inputs,
  set,
}: {
  showParcelLookup: boolean
  importedParcel: ImportedParcel | null
  onImportParcel: (parcel: ImportedParcel) => void
  inputs: EstimateInputs
  set: SetEstimateInput
}) {
  return (
    <>
      <div className="form-section-label">Mowing &amp; Setup</div>
      {showParcelLookup && (
        <div className="form-field">
          <label className="form-label">Look up parcel by address</label>
          <ParcelLookup onImport={onImportParcel} />
          <p className="form-hint">Search parcel data to override mow time when needed, even after property defaults are applied</p>

          {importedParcel && (
            <div className="card" style={{ marginTop: '10px' }}>
              <div className="section-heading" style={{ marginBottom: '8px' }}>Imported Parcel</div>

              {(importedParcel.streetAddress || importedParcel.address) && (
                <div className="card-row">
                  <span className="text-muted text-small">Address</span>
                  <span className="text-small">{importedParcel.streetAddress || importedParcel.address}</span>
                </div>
              )}

              {(importedParcel.city || importedParcel.state || importedParcel.postalCode) && (
                <div className="card-row">
                  <span className="text-muted text-small">City / State / ZIP</span>
                  <span className="text-small">
                    {[
                      importedParcel.city,
                      importedParcel.state,
                      importedParcel.postalCode,
                    ].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}

              <div className="card-row">
                <span className="text-muted text-small">County</span>
                <span className="text-small">{importedParcel.county || 'Not provided'}</span>
              </div>

              {importedParcel.parcelAcres != null && (
                <div className="card-row">
                  <span className="text-muted text-small">Parcel Acres</span>
                  <span className="text-small">{importedParcel.parcelAcres.toFixed(2)} ac</span>
                </div>
              )}

              {importedParcel.mowableAcres != null && (
                <div className="card-row">
                  <span className="text-muted text-small">Est. Mowable Acres</span>
                  <span className="text-small">~{importedParcel.mowableAcres.toFixed(2)} ac</span>
                </div>
              )}

              {importedParcel.mowingMinutes != null && (
                <div className="card-row">
                  <span className="text-muted text-small">Est. Mowing Minutes</span>
                  <span className="text-small">{importedParcel.mowingMinutes} min</span>
                </div>
              )}

              {importedParcel.parcelAcres == null && (
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
    </>
  )
}

'use client'

import type { EstimateInputs } from '@/lib/pricing'
import type { SetEstimateInput } from './shared'

export function AddOnsSection({ inputs, set }: { inputs: EstimateInputs; set: SetEstimateInput }) {
  return (
    <>
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
    </>
  )
}

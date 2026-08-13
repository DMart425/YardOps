'use client'

import type { EstimateInputs } from '@/lib/pricing'
import { OBSTACLE_OPTIONS } from './shared'
import type { SetEstimateInput } from './shared'

export function ServiceInputsSection({
  inputs,
  set,
  toggleObstacle,
  rateStr,
  setRateStr,
}: {
  inputs: EstimateInputs
  set: SetEstimateInput
  toggleObstacle: (key: string) => void
  rateStr: string
  setRateStr: (value: string) => void
}) {
  return (
    <>
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
    </>
  )
}

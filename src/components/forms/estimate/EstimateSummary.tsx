'use client'

import { DEFAULT_SETTINGS, formatMinutes } from '@/lib/pricing'
import type { EstimateBreakdown, EstimateInputs } from '@/lib/pricing'

const freqLabels: Record<string, string> = {
  weekly: 'Weekly', biweekly: 'Bi-Weekly', one_time: 'One-Time', monthly: 'Monthly',
}

export function EstimateSummary({
  inputs,
  breakdown,
  totalMinutes,
  finalEstimate,
  priceOverride,
  setPriceOverride,
  defaultMinimumPrice,
}: {
  inputs: EstimateInputs
  breakdown: EstimateBreakdown
  totalMinutes: number
  finalEstimate: number
  priceOverride: number | null
  setPriceOverride: (value: number | null) => void
  defaultMinimumPrice?: number
}) {
  return (
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
            Minimum charge of ${defaultMinimumPrice ?? DEFAULT_SETTINGS.minimumServicePrice} applied
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
  )
}

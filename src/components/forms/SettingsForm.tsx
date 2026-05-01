'use client'

import { useActionState } from 'react'
import type { FormState } from '@/types/database'
import { saveSettings } from '@/app/(protected)/settings/actions'
import { Toast } from '@/components/Toast'

interface Defaults {
  target_hourly_rate:    number
  minimum_price:         number
  round_to_nearest:      number
  default_setup_minutes: number
}

export function SettingsForm({ defaults }: { defaults: Defaults }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSettings, { error: null })

  return (
    <form action={action} className="form">
      <Toast message={state.success} />
      {state.error && <div className="alert alert-error">{state.error}</div>}

      <div className="form-section-label">Pricing Defaults</div>
      <p className="text-small text-muted" style={{ marginBottom: '8px' }}>
        These defaults are used when creating new estimates. You can override the hourly rate per-estimate.
      </p>

      <div className="form-row">
        <div className="form-field">
          <label className="form-label" htmlFor="s_rate">Hourly Rate ($/hr)</label>
          <input
            id="s_rate"
            name="target_hourly_rate"
            type="number"
            min="1"
            step="1"
            className="form-input"
            defaultValue={defaults.target_hourly_rate}
          />
          <p className="form-hint">Default rate loaded on new estimates</p>
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="s_min">Minimum Charge ($)</label>
          <input
            id="s_min"
            name="minimum_price"
            type="number"
            min="0"
            step="5"
            className="form-input"
            defaultValue={defaults.minimum_price}
          />
          <p className="form-hint">No estimate goes below this amount</p>
        </div>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label className="form-label" htmlFor="s_round">Round to Nearest ($)</label>
          <input
            id="s_round"
            name="round_to_nearest"
            type="number"
            min="1"
            step="1"
            className="form-input"
            defaultValue={defaults.round_to_nearest}
          />
          <p className="form-hint">e.g. 5 rounds to nearest $5</p>
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="s_setup">Default Setup Time (min)</label>
          <input
            id="s_setup"
            name="default_setup_minutes"
            type="number"
            min="0"
            step="5"
            className="form-input"
            defaultValue={defaults.default_setup_minutes}
          />
          <p className="form-hint">Load/unload time added to every job</p>
        </div>
      </div>

      <div className="card" style={{ background: 'var(--color-bg-subtle)', marginBottom: '8px' }}>
        <div className="section-heading" style={{ marginBottom: '0.5rem' }}>Time Defaults (read-only)</div>
        <p className="text-small text-muted" style={{ marginBottom: '10px' }}>These are the current time defaults used in the estimate calculator.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.875rem' }}>
          <div className="card-row"><span>Weed eating — Normal</span><span>20 min</span></div>
          <div className="card-row"><span>Edging — Normal</span><span>10 min</span></div>
          <div className="card-row"><span>Blow off — Normal</span><span>10 min</span></div>
          <div className="card-row"><span>Mowing — 0.5 acre</span><span>35 min</span></div>
          <div className="card-row"><span>Mowing — 1.0 acre</span><span>60 min</span></div>
          <div className="card-row"><span>Mowing — 2.0 acres</span><span>120 min</span></div>
        </div>
      </div>

      <div className="card" style={{ background: 'var(--color-bg-subtle)', marginBottom: '8px' }}>
        <div className="section-heading" style={{ marginBottom: '0.5rem' }}>Multipliers (read-only)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.875rem' }}>
          <div className="card-row"><span>Frequency — Weekly</span><span>x1.0</span></div>
          <div className="card-row"><span>Frequency — Bi-Weekly</span><span>x1.15</span></div>
          <div className="card-row"><span>Frequency — One-Time</span><span>x1.35</span></div>
          <div className="card-row"><span>Frequency — Monthly</span><span>x1.5</span></div>
          <div className="card-row"><span>Grass — Overgrown</span><span>x1.5</span></div>
          <div className="card-row"><span>Grass — Severely Overgrown</span><span>x2.0</span></div>
          <div className="card-row"><span>Terrain — Ditches</span><span>x1.2</span></div>
          <div className="card-row"><span>Terrain — Difficult</span><span>x1.35</span></div>
        </div>
        <p className="text-small text-muted" style={{ marginTop: '8px' }}>To change multipliers, edit src/lib/pricing.ts</p>
      </div>

      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? 'Saving...' : 'Save Settings'}
      </button>
    </form>
  )
}

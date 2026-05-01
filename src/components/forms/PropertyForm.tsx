'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import type { FormState, Property } from '@/types/database'
import { Toast } from '@/components/Toast'

type CustomerOption = { id: string; first_name: string; last_name: string | null }

type Props = {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
  submitLabel: string
  cancelHref: string
  customers: CustomerOption[]
  defaultValues?: Partial<Property>
  defaultCustomerId?: string
}

export function PropertyForm({
  action,
  submitLabel,
  cancelHref,
  customers,
  defaultValues,
  defaultCustomerId,
}: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, { error: null })

  return (
    <form action={formAction} className="form">
      <Toast message={state.success} />
      {state.error && <div className="alert alert-error">{state.error}</div>}

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
              {c.first_name}{c.last_name ? ` ${c.last_name}` : ''}
            </option>
          ))}
        </select>
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
          defaultValue={defaultValues?.service_address ?? ''}
          autoCapitalize="words"
        />
      </div>

      <div className="form-row">
        <div className="form-field">
          <label className="form-label" htmlFor="city">City</label>
          <input
            id="city"
            name="city"
            className="form-input"
            placeholder="Wicksburg"
            defaultValue={defaultValues?.city ?? ''}
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
            defaultValue={defaultValues?.postal_code ?? ''}
            inputMode="numeric"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label className="form-label" htmlFor="county">County</label>
          <input
            id="county"
            name="county"
            className="form-input"
            placeholder="Houston"
            defaultValue={defaultValues?.county ?? ''}
            autoCapitalize="words"
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="state">State</label>
          <input
            id="state"
            name="state"
            className="form-input"
            defaultValue={defaultValues?.state ?? 'AL'}
          />
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
            defaultValue={defaultValues?.parcel_acres ?? ''}
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
            defaultValue={defaultValues?.estimated_mowable_acres ?? ''}
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

      <div className="form-row">
        <div className="form-field">
          <label className="form-label" htmlFor="default_service_package">Service Package</label>
          <select
            id="default_service_package"
            name="default_service_package"
            className="form-select"
            defaultValue={defaultValues?.default_service_package ?? ''}
          >
            <option value="">Not set</option>
            <option value="mow_only">Mow Only</option>
            <option value="mow_blow">Mow + Blow</option>
            <option value="full_service_mow_edge_trim_blow">Full Service</option>
            <option value="first_cut_overgrown">First Cut / Overgrown</option>
            <option value="leaf_cleanup">Leaf Cleanup</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div className="form-field">
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
      </div>

      <div className="check-row">
        <input
          id="auto_schedule_next"
          name="auto_schedule_next"
          type="checkbox"
          defaultChecked={defaultValues?.auto_schedule_next ?? true}
        />
        <label htmlFor="auto_schedule_next">Auto-schedule next visit when job is completed</label>
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

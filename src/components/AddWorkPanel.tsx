'use client'

import { useActionState, useState } from 'react'
import type { FormState } from '@/types/database'
import { addWorkToJob } from '@/app/(protected)/jobs/actions'
import { parseJobInputs, type ParsedJobInputs } from '@/lib/jobScope'

// "Add work to this visit" — one-time add-ons on an upcoming job (e.g. the
// customer asks for hedge trimming on their next regular visit). Updates the
// job in place; follow-ups regenerate from property defaults so nothing here
// carries onto future visits. After saving, offers a pre-filled confirmation
// SMS so the customer's YES reply becomes the dispute-protection record.
export function AddWorkPanel({
  jobId,
  rawJobInputs,
  currentPrice,
  customerPhone,
  customerFirstName,
  businessName,
}: {
  jobId: string
  rawJobInputs: Record<string, unknown> | null
  currentPrice: number | null
  customerPhone: string | null
  customerFirstName: string | null
  businessName: string | null
}) {
  const current: ParsedJobInputs | null = parseJobInputs(rawJobInputs)
  const [open, setOpen] = useState(false)

  const [baggingLevel,     setBaggingLevel]     = useState(current?.baggingLevel     ?? 'none')
  const [stickPickupLevel, setStickPickupLevel] = useState(current?.stickPickupLevel ?? 'none')
  const [leafCleanupLevel, setLeafCleanupLevel] = useState(current?.leafCleanupLevel ?? 'none')
  const [haulOffLevel,     setHaulOffLevel]     = useState(current?.haulOffLevel     ?? 'none')
  const [shrubSmall,  setShrubSmall]  = useState(String(current?.shrubSmallCount  ?? 0))
  const [shrubMedium, setShrubMedium] = useState(String(current?.shrubMediumCount ?? 0))
  const [shrubLarge,  setShrubLarge]  = useState(String(current?.shrubLargeCount  ?? 0))
  const [newPrice, setNewPrice] = useState('')

  const [state, action, pending] = useActionState<FormState, FormData>(
    addWorkToJob.bind(null, jobId),
    { error: null }
  )

  // Customer-facing add-on labels — no internal level detail (durable rule).
  function selectedWorkLabels(): string[] {
    const labels: string[] = []
    if (baggingLevel     !== 'none') labels.push('bagging clippings')
    if (stickPickupLevel !== 'none') labels.push('stick pickup')
    if (leafCleanupLevel !== 'none') labels.push('leaf cleanup')
    if (haulOffLevel     !== 'none') labels.push('haul-off')
    const shrubs = (parseInt(shrubSmall) || 0) + (parseInt(shrubMedium) || 0) + (parseInt(shrubLarge) || 0)
    if (shrubs > 0) labels.push('shrub/hedge trimming')
    return labels
  }

  function confirmationSmsHref(): string | null {
    if (!customerPhone) return null
    const work = selectedWorkLabels()
    if (work.length === 0) return null
    const priceNum = parseFloat(newPrice)
    const priceLine = Number.isFinite(priceNum) ? ` New visit total: $${priceNum.toFixed(0)}.` : ''
    const body =
      `Hi ${customerFirstName ?? ''}, confirming the added work for your upcoming visit: ${work.join(', ')}.` +
      `${priceLine} Reply YES to confirm. — ${businessName ?? 'Your lawn service'}`
    return `sms:${customerPhone}?&body=${encodeURIComponent(body)}`
  }

  const smsHref = state.success ? confirmationSmsHref() : null

  const selectStyle = { minWidth: 0 }

  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <div>
          <div className="section-heading" style={{ marginBottom: '2px' }}>Add Work to This Visit</div>
          <div className="text-small text-muted">One-time extras for this job only — future visits stay on the regular plan.</div>
        </div>
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => setOpen(o => !o)}>
          {open ? 'Close' : '➕ Add Work'}
        </button>
      </div>

      {open && (
        <form action={action} className="form" style={{ marginTop: '12px' }}>
          {state.error && <div className="alert alert-error">{state.error}</div>}
          {state.success && <div className="alert alert-success">{state.success}</div>}
          {smsHref && (
            <a href={smsHref} className="btn btn-secondary btn-full" style={{ marginBottom: '8px' }}>
              📲 Send Confirmation Text
            </a>
          )}

          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Bagging</label>
              <select name="bagging_level" className="form-select" style={selectStyle} value={baggingLevel} onChange={e => setBaggingLevel(e.target.value)}>
                <option value="none">None</option>
                <option value="light">Light</option>
                <option value="normal">Normal</option>
                <option value="heavy">Heavy</option>
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Stick Pickup</label>
              <select name="stick_pickup_level" className="form-select" style={selectStyle} value={stickPickupLevel} onChange={e => setStickPickupLevel(e.target.value)}>
                <option value="none">None</option>
                <option value="light">Light</option>
                <option value="normal">Normal</option>
                <option value="heavy">Heavy</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Leaf Cleanup</label>
              <select name="leaf_cleanup_level" className="form-select" style={selectStyle} value={leafCleanupLevel} onChange={e => setLeafCleanupLevel(e.target.value)}>
                <option value="none">None</option>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Haul-Off</label>
              <select name="haul_off_level" className="form-select" style={selectStyle} value={haulOffLevel} onChange={e => setHaulOffLevel(e.target.value)}>
                <option value="none">None</option>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          <div className="form-row" style={{ alignItems: 'flex-end' }}>
            <div className="form-field">
              <label className="form-label">Shrubs S</label>
              <input type="number" name="shrub_small_count" min="0" step="1" className="form-input" value={shrubSmall} onChange={e => setShrubSmall(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Shrubs M</label>
              <input type="number" name="shrub_medium_count" min="0" step="1" className="form-input" value={shrubMedium} onChange={e => setShrubMedium(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Shrubs L</label>
              <input type="number" name="shrub_large_count" min="0" step="1" className="form-input" value={shrubLarge} onChange={e => setShrubLarge(e.target.value)} />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Note (optional — goes in the job&apos;s internal notes)</label>
            <input type="text" name="work_note" className="form-input" placeholder="e.g. Trim front hedges, agreed by text 8/6" />
          </div>

          <div className="form-field">
            <label className="form-label">
              New total price ($) — leave blank to keep {currentPrice != null ? `$${Number(currentPrice).toFixed(0)}` : 'no price set'}
            </label>
            <input
              type="number"
              name="new_price"
              min="0"
              step="1"
              className="form-input"
              placeholder={currentPrice != null ? String(Number(currentPrice).toFixed(0)) : 'Enter agreed total'}
              value={newPrice}
              onChange={e => setNewPrice(e.target.value)}
            />
          </div>

          <button type="submit" disabled={pending} className="btn btn-primary btn-full">
            {pending ? 'Saving…' : 'Save Changes to This Visit'}
          </button>
        </form>
      )}
    </div>
  )
}

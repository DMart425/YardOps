'use client'

import { useActionState } from 'react'
import { clearEstimateVisit, scheduleEstimateVisit } from '../actions'
import type { FormState } from '@/types/database'

const TIME_OPTIONS = [
  'Morning (8–11 AM)',
  'Midday (11 AM–1 PM)',
  'Afternoon (1–5 PM)',
  'Anytime',
]

const initState: FormState = { error: null }

export default function ScheduleVisitForm({
  estimateId,
  currentDate,
  currentTime,
}: {
  estimateId: string
  currentDate: string | null
  currentTime: string | null
}) {
  const saveAction = scheduleEstimateVisit.bind(null, estimateId)
  const clearAction = clearEstimateVisit.bind(null, estimateId)
  const [saveState, saveDispatch, savePending] = useActionState(saveAction, initState)
  const [clearState, clearDispatch, clearPending] = useActionState(clearAction, initState)
  const message = saveState?.success ?? clearState?.success
  const error = saveState?.error ?? clearState?.error
  const hasVisit = Boolean(currentDate || currentTime)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <form action={saveDispatch} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label className="text-small text-muted" htmlFor="visit_date">Date</label>
          <input
            id="visit_date"
            name="visit_date"
            type="date"
            className="input"
            defaultValue={currentDate ?? ''}
            required
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label className="text-small text-muted" htmlFor="visit_time">Time window</label>
          <select id="visit_time" name="visit_time" className="input" defaultValue={currentTime ?? ''}>
            <option value="">— Select —</option>
            {TIME_OPTIONS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-error text-small">{error}</p>}
        {message && <p className="text-success text-small">{message}</p>}
        <button type="submit" className="btn btn-primary" disabled={savePending}>
          {savePending ? 'Saving…' : 'Save Visit'}
        </button>
      </form>

      <form action={clearDispatch}>
        <button type="submit" className="btn btn-secondary btn-full" disabled={clearPending}>
          {clearPending ? 'Saving…' : (hasVisit ? 'Clear Visit' : 'Waive Visit')}
        </button>
      </form>
    </div>
  )
}

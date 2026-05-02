'use client'

import { useActionState } from 'react'
import { scheduleEstimateVisit } from '../actions'
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
  const action = scheduleEstimateVisit.bind(null, estimateId)
  const [state, dispatch, pending] = useActionState(action, initState)

  return (
    <form action={dispatch} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
      {state?.error && <p className="text-error text-small">{state.error}</p>}
      {state?.success && <p className="text-success text-small">{state.success}</p>}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Saving…' : 'Save Visit'}
      </button>
    </form>
  )
}

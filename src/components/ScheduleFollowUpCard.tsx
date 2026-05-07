'use client'

import { useActionState, useState } from 'react'
import type { FormState } from '@/types/database'
import { scheduleFollowUpJob } from '@/app/(protected)/jobs/actions'
import { Toast } from '@/components/Toast'

function addDays(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

export function ScheduleFollowUpCard({
  jobId,
  scheduledDate,
  serviceFrequency,
}: {
  jobId: string
  scheduledDate: string | null
  serviceFrequency: string | null
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    scheduleFollowUpJob.bind(null, jobId),
    { error: null }
  )
  const [nextTimeWindow, setNextTimeWindow] = useState('')

  const suggestedDate = scheduledDate
    ? (serviceFrequency === 'weekly'
      ? addDays(scheduledDate, 7)
      : serviceFrequency === 'biweekly'
        ? addDays(scheduledDate, 14)
        : '')
    : ''

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div className="section-heading" style={{ marginBottom: '0.75rem' }}>Schedule Follow-up Visit</div>
      <Toast message={state.success} />
      {state.error && <div className="alert alert-error">{state.error}</div>}

      <form action={action} className="form">
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">Next Visit Date *</label>
            <input
              name="next_scheduled_date"
              type="date"
              className="form-input"
              defaultValue={suggestedDate}
              required
            />
          </div>
          <div className="form-field">
            <label className="form-label">Time Window</label>
            <select
              name="next_time_window"
              className="form-select"
              value={nextTimeWindow}
              onChange={e => setNextTimeWindow(e.target.value)}
            >
              <option value="">Anytime</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>

        {nextTimeWindow === 'custom' && (
          <div className="form-field">
            <label className="form-label">Custom time window *</label>
            <input
              name="custom_next_time_window"
              className="form-input"
              placeholder="e.g. 9am-11am"
              required
            />
          </div>
        )}

        <button type="submit" disabled={pending} className="btn btn-primary btn-full">
          {pending ? 'Scheduling...' : 'Schedule Follow-up'}
        </button>
      </form>
    </div>
  )
}

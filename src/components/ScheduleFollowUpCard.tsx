'use client'

import { useActionState, useState } from 'react'
import type { FormState } from '@/types/database'
import { scheduleFollowUpJob } from '@/app/(protected)/jobs/actions'
import { addDays } from '@/lib/date'
import { Toast } from '@/components/Toast'

export function ScheduleFollowUpCard({
  jobId,
  scheduledDate,
  completedDate,
  serviceFrequency,
  jobType,
}: {
  jobId: string
  scheduledDate: string | null
  completedDate?: string | null
  serviceFrequency: string | null
  jobType?: string | null
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    scheduleFollowUpJob.bind(null, jobId),
    { error: null }
  )
  const [nextTimeWindow, setNextTimeWindow] = useState('')

  // Anchor from actual completion date when available; fall back to scheduled date.
  // This prevents follow-up drift when a job is completed early or late.
  // Future: may also snap to preferred_service_day / route-balanced weekday.
  const anchorDate = completedDate ?? scheduledDate

  const suggestedDate = anchorDate
    ? (serviceFrequency === 'weekly'
      ? addDays(anchorDate, 7)
      : serviceFrequency === 'biweekly'
        ? addDays(anchorDate, 14)
        : '')
    : ''

  const todayLocal = new Intl.DateTimeFormat('en-CA').format(new Date())
  const suggestedIsPast = suggestedDate !== '' && suggestedDate < todayLocal

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div className="section-heading" style={{ marginBottom: '0.75rem' }}>Schedule Follow-up Visit</div>
      <Toast message={state.success} />
      {state.error && <div className="alert alert-error">{state.error}</div>}

      <form action={action} className="form">
        {jobType === 'one_time' && (
          <p className="form-hint">
            This was a one-time job. The follow-up will be scheduled as a recurring visit.
          </p>
        )}

        <div className="form-row">
          <div className="form-field">
            <label className="form-label">Next Visit Date *</label>
            <input
              name="next_scheduled_date"
              type="date"
              className="form-input"
              defaultValue={suggestedDate}
              min={todayLocal}
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

        {suggestedIsPast && (
          <div className="warning-banner">
            ⚠ Suggested date is in the past. Change it before scheduling.
          </div>
        )}

        <button type="submit" disabled={pending} className="btn btn-primary btn-full">
          {pending ? 'Scheduling...' : 'Schedule Follow-up'}
        </button>
      </form>
    </div>
  )
}

'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import type { FormState } from '@/types/database'
import { scheduleFollowUpJob } from '@/app/(protected)/jobs/actions'
import { addDays, getClosestWeekdayNearDate } from '@/lib/date'
import { Toast } from '@/components/Toast'

// Compact date label, e.g. "Jun 2"
function formatSuggestionDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

type SuggestionChip = {
  date: string
  label: string
  note: string
  emoji: string
}

export function ScheduleFollowUpCard({
  jobId,
  scheduledDate,
  completedDate,
  serviceFrequency,
  jobType,
  preferredServiceDay,
  scheduledJobDates,
  reviewFollowUpHref,
}: {
  jobId: string
  scheduledDate: string | null
  completedDate?: string | null
  serviceFrequency: string | null
  jobType?: string | null
  preferredServiceDay?: string | null
  scheduledJobDates?: string[]
  reviewFollowUpHref?: string
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

  // Controlled date input — starts at cadence suggestion, operator can change freely.
  // useState allows suggestion chips to fill the field via onClick without affecting form submission.
  const [nextScheduledDate, setNextScheduledDate] = useState(suggestedDate)

  const todayLocal = new Intl.DateTimeFormat('en-CA').format(new Date())
  // Past-date warning tracks the current controlled value, not just the initial cadence date.
  const suggestedIsPast = nextScheduledDate !== '' && nextScheduledDate < todayLocal

  // ── Suggestion chips ─────────────────────────────────────────────────────
  const chips: SuggestionChip[] = []

  // 1. Cadence chip — always shown when cadence date is known
  if (suggestedDate) {
    const cadenceNote =
      serviceFrequency === 'weekly'   ? '7-day cadence'  :
      serviceFrequency === 'biweekly' ? '14-day cadence' :
                                        'cadence'
    chips.push({
      date: suggestedDate,
      label: formatSuggestionDate(suggestedDate),
      note: cadenceNote,
      emoji: '📅',
    })
  }

  // 2. Preferred day chip — closest matching weekday within ±4 days of cadence date.
  // Searches both backward and forward; excludes dates before today (minDate).
  // If cadence date is already on the preferred weekday, no chip is shown.
  // If no valid candidate falls within the window, result === suggestedDate → no chip.
  if (preferredServiceDay && suggestedDate) {
    const prefDate = getClosestWeekdayNearDate(suggestedDate, preferredServiceDay, {
      minDate: todayLocal,
      maxDays: 4,
    })
    if (prefDate !== suggestedDate) {
      chips.push({
        date: prefDate,
        label: formatSuggestionDate(prefDate),
        note: 'Preferred day',
        emoji: '💡',
      })
    }
  }

  // 3. Lighter workload chip — forward-only scan (+1 to +6 days from cadence).
  // Only shown when the candidate has ≥2 fewer jobs than the cadence date.
  // Capped so total chips never exceed 3.
  if (suggestedDate && scheduledJobDates && scheduledJobDates.length > 0 && chips.length < 3) {
    const countByDate: Record<string, number> = {}
    for (const d of scheduledJobDates) {
      countByDate[d] = (countByDate[d] ?? 0) + 1
    }
    const cadenceCount = countByDate[suggestedDate] ?? 0
    for (let offset = 1; offset <= 6; offset++) {
      const candidate = addDays(suggestedDate, offset)
      if (chips.some(c => c.date === candidate)) continue
      const candidateCount = countByDate[candidate] ?? 0
      if (cadenceCount - candidateCount >= 2) {
        chips.push({
          date: candidate,
          label: formatSuggestionDate(candidate),
          note: `Lighter day (${candidateCount} job${candidateCount !== 1 ? 's' : ''})`,
          emoji: '⚡',
        })
        break
      }
    }
  }

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
              value={nextScheduledDate}
              onChange={e => setNextScheduledDate(e.target.value)}
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

        {/* Suggestion chips — optional; only rendered when at least one chip applies */}
        {chips.length > 0 && (
          <div className="form-field">
            <span className="form-label" style={{ marginBottom: '6px', display: 'block' }}>Suggestions</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {chips.map(chip => {
                const isActive = chip.date === nextScheduledDate
                return (
                  <button
                    key={chip.date}
                    type="button"
                    onClick={() => setNextScheduledDate(chip.date)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      border: isActive
                        ? '1.5px solid var(--color-primary, #4f8ef7)'
                        : '1.5px solid var(--border-color, #333)',
                      background: isActive
                        ? 'var(--color-primary-faint, rgba(79,142,247,0.12))'
                        : 'transparent',
                      color: isActive
                        ? 'var(--color-primary, #4f8ef7)'
                        : 'var(--text-muted, #888)',
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    <span>{chip.emoji}</span>
                    <span>{chip.label}</span>
                    <span style={{ opacity: 0.75 }}>&middot; {chip.note}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

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

      {reviewFollowUpHref && (
        <div style={{ marginTop: '8px' }}>
          <Link href={reviewFollowUpHref} className="btn btn-sm btn-secondary btn-full">
            Review &amp; Schedule Follow-up →
          </Link>
        </div>
      )}
    </div>
  )
}

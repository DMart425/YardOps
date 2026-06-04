'use client'

import { useActionState, useState } from 'react'
import type { FormState } from '@/types/database'
import { convertJobToRecurringService } from '@/app/(protected)/jobs/actions'
import { addDays, getClosestWeekdayNearDate } from '@/lib/date'
import { Toast } from '@/components/Toast'

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

interface ParsedJobInputsSummary {
  svcMowing: boolean
  svcWeedEating: boolean
  svcEdging: boolean
  svcBlowOff: boolean
}

export function ConvertToRecurringCard({
  jobId,
  jobPrice,
  jobInputs,
  scheduledDate,
  completedDate,
  preferredServiceDay,
  scheduledJobDates,
  currentFrequency,
}: {
  jobId: string
  jobPrice: number | null
  jobInputs: ParsedJobInputsSummary | null
  scheduledDate: string | null
  completedDate?: string | null
  preferredServiceDay?: string | null
  scheduledJobDates?: string[]
  currentFrequency?: string | null
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    convertJobToRecurringService.bind(null, jobId),
    { error: null }
  )
  const [frequency, setFrequency] = useState<'weekly' | 'biweekly'>('weekly')
  const [nextTimeWindow, setNextTimeWindow] = useState('')

  const anchorDate = completedDate ?? scheduledDate
  const suggestedDate = anchorDate
    ? (frequency === 'weekly' ? addDays(anchorDate, 7) : addDays(anchorDate, 14))
    : ''

  const [nextScheduledDate, setNextScheduledDate] = useState(suggestedDate)

  // Re-derive suggestion when frequency changes so the date input stays sensible
  const effectiveSuggested = anchorDate
    ? (frequency === 'weekly' ? addDays(anchorDate, 7) : addDays(anchorDate, 14))
    : ''

  const todayLocal = new Intl.DateTimeFormat('en-CA').format(new Date())
  const suggestedIsPast = nextScheduledDate !== '' && nextScheduledDate < todayLocal

  // Suggestion chips
  const chips: SuggestionChip[] = []

  if (effectiveSuggested) {
    chips.push({
      date: effectiveSuggested,
      label: formatSuggestionDate(effectiveSuggested),
      note: frequency === 'weekly' ? '7-day cadence' : '14-day cadence',
      emoji: '📅',
    })
  }

  if (preferredServiceDay && effectiveSuggested) {
    const prefDate = getClosestWeekdayNearDate(effectiveSuggested, preferredServiceDay, {
      minDate: todayLocal,
      maxDays: 4,
    })
    if (prefDate !== effectiveSuggested) {
      chips.push({
        date: prefDate,
        label: formatSuggestionDate(prefDate),
        note: 'Preferred day',
        emoji: '💡',
      })
    }
  }

  if (effectiveSuggested && scheduledJobDates && scheduledJobDates.length > 0 && chips.length < 3) {
    const countByDate: Record<string, number> = {}
    for (const d of scheduledJobDates) {
      countByDate[d] = (countByDate[d] ?? 0) + 1
    }
    const cadenceCount = countByDate[effectiveSuggested] ?? 0
    for (let offset = 1; offset <= 6; offset++) {
      const candidate = addDays(effectiveSuggested, offset)
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

  // Build scope/price notice lines
  const scopeLines: string[] = []
  if (jobInputs) {
    const services = [
      jobInputs.svcMowing     && 'Mowing',
      jobInputs.svcWeedEating && 'Weed eating',
      jobInputs.svcEdging     && 'Edging',
      jobInputs.svcBlowOff    && 'Blow off',
    ].filter(Boolean) as string[]
    scopeLines.push(`Scope: ${services.length > 0 ? services.join(', ') : 'None selected'}`)
  }
  if (jobPrice != null) {
    scopeLines.push(`Price: $${Number(jobPrice).toFixed(2)}`)
  }

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div className="section-heading" style={{ marginBottom: '0.5rem' }}>Convert to Recurring Service</div>
      <Toast message={state.success} />
      {state.error && <div className="alert alert-error">{state.error}</div>}

      {/* Scope/price affirmation */}
      {scopeLines.length > 0 ? (
        <p className="text-small text-muted" style={{ marginBottom: '0.5rem' }}>
          This will set the property&apos;s recurring defaults to: {scopeLines.join(' · ')}
        </p>
      ) : null}
      {!jobInputs && (
        <p className="text-small text-muted" style={{ marginBottom: '0.5rem' }}>
          No structured scope recorded — property service defaults will remain unchanged.
        </p>
      )}
      {jobPrice == null && (
        <p className="text-small text-muted" style={{ marginBottom: '0.5rem' }}>
          No price recorded — property default price will remain unchanged.
        </p>
      )}
      {currentFrequency && currentFrequency !== 'one_time' && (
        <p className="text-small text-muted" style={{ marginBottom: '0.5rem' }}>
          Property is currently set to {currentFrequency}. Selecting a frequency below will update it.
        </p>
      )}

      <form action={action} className="form">
        {/* Frequency */}
        <div className="form-field" style={{ marginBottom: '0.75rem' }}>
          <label className="form-label">Frequency *</label>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {(['weekly', 'biweekly'] as const).map(f => (
              <label key={f} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="frequency"
                  value={f}
                  checked={frequency === f}
                  onChange={() => {
                    setFrequency(f)
                    // Reset date to new cadence suggestion when frequency changes
                    const newSuggested = anchorDate
                      ? (f === 'weekly' ? addDays(anchorDate, 7) : addDays(anchorDate, 14))
                      : ''
                    setNextScheduledDate(newSuggested)
                  }}
                />
                <span className="text-small">{f === 'weekly' ? 'Weekly' : 'Bi-weekly'}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label className="form-label">First Recurring Visit Date *</label>
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
          {pending ? 'Converting...' : 'Convert to Recurring Service'}
        </button>
      </form>
    </div>
  )
}

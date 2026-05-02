'use client'

import { useState, useTransition } from 'react'
import { addBlackoutDate, removeBlackoutDate } from '@/app/(protected)/settings/actions'

interface Props {
  dates: string[]  // ISO date strings YYYY-MM-DD
}

export function BlackoutDatesForm({ dates }: Props) {
  const [current, setCurrent] = useState<string[]>(dates)
  const [newDate, setNewDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdd() {
    if (!newDate) return
    if (current.includes(newDate)) {
      setError('That date is already blocked off.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await addBlackoutDate(newDate)
      if (result.error) {
        setError(result.error)
      } else {
        setCurrent(prev => [...prev, newDate].sort())
        setNewDate('')
      }
    })
  }

  function handleRemove(date: string) {
    startTransition(async () => {
      const result = await removeBlackoutDate(date)
      if (!result.error) {
        setCurrent(prev => prev.filter(d => d !== date))
      }
    })
  }

  return (
    <div className="card" style={{ marginBottom: '1.25rem' }}>
      <div className="form-section-label" style={{ marginBottom: '0.5rem' }}>Blackout Dates</div>
      <p className="text-small text-muted" style={{ marginBottom: '1rem' }}>
        Days you&apos;re unavailable. These are highlighted in the jobs week view as a reminder.
      </p>

      {error && <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
        <input
          type="date"
          className="form-input"
          value={newDate}
          onChange={e => setNewDate(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleAdd}
          disabled={!newDate || isPending}
        >
          Block Day
        </button>
      </div>

      {current.length === 0 ? (
        <p className="text-small text-muted">No blackout dates set.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {current.map(d => {
            const label = new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            })
            return (
              <div key={d} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 10px', background: 'var(--color-surface)',
                border: '1px solid var(--color-border)', borderRadius: 'var(--r-sm)',
              }}>
                <span className="text-small">🚫 {label}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(d)}
                  disabled={isPending}
                  style={{
                    background: 'none', border: 'none', color: 'var(--color-danger, #dc2626)',
                    cursor: 'pointer', fontSize: '0.875rem', padding: '2px 6px',
                  }}
                >
                  Remove
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

'use client'

import { useActionState, useState } from 'react'
import { logService, addMaintenanceItem, deleteMaintenanceItem } from '../actions'
import { addDays, formatDateOnly } from '@/lib/date'

interface MaintenanceItem {
  id: string
  name: string
  interval_hours: number | null
  interval_days: number | null
  last_completed_at: string | null
  last_completed_hours: number | null
  next_due_hours: number | null
  next_due_date: string | null
  notes: string | null
}

interface Props {
  items: MaintenanceItem[]
  equipmentId: string
  currentHours: number
  localToday: string
}

function getStatus(item: MaintenanceItem, currentHours: number, localToday: string): 'overdue' | 'due-soon' | 'ok' | 'unknown' {
  if (item.next_due_hours != null) {
    if (currentHours >= item.next_due_hours) return 'overdue'
    if (currentHours >= item.next_due_hours - (item.interval_hours ?? 5) * 0.2) return 'due-soon'
    return 'ok'
  }
  if (item.next_due_date != null) {
    if (item.next_due_date < localToday) return 'overdue'
    if (item.next_due_date <= addDays(localToday, 7)) return 'due-soon'
    return 'ok'
  }
  if (!item.last_completed_at) return 'unknown'
  return 'ok'
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function LogServiceForm({ item, equipmentId, currentHours, onDone }: {
  item: MaintenanceItem, equipmentId: string, currentHours: number, onDone: () => void,
}) {
  const boundAction = logService.bind(null, item.id, equipmentId)
  const [, action, pending] = useActionState(async (_: unknown, fd: FormData) => {
    await boundAction(fd)
    onDone()
    return {}
  }, {})

  return (
    <form action={action} style={{ marginTop: '8px', padding: '12px', background: 'var(--color-bg)', borderRadius: 'var(--r-sm)', border: '1px solid var(--color-border)' }}>
      <div className="form-group" style={{ marginBottom: '8px' }}>
        <label className="form-label">Hours at service</label>
        <input name="completed_hours" type="number" min="0" step="0.1" defaultValue={currentHours} className="form-input" required />
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">{pending ? 'Saving…' : 'Log Service'}</button>
        <button type="button" onClick={onDone} className="btn btn-secondary btn-sm">Cancel</button>
      </div>
    </form>
  )
}

function AddItemForm({ equipmentId, onDone }: { equipmentId: string, onDone: () => void }) {
  const boundAction = addMaintenanceItem.bind(null, equipmentId)
  const [, action, pending] = useActionState(async (_: unknown, fd: FormData) => {
    await boundAction(fd)
    onDone()
    return {}
  }, {})

  return (
    <form action={action} style={{ marginTop: '12px', padding: '14px', background: 'var(--color-bg)', borderRadius: 'var(--r-sm)', border: '1px solid var(--color-border)' }}>
      <div className="form-group">
        <label className="form-label">Task name *</label>
        <input name="name" className="form-input" placeholder="e.g. Oil change" required />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="form-group">
          <label className="form-label">Every N hours</label>
          <input name="interval_hours" type="number" min="1" step="1" className="form-input" placeholder="e.g. 25" />
        </div>
        <div className="form-group">
          <label className="form-label">Every N days</label>
          <input name="interval_days" type="number" min="1" step="1" className="form-input" placeholder="e.g. 90" />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Notes</label>
        <input name="notes" className="form-input" placeholder="Optional" />
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">{pending ? 'Saving…' : 'Add Item'}</button>
        <button type="button" onClick={onDone} className="btn btn-secondary btn-sm">Cancel</button>
      </div>
    </form>
  )
}

export default function MaintenanceSchedule({ items, equipmentId, currentHours, localToday }: Props) {
  const [logginItemId, setLoggingItemId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const STATUS_COLORS: Record<string, string> = {
    overdue: 'var(--color-danger, #dc2626)',
    'due-soon': 'var(--color-warning, #d97706)',
    ok: 'var(--color-primary)',
    unknown: 'var(--color-muted, #6b7280)',
  }
  const STATUS_LABELS: Record<string, string> = {
    overdue: '⚠ Overdue', 'due-soon': '⏰ Due soon', ok: '✓ OK', unknown: '— Not logged',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div className="section-heading" style={{ margin: 0 }}>Maintenance Schedule</div>
        <button type="button" onClick={() => setShowAddForm(v => !v)} className="btn btn-sm btn-secondary">
          {showAddForm ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {showAddForm && <AddItemForm equipmentId={equipmentId} onDone={() => setShowAddForm(false)} />}

      {items.length === 0 && !showAddForm && (
        <p className="text-small text-muted">No maintenance items yet. Add oil changes, blade sharpening, etc.</p>
      )}

      {items.map(item => {
        const status = getStatus(item, currentHours, localToday)
        return (
          <div key={item.id} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--r-sm)', marginBottom: '8px' }}>
            <div className="card-row" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{item.name}</div>
                <div className="text-small text-muted" style={{ marginTop: '2px' }}>
                  {item.interval_hours && `Every ${item.interval_hours} hrs`}
                  {item.interval_hours && item.interval_days && ' · '}
                  {item.interval_days && `Every ${item.interval_days} days`}
                </div>
                {item.last_completed_at && (
                  <div className="text-small text-muted">
                    Last done: {fmtDate(item.last_completed_at)}
                    {item.last_completed_hours != null && ` @ ${item.last_completed_hours} hrs`}
                  </div>
                )}
                {item.next_due_hours != null && (
                  <div className="text-small text-muted">Next due: {item.next_due_hours} hrs</div>
                )}
                {item.next_due_date && (
                  <div className="text-small text-muted">Next due: {formatDateOnly(item.next_due_date, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: STATUS_COLORS[status] }}>
                  {STATUS_LABELS[status]}
                </span>
                <button
                  type="button"
                  onClick={() => setLoggingItemId(logginItemId === item.id ? null : item.id)}
                  className="btn btn-sm btn-primary"
                >
                  Log Service
                </button>
                <form action={deleteMaintenanceItem.bind(null, item.id, equipmentId)}>
                  <button type="submit" className="btn btn-sm btn-secondary" style={{ color: 'var(--color-danger, #dc2626)' }}>Remove</button>
                </form>
              </div>
            </div>
            {logginItemId === item.id && (
              <LogServiceForm item={item} equipmentId={equipmentId} currentHours={currentHours} onDone={() => setLoggingItemId(null)} />
            )}
          </div>
        )
      })}
    </div>
  )
}

import Link from 'next/link'
import { snoozeCustomerAlert } from '../actions'

export function RecurringGapAlert({ customers }: { customers: { id: string; name: string }[] }) {
  if (customers.length === 0) return null
  return (
    <div className="card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--color-warning, #f59e0b)', background: 'rgba(245,158,11,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>🔁</span>
        <div>
          <div className="font-bold" style={{ marginBottom: '4px' }}>Recurring customers with no upcoming job</div>
          <div className="text-small text-muted" style={{ marginBottom: '6px' }}>No job scheduled in the next 14 days:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {customers.map(c => (
              <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                <Link href={`/customers/${c.id}`} className="pill pill-lead" style={{ textDecoration: 'none' }}>{c.name}</Link>
                <form action={snoozeCustomerAlert.bind(null, c.id, 'recurring_gap')} style={{ display: 'inline-flex' }}>
                  <button
                    type="submit"
                    className="pill"
                    title="Snooze for 7 days"
                    aria-label={`Snooze ${c.name} for 7 days`}
                    style={{ cursor: 'pointer', border: '1px solid var(--color-border, #333)', background: 'transparent', color: 'var(--color-text-muted)' }}
                  >
                    ✕
                  </button>
                </form>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function DormantCustomersAlert({ customers }: { customers: { id: string; name: string; daysSince: number }[] }) {
  if (customers.length === 0) return null
  return (
    <div className="card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--color-unpaid, #f97316)', background: 'rgba(249,115,22,0.07)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>💤</span>
        <div>
          <div className="font-bold" style={{ marginBottom: '4px' }}>Customers you haven&apos;t visited recently</div>
          <div className="text-small text-muted" style={{ marginBottom: '6px' }}>No completed job in 60+ days:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {customers.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <Link href={`/customers/${c.id}`} style={{ display: 'flex', flex: 1, minWidth: 0, justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none' }}>
                  <span className="text-small">{c.name}</span>
                  <span className="pill pill-overdue" style={{ fontSize: '0.7rem' }}>{c.daysSince}d ago</span>
                </Link>
                <form action={snoozeCustomerAlert.bind(null, c.id, 'dormant')} style={{ display: 'inline-flex', flexShrink: 0 }}>
                  <button
                    type="submit"
                    className="pill"
                    title="Snooze for 7 days"
                    aria-label={`Snooze ${c.name} for 7 days`}
                    style={{ cursor: 'pointer', border: '1px solid var(--color-border, #333)', background: 'transparent', color: 'var(--color-text-muted)' }}
                  >
                    ✕
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

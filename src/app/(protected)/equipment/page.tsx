import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { addDays, getLocalDateStr, resolveTimeZone } from '@/lib/date'
import { requireBusinessContext } from '@/lib/business/context'

const TYPE_LABELS: Record<string, string> = {
  mower: 'Mower', trimmer: 'Trimmer', blower: 'Blower',
  edger: 'Edger', trailer: 'Trailer', truck: 'Truck', other: 'Other',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface MaintItem {
  last_completed_at: string | null
  last_completed_hours: number | null
  next_due_hours: number | null
  next_due_date: string | null
}

function serviceInfo(items: MaintItem[], currentHours: number) {
  // Last service: most recent completed_at across all items
  const lastItem = [...items]
    .filter(i => i.last_completed_at != null)
    .sort((a, b) => new Date(b.last_completed_at!).getTime() - new Date(a.last_completed_at!).getTime())[0]

  // Next service: soonest next_due_hours or next_due_date
  const nextByHours = items
    .filter(i => i.next_due_hours != null)
    .sort((a, b) => (a.next_due_hours ?? Infinity) - (b.next_due_hours ?? Infinity))[0]
  const nextByDate = items
    .filter(i => i.next_due_date != null)
    .sort((a, b) => (a.next_due_date ?? '').localeCompare(b.next_due_date ?? ''))[0]

  const overdueHours = nextByHours != null && currentHours >= (nextByHours.next_due_hours ?? Infinity)

  return { lastItem, nextByHours, nextByDate, overdueHours }
}

export default async function EquipmentPage() {
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('time_zone')
    .eq('user_id', userId)
    .maybeSingle()
  const localToday = getLocalDateStr(resolveTimeZone(settings?.time_zone))
  const dueSoonDate = addDays(localToday, 7)

  const { data: equipment } = await supabase
    .from('equipment')
    .select('*, maintenance_items(last_completed_at, last_completed_hours, next_due_hours, next_due_date)')
    .eq('business_id', businessId)
    .order('status')
    .order('name')

  const active = equipment?.filter(e => e.status === 'active') ?? []
  const inactive = equipment?.filter(e => e.status !== 'active') ?? []

  function EquipCard({ eq, dimmed }: { eq: typeof equipment extends (infer T)[] | null ? T : never, dimmed?: boolean }) {
    const items: MaintItem[] = eq.maintenance_items ?? []
    const { lastItem, nextByHours, nextByDate, overdueHours } = serviceInfo(items, eq.current_hours ?? 0)
    const overdueDate = nextByDate != null && (nextByDate.next_due_date ?? '') < localToday
    const isOverdue = overdueHours || overdueDate
    const isSoon = !isOverdue && (
      (nextByHours != null && (eq.current_hours ?? 0) >= (nextByHours.next_due_hours ?? Infinity) - ((nextByHours.next_due_hours ?? 0) * 0.1)) ||
      (nextByDate != null && (nextByDate.next_due_date ?? '') <= dueSoonDate)
    )

    return (
      <Link href={'/equipment/' + eq.id} className="card card-link" style={{ marginBottom: '8px', display: 'block', opacity: dimmed ? 0.7 : 1 }}>
        {/* Top row: name + status */}
        <div className="card-row" style={{ marginBottom: '4px' }}>
          <div className="card-title" style={{ margin: 0 }}>{eq.name}</div>
          <span className={'pill pill-' + eq.status}>{eq.status}</span>
        </div>

        {/* Make / model / type */}
        <div className="text-small text-muted">
          {[TYPE_LABELS[eq.equipment_type] ?? eq.equipment_type, eq.make, eq.model].filter(Boolean).join(' · ')}
        </div>

        {/* Serial + hours */}
        <div className="text-small text-muted" style={{ marginTop: '2px' }}>
          {eq.serial_number && <span>S/N: {eq.serial_number}</span>}
          {eq.serial_number && eq.current_hours > 0 && <span> · </span>}
          {eq.current_hours > 0 && <span>{eq.current_hours} hrs</span>}
        </div>

        {/* Service summary */}
        {(lastItem || nextByHours || nextByDate) && (
          <div style={{ marginTop: '6px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {lastItem && (
              <div className="text-small text-muted">
                <span style={{ fontWeight: 600 }}>Last:</span>{' '}
                {lastItem.last_completed_at ? fmtDate(lastItem.last_completed_at) : '—'}
                {lastItem.last_completed_hours != null && ` @ ${lastItem.last_completed_hours} hrs`}
              </div>
            )}
            {(nextByHours || nextByDate) && (
              <div className="text-small" style={{ fontWeight: 600, color: isOverdue ? 'var(--color-danger, #dc2626)' : isSoon ? 'var(--color-warning, #d97706)' : 'var(--color-primary)' }}>
                {isOverdue ? '⚠ ' : isSoon ? '⏰ ' : '✓ '}
                Next:{' '}
                {nextByHours ? `${nextByHours.next_due_hours} hrs` : ''}
                {nextByHours && nextByDate ? ' / ' : ''}
                {nextByDate ? fmtDate(nextByDate.next_due_date!) : ''}
              </div>
            )}
          </div>
        )}
      </Link>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Equipment</h1>
        <Link href="/equipment/new" className="btn btn-header btn-sm">+ Add</Link>
      </div>

      {!equipment?.length ? (
        <div className="empty-state">
          <p style={{ fontSize: '2rem' }}>🔧</p>
          <p>No equipment yet</p>
          <Link href="/equipment/new" className="btn btn-primary">Add Equipment</Link>
        </div>
      ) : (
        <>
          {active.map(eq => <EquipCard key={eq.id} eq={eq} />)}

          {inactive.length > 0 && (
            <>
              <div className="section-heading" style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Inactive / Retired</div>
              {inactive.map(eq => <EquipCard key={eq.id} eq={eq} dimmed />)}
            </>
          )}
        </>
      )}
    </div>
  )
}

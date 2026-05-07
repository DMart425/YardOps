import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { updateEquipment } from '../actions'
import MaintenanceSchedule from './MaintenanceSchedule'
import SavedToast from './SavedToast'
import { getLocalDateStr, resolveTimeZone } from '@/lib/date'

const TYPE_LABELS: Record<string, string> = {
  mower: 'Mower', trimmer: 'Trimmer', blower: 'Blower',
  edger: 'Edger', trailer: 'Trailer', truck: 'Truck', other: 'Other',
}

const STATUS_OPTIONS = ['active', 'inactive', 'retired']

export default async function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('time_zone')
    .eq('user_id', user.id)
    .maybeSingle()
  const localToday = getLocalDateStr(resolveTimeZone(settings?.time_zone))

  const [{ data: equipment }, { data: items }] = await Promise.all([
    supabase.from('equipment').select('*').eq('id', id).single(),
    supabase.from('maintenance_items').select('*').eq('equipment_id', id).order('name'),
  ])

  if (!equipment) notFound()

  const updateAction = updateEquipment.bind(null, id)

  return (
    <div className="page">
      <SavedToast />
      <Link href="/equipment" className="back-link">← Equipment</Link>

      <div className="page-header">
        <h1 className="page-title">{equipment.name}</h1>
        <span className={'pill pill-' + equipment.status}>{equipment.status}</span>
      </div>

      {/* Info card */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="section-heading" style={{ marginBottom: '0.75rem' }}>Equipment Info</div>
        <form action={updateAction}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input name="name" defaultValue={equipment.name} className="form-input" required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select name="equipment_type" defaultValue={equipment.equipment_type ?? ''} className="form-input">
                <option value="">— Select —</option>
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select name="status" defaultValue={equipment.status} className="form-input">
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Make</label>
              <input name="make" defaultValue={equipment.make ?? ''} className="form-input" placeholder="Optional" />
            </div>
            <div className="form-group">
              <label className="form-label">Model</label>
              <input name="model" defaultValue={equipment.model ?? ''} className="form-input" placeholder="Optional" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Serial Number</label>
              <input name="serial_number" defaultValue={equipment.serial_number ?? ''} className="form-input" placeholder="Optional" />
            </div>
            <div className="form-group">
              <label className="form-label">Current Hours</label>
              <input name="current_hours" type="number" min="0" step="0.1" defaultValue={equipment.current_hours ?? 0} className="form-input" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea name="notes" defaultValue={equipment.notes ?? ''} className="form-input" rows={3} />
          </div>

          <button type="submit" className="btn btn-primary">Save Changes</button>
        </form>
      </div>

      {/* Maintenance schedule */}
      <div className="card">
        <MaintenanceSchedule
          items={items ?? []}
          equipmentId={id}
          currentHours={equipment.current_hours ?? 0}
          localToday={localToday}
        />
      </div>
    </div>
  )
}

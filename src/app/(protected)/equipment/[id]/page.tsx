import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { updateEquipment } from '../actions'
import MaintenanceSchedule from './MaintenanceSchedule'
import SavedToast from './SavedToast'
import { DeleteEquipmentButton } from './DeleteEquipmentButton'
import { getLocalDateStr, resolveTimeZone } from '@/lib/date'
import { requireBusinessContext } from '@/lib/business/context'

const TYPE_LABELS: Record<string, string> = {
  mower: 'Mower', trimmer: 'Trimmer', blower: 'Blower',
  edger: 'Edger', trailer: 'Trailer', truck: 'Truck', other: 'Other',
}

const STATUS_OPTIONS = ['active', 'inactive', 'retired']

export default async function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('time_zone')
    .eq('user_id', userId)
    .maybeSingle()
  const localToday = getLocalDateStr(resolveTimeZone(settings?.time_zone))

  const [{ data: equipment }, { data: items }] = await Promise.all([
    supabase.from('equipment').select('*').eq('id', id).eq('business_id', businessId).single(),
    supabase.from('maintenance_items').select('*').eq('equipment_id', id).eq('business_id', businessId).order('name'),
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

      {/* Danger zone */}
      <div className="card" style={{ marginTop: '1.25rem', borderColor: 'var(--color-danger)' }}>
        <div className="section-heading" style={{ marginBottom: '0.5rem', color: 'var(--color-danger)' }}>
          Danger Zone
        </div>
        <p className="text-small text-muted" style={{ marginBottom: '0.75rem' }}>
          Removing this equipment will also permanently delete all linked maintenance records.
        </p>
        <DeleteEquipmentButton equipmentId={id} equipmentName={equipment.name} />
      </div>
    </div>
  )
}

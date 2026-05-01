import Link from 'next/link'
import { createEquipment } from '../actions'

const EQUIPMENT_TYPES = ['mower', 'trimmer', 'blower', 'edger', 'trailer', 'truck', 'other']

export default function NewEquipmentPage() {
  return (
    <div className="page">
      <Link href="/equipment" className="back-link">← Equipment</Link>
      <div className="page-header">
        <h1 className="page-title">Add Equipment</h1>
      </div>

      <div className="card">
        <form action={createEquipment}>
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input name="name" className="form-input" placeholder="e.g. Husqvarna 42&quot; Mower" required />
          </div>

          <div className="form-group">
            <label className="form-label">Type</label>
            <select name="equipment_type" className="form-input">
              <option value="">— Select type —</option>
              {EQUIPMENT_TYPES.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Make</label>
              <input name="make" className="form-input" placeholder="e.g. Husqvarna" />
            </div>
            <div className="form-group">
              <label className="form-label">Model</label>
              <input name="model" className="form-input" placeholder="e.g. YTH18542" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Serial Number</label>
            <input name="serial_number" className="form-input" placeholder="Optional" />
          </div>

          <div className="form-group">
            <label className="form-label">Current Hours</label>
            <input name="current_hours" type="number" min="0" step="0.1" defaultValue="0" className="form-input" />
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea name="notes" className="form-input" rows={3} placeholder="Any notes about this equipment..." />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary">Add Equipment</button>
            <Link href="/equipment" className="btn btn-secondary">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  )
}

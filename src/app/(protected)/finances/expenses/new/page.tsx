import Link from 'next/link'
import { createExpense } from '../../actions'

const today = new Date().toISOString().split('T')[0]

const CATEGORIES = [
  { value: 'fuel',      label: 'Fuel' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'supplies',  label: 'Supplies' },
  { value: 'repairs',   label: 'Repairs' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'labor',     label: 'Labor' },
  { value: 'other',     label: 'Other' },
]

export default function NewExpensePage() {
  return (
    <div className="page">
      <Link href="/finances" className="back-link">← Finances</Link>
      <div className="page-header">
        <h1 className="page-title">Add Expense</h1>
      </div>

      <div className="card">
        <form action={createExpense}>
          <div className="form-group">
            <label className="form-label">Category *</label>
            <select name="category" className="form-input" required>
              <option value="">— Select —</option>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Vendor</label>
              <input name="vendor" className="form-input" placeholder="e.g. Shell, Home Depot" />
            </div>
            <div className="form-group">
              <label className="form-label">Amount *</label>
              <input name="amount" type="number" min="0" step="0.01" className="form-input" placeholder="0.00" required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <input name="description" className="form-input" placeholder="Brief description" />
          </div>

          <div className="form-group">
            <label className="form-label">Date *</label>
            <input name="purchased_at" type="date" defaultValue={today} className="form-input" required />
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea name="notes" className="form-input" rows={2} placeholder="Optional" />
          </div>

          <div className="form-group">
            <label className="form-label">Receipt (optional)</label>
            <input name="receipt" type="file" accept="image/*,.pdf" className="form-input" />
            <div className="text-small text-muted" style={{ marginTop: '4px' }}>JPG, PNG, or PDF</div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary">Save Expense</button>
            <Link href="/finances" className="btn btn-secondary">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  )
}

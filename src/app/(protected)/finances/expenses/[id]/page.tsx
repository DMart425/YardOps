import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { updateExpense, deleteExpense } from '../../actions'

const CATEGORIES = [
  { value: 'fuel',      label: 'Fuel' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'supplies',  label: 'Supplies' },
  { value: 'repairs',   label: 'Repairs' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'labor',     label: 'Labor' },
  { value: 'other',     label: 'Other' },
]

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: expense } = await supabase.from('expenses').select('*').eq('id', id).single()
  if (!expense) notFound()

  // Recent jobs for the picker
  const since = new Date()
  since.setDate(since.getDate() - 90)
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, scheduled_date, customers(first_name, last_name), properties(service_address)')
    .gte('scheduled_date', since.toISOString().split('T')[0])
    .order('scheduled_date', { ascending: false })
    .limit(50)

  const updateAction = updateExpense.bind(null, id)
  const deleteAction = deleteExpense.bind(null, id)

  return (
    <div className="page">
      <Link href="/finances" className="back-link">← Finances</Link>
      <div className="page-header">
        <h1 className="page-title">Edit Expense</h1>
      </div>

      {expense.receipt_url && (
        <div className="card" style={{ marginBottom: '1.25rem', textAlign: 'center' }}>
          <div className="section-heading" style={{ marginBottom: '0.75rem' }}>Receipt</div>
          {expense.receipt_url.match(/\.pdf(\?|$)/i) ? (
            <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              View PDF Receipt
            </a>
          ) : (
            <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={expense.receipt_url}
                alt="Receipt"
                style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: 'var(--r-sm)', border: '1px solid var(--color-border)' }}
              />
            </a>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.25rem' }}>
          <form action={updateAction}>
          <div className="form-group">
            <label className="form-label">Category *</label>
            <select name="category" defaultValue={expense.category} className="form-input" required>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Vendor</label>
              <input name="vendor" defaultValue={expense.vendor ?? ''} className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">Amount *</label>
              <input name="amount" type="number" min="0" step="0.01" defaultValue={expense.amount} className="form-input" required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <input name="description" defaultValue={expense.description ?? ''} className="form-input" />
          </div>

          <div className="form-group">
            <label className="form-label">Date *</label>
            <input name="purchased_at" type="date" defaultValue={expense.purchased_at} className="form-input" required />
          </div>

          <div className="form-group">
            <label className="form-label">Tag to job (optional)</label>
            <select name="job_id" className="form-input" defaultValue={expense.job_id ?? ''}>
              <option value="">— None (general overhead) —</option>
              {(jobs ?? []).map((j) => {
                const c = (Array.isArray(j.customers) ? j.customers[0] : j.customers) as { first_name: string; last_name: string | null } | null
                const p = (Array.isArray(j.properties) ? j.properties[0] : j.properties) as { service_address: string } | null
                const name = c ? `${c.first_name}${c.last_name ? ' ' + c.last_name : ''}` : '—'
                const addr = p?.service_address ?? ''
                return <option key={j.id} value={j.id}>{j.scheduled_date} · {name} · {addr}</option>
              })}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea name="notes" defaultValue={expense.notes ?? ''} className="form-input" rows={2} />
          </div>

          <div className="form-group">
            <label className="form-label">Replace Receipt</label>
            <input name="receipt" type="file" accept="image/*,.pdf" className="form-input" />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary">Save Changes</button>
            <Link href="/finances" className="btn btn-secondary">Cancel</Link>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="section-heading" style={{ color: 'var(--color-danger, #dc2626)', marginBottom: '0.75rem' }}>Delete Expense</div>
        <form action={deleteAction}>
          <button type="submit" className="btn btn-secondary" style={{ color: 'var(--color-danger, #dc2626)', borderColor: 'var(--color-danger, #dc2626)' }}>
            Delete This Expense
          </button>
        </form>
      </div>
    </div>
  )
}

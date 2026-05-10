import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createExpense } from '../../actions'
import { getLocalDateStr, resolveTimeZone } from '@/lib/date'
import { requireBusinessContext } from '@/lib/business/context'

const CATEGORIES = [
  { value: 'fuel',      label: 'Fuel' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'supplies',  label: 'Supplies' },
  { value: 'repairs',   label: 'Repairs' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'labor',     label: 'Labor' },
  { value: 'other',     label: 'Other' },
]

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ job_id?: string }>
}) {
  const { job_id: presetJobId } = await searchParams
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('time_zone')
    .eq('user_id', userId)
    .maybeSingle()
  const today = getLocalDateStr(resolveTimeZone(settings?.time_zone))

  // Recent jobs (last 90 days) for the picker
  const since = new Date()
  since.setDate(since.getDate() - 90)
  const sinceStr = since.toISOString().split('T')[0]

  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, scheduled_date, customers(first_name, last_name), properties(service_address)')
    .eq('business_id', businessId)
    .gte('scheduled_date', sinceStr)
    .order('scheduled_date', { ascending: false })
    .limit(50)

  return (
    <div className="page">
      <Link href={presetJobId ? `/jobs/${presetJobId}` : '/finances'} className="back-link">
        ← {presetJobId ? 'Job' : 'Finances'}
      </Link>
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
            <label className="form-label">Tag to job (optional)</label>
            <select name="job_id" className="form-input" defaultValue={presetJobId ?? ''}>
              <option value="">— None (general overhead) —</option>
              {(jobs ?? []).map((j) => {
                const c = (Array.isArray(j.customers) ? j.customers[0] : j.customers) as { first_name: string; last_name: string | null } | null
                const p = (Array.isArray(j.properties) ? j.properties[0] : j.properties) as { service_address: string } | null
                const name = c ? `${c.first_name}${c.last_name ? ' ' + c.last_name : ''}` : '—'
                const addr = p?.service_address ?? ''
                const date = j.scheduled_date ?? ''
                return <option key={j.id} value={j.id}>{date} · {name} · {addr}</option>
              })}
            </select>
            <div className="text-small text-muted" style={{ marginTop: '4px' }}>
              Tag to a job for items bought specifically for it (e.g. weed &amp; feed, parts).
              Leave blank for general overhead (fuel, monthly supplies).
            </div>
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
            <Link href={presetJobId ? `/jobs/${presetJobId}` : '/finances'} className="btn btn-secondary">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  )
}

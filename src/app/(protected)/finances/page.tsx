import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import FinancesExportButton from './FinancesExportButton'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const CATEGORY_LABELS: Record<string, string> = {
  fuel: 'Fuel', equipment: 'Equipment', supplies: 'Supplies',
  repairs: 'Repairs', insurance: 'Insurance', labor: 'Labor', other: 'Other',
}

function fmt$(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default async function FinancesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const sp = await searchParams
  const now = new Date()
  const year = Number(sp.year ?? now.getFullYear())
  const selectedMonth = sp.month ? Number(sp.month) - 1 : now.getMonth() // 0-indexed

  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const supabase = await createClient()

  // Fetch paid/partial jobs for the year with customer info
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, amount_paid, price, payment_status, completed_at, customers(id, full_name)')
    .in('payment_status', ['paid', 'partial'])
    .gte('completed_at', yearStart + 'T00:00:00Z')
    .lte('completed_at', yearEnd + 'T23:59:59Z')
    .order('completed_at')

  // Fetch expenses for the year
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .gte('purchased_at', yearStart)
    .lte('purchased_at', yearEnd)
    .order('purchased_at')

  // ── Aggregate YTD ──────────────────────────────────────────────
  const totalIncome = (jobs ?? []).reduce((s, j) => s + Number(j.amount_paid ?? j.price ?? 0), 0)
  const totalExpenses = (expenses ?? []).reduce((s, e) => s + Number(e.amount ?? 0), 0)

  // ── Monthly breakdown ──────────────────────────────────────────
  const incomeByMonth = Array(12).fill(0) as number[]
  const expensesByMonth = Array(12).fill(0) as number[]

  for (const j of jobs ?? []) {
    const m = new Date(j.completed_at).getMonth()
    incomeByMonth[m] += Number(j.amount_paid ?? j.price ?? 0)
  }
  for (const e of expenses ?? []) {
    const m = new Date(e.purchased_at).getMonth()
    expensesByMonth[m] += Number(e.amount ?? 0)
  }

  // ── Selected month data ────────────────────────────────────────
  const monthJobs = (jobs ?? []).filter(j => new Date(j.completed_at).getMonth() === selectedMonth)
  const monthExpenses = (expenses ?? []).filter(e => new Date(e.purchased_at).getMonth() === selectedMonth)
  const monthIncome = monthJobs.reduce((s, j) => s + Number(j.amount_paid ?? j.price ?? 0), 0)
  const monthExpenseTotal = monthExpenses.reduce((s, e) => s + Number(e.amount ?? 0), 0)

  // ── Per-customer income (selected month) ──────────────────────
  const customerTotals = new Map<string, { name: string; count: number; total: number }>()
  for (const j of monthJobs) {
    const raw = j.customers
    const c = (Array.isArray(raw) ? raw[0] : raw) as { id: string; full_name: string } | null
    if (!c) continue
    const cur = customerTotals.get(c.id) ?? { name: c.full_name ?? 'Unknown', count: 0, total: 0 }
    cur.count++
    cur.total += Number(j.amount_paid ?? j.price ?? 0)
    customerTotals.set(c.id, cur)
  }
  const customerRows = [...customerTotals.values()].sort((a, b) => b.total - a.total)

  // ── Expenses by category (selected month) ─────────────────────
  const categoryTotals = new Map<string, number>()
  for (const e of monthExpenses) {
    categoryTotals.set(e.category, (categoryTotals.get(e.category) ?? 0) + Number(e.amount))
  }

  // ── CSV data ──────────────────────────────────────────────────
  type CsvRow = { date: string; type: 'income'|'expense'; customer_or_vendor: string; description: string; category: string; amount: number }
  function makeRows(jList: typeof jobs, eList: typeof expenses): CsvRow[] {
    const rows: CsvRow[] = []
    for (const j of jList ?? []) {
      const rawC = j.customers
      const c = (Array.isArray(rawC) ? rawC[0] : rawC) as { full_name?: string } | null
      rows.push({
        date: j.completed_at?.split('T')[0] ?? '',
        type: 'income',
        customer_or_vendor: c?.full_name ?? '',
        description: 'Lawn service',
        category: 'service',
        amount: Number(j.amount_paid ?? j.price ?? 0),
      })
    }
    for (const e of eList ?? []) {
      rows.push({
        date: e.purchased_at,
        type: 'expense',
        customer_or_vendor: e.vendor ?? '',
        description: e.description ?? '',
        category: e.category,
        amount: Number(e.amount),
      })
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date))
  }

  const yearCsvRows = makeRows(jobs, expenses)
  const monthCsvRows = makeRows(monthJobs, monthExpenses)

  const monthStr = String(selectedMonth + 1).padStart(2, '0')

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Finances</h1>
        <Link href="/finances/expenses/new" className="btn btn-header">+ Add Expense</Link>
      </div>

      {/* Year selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', alignItems: 'center' }}>
        <Link href={`/finances?year=${year - 1}&month=${monthStr}`} className="btn btn-secondary btn-sm">← {year - 1}</Link>
        <span style={{ fontWeight: 700, fontSize: '1.0625rem' }}>{year}</span>
        <Link href={`/finances?year=${year + 1}&month=${monthStr}`} className="btn btn-secondary btn-sm">{year + 1} →</Link>
      </div>

      {/* YTD strip */}
      <div className="card" style={{ marginBottom: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
        <div>
          <div className="text-small text-muted">YTD Income</div>
          <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '1.125rem' }}>{fmt$(totalIncome)}</div>
        </div>
        <div>
          <div className="text-small text-muted">YTD Expenses</div>
          <div style={{ fontWeight: 700, color: 'var(--color-danger, #dc2626)', fontSize: '1.125rem' }}>{fmt$(totalExpenses)}</div>
        </div>
        <div>
          <div className="text-small text-muted">YTD Net</div>
          <div style={{ fontWeight: 700, color: totalIncome - totalExpenses >= 0 ? 'var(--color-primary)' : 'var(--color-danger, #dc2626)', fontSize: '1.125rem' }}>
            {fmt$(totalIncome - totalExpenses)}
          </div>
        </div>
      </div>

      {/* Month selector */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {MONTHS.map((m, i) => {
          const isSelected = i === selectedMonth
          const mPad = String(i + 1).padStart(2, '0')
          const net = incomeByMonth[i] - expensesByMonth[i]
          return (
            <Link
              key={i}
              href={`/finances?year=${year}&month=${mPad}`}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--r-sm)',
                fontSize: '0.75rem',
                fontWeight: isSelected ? 700 : 400,
                background: isSelected ? 'var(--color-primary)' : 'var(--color-surface)',
                color: isSelected ? '#fff' : 'var(--color-text)',
                border: '1px solid',
                borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              <div>{m}</div>
              {incomeByMonth[i] > 0 || expensesByMonth[i] > 0 ? (
                <div style={{ fontSize: '0.65rem', color: isSelected ? 'rgba(255,255,255,0.8)' : net >= 0 ? 'var(--color-primary)' : 'var(--color-danger, #dc2626)' }}>
                  {fmt$(net)}
                </div>
              ) : null}
            </Link>
          )
        })}
      </div>

      {/* Selected month stats */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="section-heading" style={{ marginBottom: '0.75rem' }}>
          {MONTHS[selectedMonth]} {year}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center', marginBottom: '1rem' }}>
          <div>
            <div className="text-small text-muted">Income</div>
            <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{fmt$(monthIncome)}</div>
          </div>
          <div>
            <div className="text-small text-muted">Expenses</div>
            <div style={{ fontWeight: 700, color: 'var(--color-danger, #dc2626)' }}>{fmt$(monthExpenseTotal)}</div>
          </div>
          <div>
            <div className="text-small text-muted">Net</div>
            <div style={{ fontWeight: 700, color: monthIncome - monthExpenseTotal >= 0 ? 'var(--color-primary)' : 'var(--color-danger, #dc2626)' }}>
              {fmt$(monthIncome - monthExpenseTotal)}
            </div>
          </div>
        </div>

        {/* Per-customer income */}
        {customerRows.length > 0 && (
          <>
            <div className="divider" />
            <div className="section-heading" style={{ fontSize: '0.8125rem', marginBottom: '0.5rem' }}>Income by Customer</div>
            {customerRows.map(row => (
              <div key={row.name} className="card-row" style={{ marginBottom: '4px' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{row.name}</div>
                  <div className="text-small text-muted">{row.count} job{row.count !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{fmt$(row.total)}</div>
              </div>
            ))}
          </>
        )}

        {/* Expenses by category */}
        {categoryTotals.size > 0 && (
          <>
            <div className="divider" />
            <div className="section-heading" style={{ fontSize: '0.8125rem', marginBottom: '0.5rem' }}>Expenses by Category</div>
            {[...categoryTotals.entries()].sort((a, b) => b[1] - a[1]).map(([cat, total]) => (
              <div key={cat} className="card-row" style={{ marginBottom: '4px' }}>
                <span style={{ fontSize: '0.875rem' }}>{CATEGORY_LABELS[cat] ?? cat}</span>
                <span style={{ fontWeight: 700, color: 'var(--color-danger, #dc2626)' }}>{fmt$(total)}</span>
              </div>
            ))}
          </>
        )}

        {/* Recent expenses */}
        {monthExpenses.length > 0 && (
          <>
            <div className="divider" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div className="section-heading" style={{ fontSize: '0.8125rem', margin: 0 }}>Expenses</div>
            </div>
            {[...monthExpenses].reverse().slice(0, 15).map(e => (
              <Link key={e.id} href={'/finances/expenses/' + e.id} style={{ display: 'block', textDecoration: 'none' }}>
                <div className="card-row" style={{ padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                      {e.vendor ? e.vendor : CATEGORY_LABELS[e.category] ?? e.category}
                      <span className="text-small text-muted" style={{ marginLeft: '6px' }}>{e.purchased_at}</span>
                    </div>
                    {e.description && <div className="text-small text-muted">{e.description}</div>}
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--color-danger, #dc2626)' }}>{fmt$(e.amount)}</span>
                </div>
              </Link>
            ))}
          </>
        )}

        {monthExpenses.length === 0 && monthJobs.length === 0 && (
          <p className="text-small text-muted" style={{ marginTop: '8px' }}>No activity this month.</p>
        )}
      </div>

      {/* Export buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <FinancesExportButton
          rows={yearCsvRows}
          label={`Export ${year} CSV`}
          filename={`finances-${year}.csv`}
        />
        <FinancesExportButton
          rows={monthCsvRows}
          label={`Export ${MONTHS[selectedMonth]} CSV`}
          filename={`finances-${year}-${monthStr}.csv`}
        />
        <Link href="/finances/expenses/new" className="btn btn-secondary btn-sm">+ Add Expense</Link>
      </div>
    </div>
  )
}

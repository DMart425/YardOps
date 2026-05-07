import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { addDays, formatDateOnly, getDateOnlyMonthKey, getLocalDateStr, getLocalMonthKey, resolveTimeZone } from '@/lib/date'
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

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('time_zone')
    .eq('user_id', user.id)
    .maybeSingle()
  const timeZone = resolveTimeZone(settings?.time_zone)
  const localToday = getLocalDateStr(timeZone)
  const [localYear, localMonth] = localToday.split('-')
  const year = Number(sp.year ?? localYear)
  const selectedMonth = sp.month ? Number(sp.month) - 1 : Number(localMonth) - 1 // 0-indexed

  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  const jobsQueryStart = `${addDays(yearStart, -1)}T00:00:00Z`
  const jobsQueryEnd = `${addDays(yearEnd, 1)}T23:59:59Z`
  const selectedMonthKey = `${year}-${String(selectedMonth + 1).padStart(2, '0')}`

  // Fetch paid/partial jobs for the year with customer info
  const { data: rawJobs } = await supabase
    .from('jobs')
    .select('id, amount_paid, price, payment_status, completed_at, customers(id, first_name, last_name)')
    .in('payment_status', ['paid', 'partial'])
    .gte('completed_at', jobsQueryStart)
    .lte('completed_at', jobsQueryEnd)
    .order('completed_at')

  const jobs = (rawJobs ?? []).filter(j => getLocalMonthKey(j.completed_at, timeZone).startsWith(`${year}-`))

  // Fetch expenses for the year
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .gte('purchased_at', yearStart)
    .lte('purchased_at', yearEnd)
    .order('purchased_at')

  // ── Aggregate YTD ──────────────────────────────────────────────
  const totalIncome   = (jobs ?? []).reduce((s, j) => s + Number((j.amount_paid || null) ?? j.price ?? 0), 0)
  const totalExpenses = (expenses ?? []).reduce((s, e) => s + Number(e.amount ?? 0), 0)
  const totalJobCount = (jobs ?? []).length
  const avgJobValue   = totalJobCount > 0 ? totalIncome / totalJobCount : 0

  // ── Monthly breakdown ──────────────────────────────────────────
  const incomeByMonth   = Array(12).fill(0) as number[]
  const expensesByMonth = Array(12).fill(0) as number[]
  const jobCountByMonth = Array(12).fill(0) as number[]

  for (const j of jobs) {
    const m = Number(getLocalMonthKey(j.completed_at, timeZone).slice(5, 7)) - 1
    incomeByMonth[m]   += Number((j.amount_paid || null) ?? j.price ?? 0)
    jobCountByMonth[m] += 1
  }
  for (const e of expenses ?? []) {
    const m = Number(getDateOnlyMonthKey(e.purchased_at).slice(5, 7)) - 1
    expensesByMonth[m] += Number(e.amount ?? 0)
  }

  // ── Best month ────────────────────────────────────────────────
  const bestMonthIdx = incomeByMonth.indexOf(Math.max(...incomeByMonth))
  const bestMonthIncome = incomeByMonth[bestMonthIdx]

  // ── Selected month data ────────────────────────────────────────
  const monthJobs = jobs.filter(j => getLocalMonthKey(j.completed_at, timeZone) === selectedMonthKey)
  const monthExpenses = (expenses ?? []).filter(e => getDateOnlyMonthKey(e.purchased_at) === selectedMonthKey)
  const monthIncome = monthJobs.reduce((s, j) => s + Number((j.amount_paid || null) ?? j.price ?? 0), 0)
  const monthExpenseTotal = monthExpenses.reduce((s, e) => s + Number(e.amount ?? 0), 0)

  // ── Per-customer income (selected month) ──────────────────────
  const customerTotals = new Map<string, { name: string; count: number; total: number }>()
  for (const j of monthJobs) {
    const raw = j.customers
    const c = (Array.isArray(raw) ? raw[0] : raw) as { id: string; first_name: string; last_name: string | null } | null
    if (!c) continue
    const cur = customerTotals.get(c.id) ?? { name: [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unknown', count: 0, total: 0 }
    cur.count++
    cur.total += Number((j.amount_paid || null) ?? j.price ?? 0)
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
      const c = (Array.isArray(rawC) ? rawC[0] : rawC) as { first_name?: string; last_name?: string | null } | null
      rows.push({
        date: j.completed_at?.split('T')[0] ?? '',
        type: 'income',
        customer_or_vendor: [c?.first_name, c?.last_name].filter(Boolean).join(' '),
        description: 'Lawn service',
        category: 'service',
        amount: Number((j.amount_paid || null) ?? j.price ?? 0),
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
        <Link href="/finances/expenses/new" className="btn btn-header btn-sm">+ Add Expense</Link>
      </div>

      {/* Year selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', alignItems: 'center' }}>
        <Link href={`/finances?year=${year - 1}&month=${monthStr}`} className="btn btn-secondary btn-sm">← {year - 1}</Link>
        <span style={{ fontWeight: 700, fontSize: '1.0625rem' }}>{year}</span>
        <Link href={`/finances?year=${year + 1}&month=${monthStr}`} className="btn btn-secondary btn-sm">{year + 1} →</Link>
      </div>

      {/* YTD strip */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center', marginBottom: '0.75rem' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
          <div>
            <div className="text-small text-muted">Jobs</div>
            <div style={{ fontWeight: 700 }}>{totalJobCount}</div>
          </div>
          <div>
            <div className="text-small text-muted">Avg Job</div>
            <div style={{ fontWeight: 700 }}>{totalJobCount > 0 ? fmt$(avgJobValue) : '—'}</div>
          </div>
          <div>
            <div className="text-small text-muted">Best Month</div>
            <div style={{ fontWeight: 700 }}>{bestMonthIncome > 0 ? MONTHS[bestMonthIdx] : '—'}</div>
          </div>
        </div>
      </div>

      {/* Monthly bar chart */}
      {totalIncome > 0 && (() => {
        const maxVal = Math.max(...incomeByMonth, ...expensesByMonth, 1)
        const chartH = 80
        const barW   = 10
        const slotW  = 28
        const svgW   = 12 * slotW
        return (
          <div className="card" style={{ marginBottom: '1.25rem', overflowX: 'auto' }}>
            <div className="text-small text-muted" style={{ marginBottom: '6px', display: 'flex', gap: '12px' }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--color-primary)', marginRight: 4 }} />Income</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#dc2626', marginRight: 4 }} />Expenses</span>
            </div>
            <svg viewBox={`0 0 ${svgW} ${chartH + 18}`} width="100%" style={{ display: 'block' }}>
              {incomeByMonth.map((inc, i) => {
                const exp     = expensesByMonth[i]
                const incH    = Math.round((inc / maxVal) * chartH)
                const expH    = Math.round((exp / maxVal) * chartH)
                const x       = i * slotW
                const isSelMo = i === selectedMonth
                return (
                  <g key={i}>
                    {/* income bar */}
                    <rect x={x + 2}        y={chartH - incH} width={barW} height={incH} fill={isSelMo ? '#16a34a' : 'var(--color-primary)'} rx="2" />
                    {/* expense bar */}
                    <rect x={x + 2 + barW + 2} y={chartH - expH} width={barW} height={expH} fill={isSelMo ? '#991b1b' : '#dc2626'} opacity="0.7" rx="2" />
                    {/* month label */}
                    <text x={x + slotW / 2} y={chartH + 14} textAnchor="middle" fontSize="8" fill={isSelMo ? 'var(--color-primary)' : 'var(--color-text-muted)'} fontWeight={isSelMo ? '700' : '400'}>
                      {MONTHS[i]}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        )
      })()}

      {/* Month selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', marginBottom: '1.25rem' }}>
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
                color: isSelected ? '#000' : 'var(--color-text)',
                border: '1px solid',
                borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              <div>{m}</div>
              {incomeByMonth[i] > 0 || expensesByMonth[i] > 0 ? (
                <div style={{ fontSize: '0.65rem', color: isSelected ? 'rgba(0,0,0,0.7)' : net >= 0 ? 'var(--color-primary)' : 'var(--color-danger, #dc2626)' }}>
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
                      <span className="text-small text-muted" style={{ marginLeft: '6px' }}>{formatDateOnly(e.purchased_at)}</span>
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

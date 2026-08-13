import Link from 'next/link'

export function StatsGrid({
  todayJobsCount,
  todayTotal,
  newLeadsCount,
  overdueCount,
  overdueDisplayCount,
  completedTodayCount,
  collectedTodayRevenue,
  weekJobsCount,
  expectedWeekRevenue,
  unpaidTotal,
}: {
  todayJobsCount: number
  todayTotal: number
  newLeadsCount: number
  overdueCount: number
  overdueDisplayCount: string
  completedTodayCount: number
  collectedTodayRevenue: number
  weekJobsCount: number
  expectedWeekRevenue: number
  unpaidTotal: number
}) {
  return (
    <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
      <Link href="/jobs?view=scheduled&filter=today" className="stat-card" style={{ textDecoration: 'none' }}>
        <div className="stat-value">{todayJobsCount} · ${todayTotal.toFixed(0)}</div>
        <div className="stat-label">Jobs today</div>
      </Link>
      <Link href="/leads" className="stat-card" style={{ textDecoration: 'none' }}>
        <div className="stat-value" style={{ color: (newLeadsCount > 0) ? 'var(--color-lead)' : undefined }}>
          {newLeadsCount}
        </div>
        <div className="stat-label">New leads</div>
      </Link>
      <Link href="/jobs?view=scheduled&filter=overdue" className="stat-card" style={{ textDecoration: 'none' }}>
        <div className="stat-value" style={{ color: overdueCount ? 'var(--color-overdue)' : undefined }}>
          {overdueDisplayCount}
        </div>
        <div className="stat-label">Overdue</div>
      </Link>
      <Link href="/jobs?view=completed&filter=today&page=1" className="stat-card" style={{ textDecoration: 'none' }}>
        <div className="stat-value" style={{ color: completedTodayCount > 0 ? 'var(--color-primary)' : undefined }}>
          {completedTodayCount}
        </div>
        <div className="stat-label">Completed today</div>
      </Link>
      {collectedTodayRevenue > 0 && (
        <Link href="/jobs?view=completed&filter=today&page=1" className="stat-card" style={{ textDecoration: 'none' }}>
          <div className="stat-value" style={{ color: 'var(--color-primary)' }}>
            ${collectedTodayRevenue.toFixed(0)}
          </div>
          <div className="stat-label">Collected today</div>
        </Link>
      )}
      <Link href="/jobs?filter=week" className="stat-card" style={{ textDecoration: 'none' }}>
        <div className="stat-value">{weekJobsCount} · ${expectedWeekRevenue.toFixed(0)}</div>
        <div className="stat-label">This week</div>
      </Link>
      <Link href="/jobs?view=completed&filter=unpaid&page=1" className="stat-card" style={{ textDecoration: 'none' }}>
        <div className="stat-value" style={{ color: unpaidTotal > 0 ? 'var(--color-unpaid)' : undefined }}>
          ${unpaidTotal.toFixed(0)}
        </div>
        <div className="stat-label">Unpaid balance</div>
      </Link>
    </div>
  )
}

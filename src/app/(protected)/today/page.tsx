import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getTodayForecastForCoords, coordKey } from '@/lib/weather'
import { EstimateApprovalNotifications } from '@/components/EstimateApprovalNotifications'
import { addDays, formatDateOnly, formatTimestampDate, getLocalDateStr, resolveTimeZone } from '@/lib/date'
import { requireBusinessContext } from '@/lib/business/context'

function dateOnlyToUtcMs(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

const SERVICE_LABELS: Record<string, string> = {
  mow_only:      'Mow Only',
  mow_trim_blow: 'Mow, Trim & Blow',
  trim_cleanup:  'Trim & Cleanup',
  full_service:  'Full Service',
}

function servicePackageLabel(value: string | null | undefined): string {
  if (!value) return 'Service'
  return SERVICE_LABELS[value] ?? value.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
}

function deriveServiceLabel(
  pkg: string | null | undefined,
  prop: {
    default_mowing_enabled?: boolean | null
    default_weed_eating_enabled?: boolean | null
    default_edging_enabled?: boolean | null
    default_blow_off_enabled?: boolean | null
  } | null
): string {
  if (pkg) return servicePackageLabel(pkg)
  const parts: string[] = []
  if (prop?.default_mowing_enabled)      parts.push('Mowing')
  if (prop?.default_weed_eating_enabled) parts.push('Weed Eating')
  if (prop?.default_edging_enabled)      parts.push('Edging')
  if (prop?.default_blow_off_enabled)    parts.push('Blow Off')
  return parts.length > 0 ? parts.join(', ') : 'Lawn Service'
}

export default async function TodayPage() {
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('time_zone')
    .eq('user_id', userId)
    .maybeSingle()
  const timeZone = resolveTimeZone(settings?.time_zone)
  const today = getLocalDateStr(timeZone)
  const todayStartMs = dateOnlyToUtcMs(today)
  const tomorrowForCompletedStr = addDays(today, 1)
  const tomorrowStr = addDays(today, 1)
  const twoWeeksStr = addDays(today, 14)
  const sixtyDaysAgoStr = addDays(today, -60)
  const twoYearsAgoStr = addDays(today, -730)

  const [
    approvalNotificationsResult,
    todayJobsResult,
    completedTodayJobsResult,
    overdueJobsResult,
    unpaidJobsResult,
    tomorrowJobsResult,
    estimateVisitsResult,
    recentRecurringResult,
    recentCompletedJobsResult,
    websiteLeadsCountResult,
    manualLeadsCountResult,
  ] = await Promise.all([
    supabase
      .from('app_notifications')
      .select('id, user_id, notification_type, title, body, link_path, estimate_id, is_reviewed, reviewed_at, created_at, estimates!estimate_id(status)')
      .eq('user_id', userId)
      .eq('notification_type', 'estimate_approved')
      .eq('is_reviewed', false)
      .not('estimate_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10),
    // Fetch today's jobs with customer and property info
    supabase
      .from('jobs')
      .select(`
        id, title, service_package, job_type, price, payment_status, status, scheduled_date, scheduled_time_window,
        customers ( first_name, last_name, phone ),
        properties ( service_address, city, pet_warning, gate_code, access_notes, obstacle_notes, latitude, longitude, default_mowing_enabled, default_weed_eating_enabled, default_edging_enabled, default_blow_off_enabled )
      `)
      .eq('business_id', businessId)
      .eq('scheduled_date', today)
      .not('status', 'in', '("completed","cancelled","skipped")')
      .order('scheduled_date'),
    // Completed jobs finished today
    supabase
      .from('jobs')
      .select(`
        id, title, service_package, price, amount_paid, payment_status, completed_at,
        customers ( first_name, last_name ),
        properties ( service_address, city )
      `)
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('completed_at', `${today}T00:00:00`)
      .lt('completed_at', `${tomorrowForCompletedStr}T00:00:00`)
      .order('completed_at', { ascending: false }),
    // Overdue jobs
    supabase
      .from('jobs')
      .select(`
        id, title, scheduled_date, price, status,
        customers ( first_name, last_name ),
        properties ( service_address, city )
      `)
      .eq('business_id', businessId)
      .lt('scheduled_date', today)
      .in('status', ['scheduled', 'in_progress', 'needs_reschedule'])
      .order('scheduled_date', { ascending: true })
      .limit(10),
    // Unpaid completed jobs
    supabase
      .from('jobs')
      .select(`
        id, title, price, amount_paid, payment_status, completed_at,
        customers ( first_name, last_name, phone )
      `)
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .in('payment_status', ['unpaid', 'partial'])
      .order('completed_at', { ascending: false })
      .limit(10),
    // Tomorrow's jobs for reminder SMS
    supabase
      .from('jobs')
      .select(`
        id, title, service_package, job_type, price, scheduled_date, scheduled_time_window,
        customers ( first_name, last_name, phone ),
        properties ( service_address, city, default_mowing_enabled, default_weed_eating_enabled, default_edging_enabled, default_blow_off_enabled )
      `)
      .eq('business_id', businessId)
      .eq('scheduled_date', tomorrowStr)
      .in('status', ['scheduled', 'in_progress'])
      .order('scheduled_date'),
    // Today's estimate visits
    supabase
      .from('estimates')
      .select(`
        id, visit_scheduled_time, total,
        customers ( first_name, last_name, phone ),
        properties ( service_address, city )
      `)
      .eq('business_id', businessId)
      .eq('visit_scheduled_date', today)
      .not('status', 'in', '("converted","declined")')
      .order('visit_scheduled_time'),
    // Recurring gap detection base query
    supabase
      .from('jobs')
      .select('customer_id, customers(first_name, last_name)')
      .eq('business_id', businessId)
      .eq('job_type', 'recurring')
      .gte('scheduled_date', sixtyDaysAgoStr)
      .not('status', 'in', '("cancelled","skipped")'),
    // Customer retention base query — bounded to 2-year lookback to avoid full table scan.
    // Customers whose last completed job was >2 years ago are treated as churned and will not
    // appear in the dormant list; this is an acceptable trade-off for the Today dashboard.
    supabase
      .from('jobs')
      .select('customer_id, completed_at, customers(id, first_name, last_name)')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .not('customer_id', 'is', null)
      .gte('completed_at', `${twoYearsAgoStr}T00:00:00`),
    // New leads count (website)
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'new'),
    // New leads count (manual)
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'lead'),
  ])

  // Exclude notifications whose linked estimate has already been converted to a job.
  // Notifications with no linked estimate (estimate_id null) are kept — shown as-is.
  const approvalNotifications = (approvalNotificationsResult.data ?? []).filter(n => {
    const estRaw = (n as unknown as { estimates?: { status: string } | { status: string }[] | null }).estimates
    const est = Array.isArray(estRaw) ? estRaw[0] : estRaw
    return est?.status !== 'converted'
  })
  const todayJobs = todayJobsResult.data
  const completedTodayJobs = completedTodayJobsResult.data
  const overdueJobs = overdueJobsResult.data
  const unpaidJobs = unpaidJobsResult.data
  const tomorrowJobs = tomorrowJobsResult.data
  const estimateVisits = estimateVisitsResult.data
  const recentRecurring = recentRecurringResult.data
  const recentCompletedJobs = recentCompletedJobsResult.data
  const websiteLeadsCount = websiteLeadsCountResult.count
  const manualLeadsCount = manualLeadsCountResult.count

  // Fetch weather for unique property coordinates
  const coords: Array<{ lat: number; lon: number }> = []
  for (const j of todayJobs ?? []) {
    const p = (Array.isArray(j.properties) ? j.properties[0] : j.properties) as { latitude: number | null; longitude: number | null } | null
    if (p?.latitude != null && p.longitude != null) {
      coords.push({ lat: p.latitude, lon: p.longitude })
    }
  }
  const weatherMap = coords.length > 0 ? await getTodayForecastForCoords(coords) : new Map()
  const anyRainToday = Array.from(weatherMap.values()).some(fc => fc.precipChance >= 40 || fc.precipInches >= 0.05)

  let gapCustomers: { id: string; name: string }[] = []
  if (recentRecurring && recentRecurring.length > 0) {
    // Deduplicate to unique customers
    const uniqueMap = new Map<string, string>()
    for (const row of recentRecurring) {
      const cid = row.customer_id as string
      if (!uniqueMap.has(cid)) {
        const raw = row.customers
        const c = (Array.isArray(raw) ? raw[0] : raw) as { first_name: string; last_name: string | null } | null
        uniqueMap.set(cid, c ? `${c.first_name}${c.last_name ? ' ' + c.last_name : ''}` : 'Customer')
      }
    }
    const recurringIds = [...uniqueMap.keys()]
    const { data: upcomingJobs } = await supabase
      .from('jobs')
      .select('customer_id')
      .eq('business_id', businessId)
      .in('customer_id', recurringIds)
      .gte('scheduled_date', today)
      .lte('scheduled_date', twoWeeksStr)
      .in('status', ['scheduled', 'in_progress'])
    const coveredIds = new Set((upcomingJobs ?? []).map(j => j.customer_id as string))
    gapCustomers = recurringIds
      .filter(id => !coveredIds.has(id))
      .map(id => ({ id, name: uniqueMap.get(id)! }))
  }

  let dormantCustomers: { id: string; name: string; daysSince: number }[] = []
  if (recentCompletedJobs && recentCompletedJobs.length > 0) {
    const lastVisitMap = new Map<string, { name: string; date: Date }>()
    for (const row of recentCompletedJobs) {
      const cid = row.customer_id as string
      const raw = row.customers
      const c = (Array.isArray(raw) ? raw[0] : raw) as { id: string; first_name: string; last_name: string | null } | null
      if (!c || !row.completed_at) continue
      const d = new Date(row.completed_at)
      const existing = lastVisitMap.get(cid)
      if (!existing || d > existing.date) {
        lastVisitMap.set(cid, { name: `${c.first_name}${c.last_name ? ' ' + c.last_name : ''}`, date: d })
      }
    }
    dormantCustomers = [...lastVisitMap.entries()]
      .map(([id, { name, date }]) => ({ id, name, daysSince: Math.floor((todayStartMs - date.getTime()) / 86400000) }))
      .filter(c => c.daysSince >= 60)
      .sort((a, b) => b.daysSince - a.daysSince)
      .slice(0, 5) // cap at 5 to avoid wall of text
  }

  const todayTotal = (todayJobs ?? []).reduce((s, j) => s + (j.price ?? 0), 0)
  const unpaidTotal = (unpaidJobs ?? []).reduce((s, j) => s + Math.max(0, (j.price ?? 0) - (j.amount_paid ?? 0)), 0)

  const newLeadsCount = (websiteLeadsCount ?? 0) + (manualLeadsCount ?? 0)

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Today</h1>
          <p className="page-subtitle">{formatDateOnly(today, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      <EstimateApprovalNotifications notifications={approvalNotifications ?? []} />

      {/* Rain warning banner */}
      {anyRainToday && (
        <div className="card" style={{ marginBottom: '1rem', background: 'rgba(80,140,255,0.12)', borderLeft: '3px solid #4a90e2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem' }}>🌧</span>
            <div>
              <div className="font-bold">Rain expected today</div>
              <div className="text-small text-muted">Consider rescheduling jobs at higher-risk locations.</div>
            </div>
          </div>
        </div>
      )}

      {/* Recurring gap alert */}
      {gapCustomers.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--color-warning, #f59e0b)', background: 'rgba(245,158,11,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>🔁</span>
            <div>
              <div className="font-bold" style={{ marginBottom: '4px' }}>Recurring customers with no upcoming job</div>
              <div className="text-small text-muted" style={{ marginBottom: '6px' }}>No job scheduled in the next 14 days:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {gapCustomers.map(c => (
                  <Link key={c.id} href={`/customers/${c.id}`} className="pill pill-lead" style={{ textDecoration: 'none' }}>{c.name}</Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Retention alert */}
      {dormantCustomers.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--color-unpaid, #f97316)', background: 'rgba(249,115,22,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>💤</span>
            <div>
              <div className="font-bold" style={{ marginBottom: '4px' }}>Customers you haven&apos;t visited recently</div>
              <div className="text-small text-muted" style={{ marginBottom: '6px' }}>No completed job in 60+ days:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {dormantCustomers.map(c => (
                  <Link key={c.id} href={`/customers/${c.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none' }}>
                    <span className="text-small">{c.name}</span>
                    <span className="pill pill-overdue" style={{ fontSize: '0.7rem' }}>{c.daysSince}d ago</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-value">{todayJobs?.length ?? 0}</div>
          <div className="stat-label">Jobs today</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${todayTotal.toFixed(0)}</div>
          <div className="stat-label">Expected today</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: (newLeadsCount > 0) ? 'var(--color-lead)' : undefined }}>
            {newLeadsCount}
          </div>
          <div className="stat-label">New leads</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: overdueJobs?.length ? 'var(--color-overdue)' : undefined }}>
            {overdueJobs?.length ?? 0}
          </div>
          <div className="stat-label">Overdue</div>
        </div>
        <a href="#completed-today" className="stat-card" style={{ textDecoration: 'none' }}>
          <div className="stat-value" style={{ color: (completedTodayJobs?.length ?? 0) > 0 ? 'var(--color-primary)' : undefined }}>
            {completedTodayJobs?.length ?? 0}
          </div>
          <div className="stat-label">Completed today</div>
        </a>
        <Link href="/jobs?filter=unpaid" className="stat-card" style={{ textDecoration: 'none' }}>
          <div className="stat-value" style={{ color: unpaidTotal > 0 ? 'var(--color-unpaid)' : undefined }}>
            ${unpaidTotal.toFixed(0)}
          </div>
          <div className="stat-label">Unpaid balance</div>
        </Link>
      </div>

      {/* Today's Jobs */}
      <div className="detail-section">
        <div className="section-heading">Today&apos;s Jobs ({todayJobs?.length ?? 0})</div>
        {!todayJobs?.length ? (
          <div className="card">
            <p className="text-muted text-small">No jobs scheduled for today.</p>
            <div style={{ marginTop: '12px' }}>
              <Link href="/jobs/new" className="btn btn-sm btn-secondary">Schedule a job</Link>
            </div>
          </div>
        ) : (
          todayJobs.map((job) => {
            const customer = (Array.isArray(job.customers) ? job.customers[0] : job.customers) as { first_name: string; last_name: string | null; phone: string | null } | null
            const property = (Array.isArray(job.properties) ? job.properties[0] : job.properties) as { service_address: string; city: string | null; pet_warning: string | null; gate_code: string | null; access_notes: string | null; obstacle_notes: string | null; latitude: number | null; longitude: number | null; default_mowing_enabled: boolean | null; default_weed_eating_enabled: boolean | null; default_edging_enabled: boolean | null; default_blow_off_enabled: boolean | null } | null
            const warnings = [property?.pet_warning, property?.gate_code ? `Gate: ${property.gate_code}` : null, property?.access_notes, property?.obstacle_notes].filter(Boolean)
            const fc = property?.latitude != null && property.longitude != null
              ? weatherMap.get(coordKey(property.latitude, property.longitude))
              : null
            const wetRisk = fc && (fc.precipChance >= 40 || fc.precipInches >= 0.05)

            return (
              <div key={job.id} className="card">
                <div className="card-row">
                  <div>
                    <div className="card-title">{job.title}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                      <div className="card-meta">👤 {customer?.first_name} {customer?.last_name}</div>
                      <div className="card-meta">📍 {property?.service_address}{property?.city ? `, ${property.city}` : ''}</div>
                      {job.scheduled_time_window && <div className="card-meta">🗓 {job.scheduled_time_window}</div>}
                      <div className="card-meta">🌿 {deriveServiceLabel(job.service_package, property)}</div>
                      {job.price != null && <div className="card-meta">💵 ${Number(job.price).toFixed(0)}</div>}
                      {fc && (
                        <div className="card-meta" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{fc.emoji}</span>
                          <span>{fc.tempHi}° / {fc.tempLo}° · {fc.summary}</span>
                          {fc.precipChance > 0 && (
                            <span style={{ color: wetRisk ? 'var(--color-overdue)' : undefined, fontWeight: wetRisk ? 600 : undefined }}>
                              · {fc.precipChance}% rain
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span className={`pill pill-${job.status}`}>{job.status.replace(/_/g, ' ')}</span>
                  </div>
                </div>

                {warnings.length > 0 && (
                  <div className="property-warnings">
                    {warnings.map((w, i) => (
                      <div key={i} className="warning-banner">⚠ {w}</div>
                    ))}
                  </div>
                )}

                <div className="card-actions">
                  {property?.service_address && (
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent([property.service_address, property.city].filter(Boolean).join(', '))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-secondary"
                    >
                      Open Maps
                    </a>
                  )}
                  {customer?.phone && (
                    <a
                      href={`sms:${customer.phone}?body=${encodeURIComponent(`Hey ${customer.first_name}, I'm on my way to service your lawn now.`)}`}
                      className="btn btn-sm btn-secondary"
                    >
                      On My Way
                    </a>
                  )}
                  <Link href={`/jobs/${job.id}`} className="btn btn-sm btn-primary">
                    View Job
                  </Link>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Estimate Visits */}
      {(estimateVisits?.length ?? 0) > 0 && (
        <div className="detail-section">
          <div className="section-heading">📋 Estimate Visits ({estimateVisits!.length})</div>
          {estimateVisits!.map((visit) => {
            const customer = (Array.isArray(visit.customers) ? visit.customers[0] : visit.customers) as { first_name: string; last_name: string | null; phone: string | null } | null
            const property = (Array.isArray(visit.properties) ? visit.properties[0] : visit.properties) as { service_address: string; city: string | null } | null
            return (
              <div key={visit.id} className="card">
                <div className="card-row">
                  <div>
                    <div className="card-title">{customer?.first_name} {customer?.last_name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                      <div className="card-meta">📍 {property?.service_address}{property?.city ? `, ${property.city}` : ''}</div>
                      {visit.visit_scheduled_time && <div className="card-meta">🕐 {visit.visit_scheduled_time}</div>}
                      {visit.total != null && <div className="card-meta">💵 ~${Number(visit.total).toFixed(0)}</div>}
                      {customer?.phone && <div className="card-meta">📞 {customer.phone}</div>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span className="pill pill-draft">Estimate Visit</span>
                  </div>
                </div>
                <div className="card-actions">
                  {property?.service_address && (
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent([property.service_address, property.city].filter(Boolean).join(', '))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-secondary"
                    >
                      Open Maps
                    </a>
                  )}
                  {customer?.phone && (
                    <a
                      href={`sms:${customer.phone}?body=${encodeURIComponent(`Hi ${customer?.first_name ?? 'there'}, just a reminder that I have an estimate visit scheduled at your property today. I'll be in touch with your quote shortly!`)}`}
                      className="btn btn-sm btn-secondary"
                    >
                      📱 Remind
                    </a>
                  )}
                  <Link href={`/estimates/${visit.id}`} className="btn btn-sm btn-primary">View Estimate</Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Completed Today */}
      {(completedTodayJobs?.length ?? 0) > 0 && (
        <div className="detail-section" id="completed-today">
          <div className="section-heading" style={{ color: 'var(--color-primary)' }}>
            Completed Today ({completedTodayJobs!.length})
          </div>
          {completedTodayJobs!.map((job) => {
            const customer = (Array.isArray(job.customers) ? job.customers[0] : job.customers) as { first_name: string; last_name: string | null } | null
            const property = (Array.isArray(job.properties) ? job.properties[0] : job.properties) as { service_address: string; city: string | null } | null
            const balance = Math.max(0, (job.price ?? 0) - (job.amount_paid ?? 0))
            return (
              <Link key={job.id} href={`/jobs/${job.id}`} style={{ display: 'block' }}>
                <div className="card">
                  <div className="card-row">
                    <div>
                      <div className="card-title">{job.title}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                        <div className="card-meta">👤 {customer?.first_name} {customer?.last_name}</div>
                        <div className="card-meta">📍 {property?.service_address}{property?.city ? `, ${property.city}` : ''}</div>
                        {job.completed_at && <div className="card-meta">✅ {formatTimestampDate(job.completed_at, timeZone, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {job.price != null && <div style={{ fontWeight: 700 }}>${Number(job.price).toFixed(0)}</div>}
                      <span className={`pill pill-${job.payment_status}`}>{job.payment_status.replace(/_/g, ' ')}</span>
                      {balance > 0 && <div className="text-small" style={{ color: 'var(--color-unpaid)', marginTop: '4px' }}>${balance.toFixed(0)} owed</div>}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Overdue */}
      {(overdueJobs?.length ?? 0) > 0 && (
        <div className="detail-section">
          <div className="section-heading" style={{ color: 'var(--color-overdue)' }}>
            Overdue ({overdueJobs!.length})
          </div>
          {overdueJobs!.map((job) => {
            const customer = (Array.isArray(job.customers) ? job.customers[0] : job.customers) as { first_name: string; last_name: string | null } | null
            const property = (Array.isArray(job.properties) ? job.properties[0] : job.properties) as { service_address: string; city: string | null } | null
            const daysLate = Math.floor((todayStartMs - dateOnlyToUtcMs(job.scheduled_date)) / 86400000)
            return (
              <Link key={job.id} href={`/jobs/${job.id}`} style={{ display: 'block' }}>
                <div className="card">
                  <div className="card-row">
                    <div>
                      <div className="card-title">{job.title}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                        <div className="card-meta">👤 {customer?.first_name} {customer?.last_name}</div>
                        <div className="card-meta">📍 {property?.service_address}{property?.city ? `, ${property.city}` : ''}</div>
                        {job.scheduled_date && <div className="card-meta">🗓 {formatDateOnly(job.scheduled_date, { weekday: 'short', month: 'short', day: 'numeric' })}</div>}
                        {job.price != null && <div className="card-meta">💵 ${Number(job.price).toFixed(0)}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                      <span className={`pill pill-${job.status}`}>{job.status.replace(/_/g, ' ')}</span>
                      <span className="pill pill-overdue">{daysLate}d late</span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Tomorrow's Jobs */}
      {(tomorrowJobs?.length ?? 0) > 0 && (
        <div className="detail-section">
          <div className="section-heading">Tomorrow ({tomorrowJobs!.length})</div>
          {tomorrowJobs!.map((job) => {
            const customer = (Array.isArray(job.customers) ? job.customers[0] : job.customers) as { first_name: string; last_name: string | null; phone: string | null } | null
            const property = (Array.isArray(job.properties) ? job.properties[0] : job.properties) as { service_address: string; city: string | null; default_mowing_enabled: boolean | null; default_weed_eating_enabled: boolean | null; default_edging_enabled: boolean | null; default_blow_off_enabled: boolean | null } | null
            const svcLabel = deriveServiceLabel(job.service_package, property)
            const smsBody = `Hi ${customer?.first_name ?? 'there'}, just a reminder that we have you scheduled for ${svcLabel} tomorrow. See you then! — ${tomorrowStr}`
            return (
              <div key={job.id} className="card">
                <div className="card-row">
                  <div style={{ flex: 1 }}>
                    <div className="card-title">{job.title}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                      <div className="card-meta">👤 {customer?.first_name} {customer?.last_name}</div>
                      <div className="card-meta">📍 {property?.service_address}{property?.city ? `, ${property.city}` : ''}</div>
                      <div className="card-meta">🗓 {formatDateOnly(tomorrowStr, { weekday: 'short', month: 'short', day: 'numeric' })}{job.scheduled_time_window ? ` · ${job.scheduled_time_window}` : ''}</div>
                      <div className="card-meta">🌿 {svcLabel}</div>
                      {job.price != null && <div className="card-meta">💵 ${Number(job.price).toFixed(0)}</div>}
                    </div>
                  </div>
                </div>
                <div className="card-actions">
                  {customer?.phone && (
                    <a
                      href={`sms:${customer.phone}?&body=${encodeURIComponent(smsBody)}`}
                      className="btn btn-sm btn-secondary"
                    >
                      📱 Send Reminder
                    </a>
                  )}
                  <a
                    href={`/jobs/${job.id}`}
                    className="btn btn-sm btn-primary"
                  >
                    View Job
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Unpaid */}
      {(unpaidJobs?.length ?? 0) > 0 && (
        <div className="detail-section">
          <div className="section-heading" style={{ color: 'var(--color-unpaid)' }}>
            Unpaid ({unpaidJobs!.length}) — ${unpaidTotal.toFixed(0)} owed
          </div>
          {unpaidJobs!.map((job) => {
            const customer = (Array.isArray(job.customers) ? job.customers[0] : job.customers) as { first_name: string; last_name: string | null; phone: string | null } | null
            const balance = (job.price ?? 0) - (job.amount_paid ?? 0)
            return (
              <div key={job.id} className="card">
                <div className="card-row">
                  <div>
                    <div className="card-title">{job.title}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                      <div className="card-meta">👤 {customer?.first_name} {customer?.last_name}</div>
                      <div className="card-meta">💵 ${balance.toFixed(0)} due</div>
                      {job.completed_at && <div className="card-meta">🗓 {formatTimestampDate(job.completed_at, timeZone, { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span className={`pill pill-${job.payment_status}`}>{job.payment_status.replace(/_/g, ' ')}</span>
                  </div>
                </div>
                <div className="card-actions">
                  {customer?.phone && (
                    <a
                      href={`sms:${customer.phone}?body=${encodeURIComponent(`Hey ${customer.first_name}, just a quick reminder that your lawn service balance of $${balance.toFixed(0)} is still open. Thanks`)}`}
                      className="btn btn-sm btn-secondary"
                    >
                      Send Reminder
                    </a>
                  )}
                  <Link href={`/jobs/${job.id}`} className="btn btn-sm btn-primary">Mark Paid</Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

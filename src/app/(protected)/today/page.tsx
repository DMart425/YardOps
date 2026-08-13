import { createClient } from '@/lib/supabase/server'
import { getTodayForecastForCoords } from '@/lib/weather'
import { geocodeAddress } from '@/lib/geocode'
import { EstimateApprovalNotifications } from '@/components/EstimateApprovalNotifications'
import { addDays, formatDateOnly, getLocalDateStr, localMidnightUtcIso, resolveTimeZone } from '@/lib/date'
import { requireBusinessContext } from '@/lib/business/context'
import { firstReadError } from '@/lib/readError'
import { ReadErrorNotice } from '@/components/ReadErrorNotice'
import type { AppNotification } from '@/types/database'
import { orderStopsForRoute, buildRouteUrl } from '@/lib/route'
import { resolveSmsMode } from '@/lib/sms'
import { calcJobBalance } from '@/lib/money'
import { dateOnlyToUtcMs } from './sections/shared'
import { RainBanner } from './sections/RainBanner'
import { RecurringGapAlert, DormantCustomersAlert } from './sections/RetentionAlerts'
import { StatsGrid } from './sections/StatsGrid'
import { TodayJobsSection } from './sections/TodayJobsSection'
import { EstimateVisitsSection } from './sections/EstimateVisitsSection'
import { OverdueSection } from './sections/OverdueSection'
import { CompletedTodaySection } from './sections/CompletedTodaySection'
import { TomorrowSection } from './sections/TomorrowSection'
import { NeedsFollowUpSection } from './sections/NeedsFollowUpSection'
import { ApprovedEstimatesSection } from './sections/ApprovedEstimatesSection'
import { UnpaidSection } from './sections/UnpaidSection'

export default async function TodayPage() {
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('time_zone, home_base_address, home_base_latitude, home_base_longitude, sms_mode')
    .eq('user_id', userId)
    .maybeSingle()
  const timeZone = resolveTimeZone(settings?.time_zone)
  const homeBaseCoord = settings?.home_base_latitude != null && settings?.home_base_longitude != null
    ? { latitude: Number(settings.home_base_latitude), longitude: Number(settings.home_base_longitude) }
    : null
  const homeBaseOrigin = settings?.home_base_address
    ?? (homeBaseCoord ? `${homeBaseCoord.latitude},${homeBaseCoord.longitude}` : null)
  const smsMode = resolveSmsMode(settings?.sms_mode)
  const today = getLocalDateStr(timeZone)
  const todayStartMs = dateOnlyToUtcMs(today)
  const tomorrowForCompletedStr = addDays(today, 1)
  const tomorrowStr = addDays(today, 1)
  const twoWeeksStr = addDays(today, 14)
  const sixtyDaysAgoStr = addDays(today, -60)
  const twoYearsAgoStr = addDays(today, -730)
  const thirtyDaysAgoStr = addDays(today, -30)

  // Week range (Sunday-start, matching jobs/page.tsx pattern)
  const [ty, tm, td] = today.split('-').map(Number)
  const todayWeekday = new Date(Date.UTC(ty, tm - 1, td)).getUTCDay()
  const weekStartStr = addDays(today, -todayWeekday)
  const weekEndStr   = addDays(weekStartStr, 6)

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
    weekJobsResult,
    needsFollowUpResult,
    approvedEstimatesResult,
    upcomingRecurringJobsResult,
    alertSnoozesResult,
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
        properties ( service_address, city, state, postal_code, pet_warning, gate_code, access_notes, obstacle_notes, latitude, longitude, default_mowing_enabled, default_weed_eating_enabled, default_edging_enabled, default_blow_off_enabled )
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
      .gte('completed_at', localMidnightUtcIso(today, timeZone))
      .lt('completed_at', localMidnightUtcIso(tomorrowForCompletedStr, timeZone))
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
    // Recurring gap detection base query. Customer status is selected so
    // inactive/archived customers can be excluded from the alert below.
    supabase
      .from('jobs')
      .select('customer_id, customers(first_name, last_name, status)')
      .eq('business_id', businessId)
      .eq('job_type', 'recurring')
      .gte('scheduled_date', sixtyDaysAgoStr)
      .not('status', 'in', '("cancelled","skipped")'),
    // Customer retention base query — bounded to 2-year lookback to avoid full table scan.
    // Customers whose last completed job was >2 years ago are treated as churned and will not
    // appear in the dormant list; this is an acceptable trade-off for the Today dashboard.
    // Recurring jobs only: a customer whose only history is a one-time cut is
    // not "dormant" — nagging to revisit them is noise. Customer status is
    // selected so inactive/archived customers can be excluded.
    supabase
      .from('jobs')
      .select('customer_id, completed_at, customers(id, first_name, last_name, status)')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .eq('job_type', 'recurring')
      .not('customer_id', 'is', null)
      .gte('completed_at', localMidnightUtcIso(twoYearsAgoStr, timeZone)),
    // New leads count (website)
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'new'),
    // New leads count (manual)
    supabase.from('customers').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'lead'),
    // This week's scheduled jobs — lightweight count + price sum
    supabase
      .from('jobs')
      .select('id, price', { count: 'exact' })
      .eq('business_id', businessId)
      .in('status', ['scheduled', 'in_progress', 'needs_reschedule'])
      .gte('scheduled_date', weekStartStr)
      .lte('scheduled_date', weekEndStr),
    // Recurring jobs completed in the last 30 days with no follow-up scheduled
    supabase
      .from('jobs')
      .select('id, title, completed_at, property_id, customer_id, customers(first_name, last_name), properties(service_address, city, service_frequency)')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .eq('job_type', 'recurring')
      .is('next_job_created_id', null)
      .gte('completed_at', localMidnightUtcIso(thirtyDaysAgoStr, timeZone))
      .order('completed_at', { ascending: false })
      .limit(10),
    // Approved estimates waiting to be scheduled
    supabase
      .from('estimates')
      .select('id, total, created_at, customers(first_name, last_name), properties(service_address, city)')
      .eq('business_id', businessId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(5),
    // Upcoming active recurring jobs — used to filter false positives from Needs Follow-up
    supabase
      .from('jobs')
      .select('id, property_id, customer_id, scheduled_date')
      .eq('business_id', businessId)
      .eq('job_type', 'recurring')
      .in('status', ['scheduled', 'in_progress', 'needs_reschedule'])
      .gte('scheduled_date', today),
    // Active alert snoozes — customers hidden from the retention alerts until
    // snoozed_until. Rows with past dates are simply ignored (and re-snoozing
    // upserts over them), so no cleanup job is needed.
    supabase
      .from('customer_alert_snoozes')
      .select('customer_id, alert_type')
      .eq('business_id', businessId)
      .gte('snoozed_until', today),
  ])

  // Exclude notifications whose linked estimate has already been converted to a job.
  // Notifications with no linked estimate (estimate_id null) are kept — shown as-is.
  // Surface any failed read — a query error rendering as "no jobs today" is
  // indistinguishable from a real empty day and can mean missed work.
  const readError = firstReadError(
    approvalNotificationsResult.error,
    todayJobsResult.error,
    completedTodayJobsResult.error,
    overdueJobsResult.error,
    unpaidJobsResult.error,
    tomorrowJobsResult.error,
    estimateVisitsResult.error,
    recentRecurringResult.error,
    recentCompletedJobsResult.error,
    websiteLeadsCountResult.error,
    manualLeadsCountResult.error,
    weekJobsResult.error,
    needsFollowUpResult.error,
    approvedEstimatesResult.error,
    upcomingRecurringJobsResult.error,
    alertSnoozesResult.error,
  )

  const gapSnoozedIds = new Set(
    (alertSnoozesResult.data ?? []).filter(s => s.alert_type === 'recurring_gap').map(s => s.customer_id)
  )
  const dormantSnoozedIds = new Set(
    (alertSnoozesResult.data ?? []).filter(s => s.alert_type === 'dormant').map(s => s.customer_id)
  )

  const approvalNotifications = (approvalNotificationsResult.data ?? []).filter(n => {
    const estRaw = (n as unknown as { estimates?: { status: string } | { status: string }[] | null }).estimates
    const est = Array.isArray(estRaw) ? estRaw[0] : estRaw
    return est?.status !== 'converted'
  })
  const todayJobs = todayJobsResult.data
  // Drive order: time-window buckets + nearest-neighbor from home base.
  // Card order below matches the Route button's turn-by-turn order.
  const orderedTodayJobs = orderStopsForRoute(todayJobs ?? [], j => {
    const p = (Array.isArray(j.properties) ? j.properties[0] : j.properties) as { latitude: number | null; longitude: number | null } | null
    return {
      coord: p?.latitude != null && p.longitude != null
        ? { latitude: Number(p.latitude), longitude: Number(p.longitude) }
        : null,
      timeWindow: (j.scheduled_time_window as string | null) ?? null,
    }
  }, homeBaseCoord)
  const todayRouteUrl = buildRouteUrl(
    orderedTodayJobs
      .map(j => {
        const p = (Array.isArray(j.properties) ? j.properties[0] : j.properties) as { service_address: string; city: string | null } | null
        return p ? `${p.service_address}${p.city ? ', ' + p.city : ''}` : ''
      })
      .filter(Boolean),
    homeBaseOrigin
  )
  const completedTodayJobs = completedTodayJobsResult.data
  const overdueJobs = overdueJobsResult.data
  const unpaidJobs = unpaidJobsResult.data
  const tomorrowJobs = tomorrowJobsResult.data
  const estimateVisits = estimateVisitsResult.data
  const recentRecurring = recentRecurringResult.data
  const recentCompletedJobs = recentCompletedJobsResult.data
  const websiteLeadsCount = websiteLeadsCountResult.count
  const manualLeadsCount = manualLeadsCountResult.count
  const weekJobsCount = weekJobsResult.count ?? 0
  const weekJobRows = weekJobsResult.data ?? []
  const approvedEstimates = approvedEstimatesResult.data ?? []
  // Build sets of property/customer IDs that already have an upcoming active recurring job.
  // Used to suppress false positives in Needs Follow-up when the old completed job's
  // next_job_created_id was not set but a future job already exists for the same property.
  const upcomingRecurringJobs = upcomingRecurringJobsResult.data ?? []
  const upcomingPropertyIds = new Set(
    upcomingRecurringJobs
      .filter(j => j.property_id != null)
      .map(j => j.property_id as string)
  )
  const upcomingCustomerIds = new Set(
    upcomingRecurringJobs
      .filter(j => j.customer_id != null)
      .map(j => j.customer_id as string)
  )
  const needsFollowUpJobs = (needsFollowUpResult.data ?? []).filter(job => {
    const propId = (job as { property_id?: string | null }).property_id ?? null
    const custId = (job as { customer_id?: string | null }).customer_id ?? null
    // Prefer property-level match; fall back to customer-level for jobs without a property
    if (propId != null) return !upcomingPropertyIds.has(propId)
    if (custId != null) return !upcomingCustomerIds.has(custId)
    return true
  })

  // Fetch weather — two-phase coordinate resolution:
  // Phase 1: use stored lat/lon from the DB when available.
  // Phase 2: for properties that have an address but no stored coordinates,
  //          geocode transiently via Nominatim (30-day Next.js fetch cache).
  //          Results are never written back to Supabase.
  type JobCoord = { lat: number; lon: number }
  const jobCoordMap = new Map<string, JobCoord>()

  for (const j of todayJobs ?? []) {
    const p = (Array.isArray(j.properties) ? j.properties[0] : j.properties) as {
      latitude: number | null; longitude: number | null
      service_address: string; city: string | null; state: string | null; postal_code: string | null
    } | null
    if (p?.latitude != null && p.longitude != null) {
      jobCoordMap.set(j.id as string, { lat: p.latitude, lon: p.longitude })
    }
  }

  // Geocode any jobs whose property has an address but no stored coordinates.
  await Promise.all(
    (todayJobs ?? [])
      .filter(j => {
        if (jobCoordMap.has(j.id as string)) return false
        const p = (Array.isArray(j.properties) ? j.properties[0] : j.properties) as { service_address?: string | null } | null
        return !!p?.service_address
      })
      .map(async j => {
        const p = (Array.isArray(j.properties) ? j.properties[0] : j.properties) as {
          service_address: string; city: string | null; state: string | null; postal_code: string | null
        } | null
        if (!p?.service_address) return
        const geo = await geocodeAddress({
          address: p.service_address,
          city: p.city,
          state: p.state,
          postalCode: p.postal_code,
        })
        if (geo) jobCoordMap.set(j.id as string, { lat: geo.latitude, lon: geo.longitude })
      })
  )

  const coords = Array.from(jobCoordMap.values())
  const weatherMap = coords.length > 0 ? await getTodayForecastForCoords(coords) : new Map()
  const anyRainToday = Array.from(weatherMap.values()).some(fc => fc.precipChance >= 40 || fc.precipInches >= 0.05)

  let gapCustomers: { id: string; name: string }[] = []
  if (recentRecurring && recentRecurring.length > 0) {
    // Deduplicate to unique ACTIVE customers — inactive/archived customers are
    // intentionally excluded from retention alerts.
    const uniqueMap = new Map<string, string>()
    for (const row of recentRecurring) {
      const cid = row.customer_id as string
      if (!uniqueMap.has(cid)) {
        const raw = row.customers
        const c = (Array.isArray(raw) ? raw[0] : raw) as { first_name: string; last_name: string | null; status: string } | null
        if (!c || c.status !== 'active') continue
        uniqueMap.set(cid, `${c.first_name}${c.last_name ? ' ' + c.last_name : ''}`)
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
      .in('status', ['scheduled', 'in_progress', 'needs_reschedule'])
    const coveredIds = new Set((upcomingJobs ?? []).map(j => j.customer_id as string))
    gapCustomers = recurringIds
      .filter(id => !coveredIds.has(id))
      .filter(id => !gapSnoozedIds.has(id))
      .map(id => ({ id, name: uniqueMap.get(id)! }))
  }

  let dormantCustomers: { id: string; name: string; daysSince: number }[] = []
  if (recentCompletedJobs && recentCompletedJobs.length > 0) {
    const lastVisitMap = new Map<string, { name: string; date: Date }>()
    for (const row of recentCompletedJobs) {
      const cid = row.customer_id as string
      const raw = row.customers
      const c = (Array.isArray(raw) ? raw[0] : raw) as { id: string; first_name: string; last_name: string | null; status: string } | null
      if (!c || !row.completed_at) continue
      if (c.status !== 'active') continue
      const d = new Date(row.completed_at)
      const existing = lastVisitMap.get(cid)
      if (!existing || d > existing.date) {
        lastVisitMap.set(cid, { name: `${c.first_name}${c.last_name ? ' ' + c.last_name : ''}`, date: d })
      }
    }
    dormantCustomers = [...lastVisitMap.entries()]
      .map(([id, { name, date }]) => ({ id, name, daysSince: Math.floor((todayStartMs - date.getTime()) / 86400000) }))
      .filter(c => c.daysSince >= 60)
      .filter(c => !dormantSnoozedIds.has(c.id))
      .sort((a, b) => b.daysSince - a.daysSince)
      .slice(0, 5) // cap at 5 to avoid wall of text
  }

  const todayTotal = (todayJobs ?? []).reduce((s, j) => s + (j.price ?? 0), 0)
  const unpaidTotal = (unpaidJobs ?? []).reduce((s, j) => s + (calcJobBalance(j) ?? 0), 0)
  // Collected today: sum amount_paid from completed-today jobs (not_billable contributes 0 naturally)
  const collectedTodayRevenue = (completedTodayJobs ?? []).reduce((s, j) => s + Number(j.amount_paid ?? 0), 0)
  // This week expected revenue: sum price from scheduled/in-progress/needs-reschedule jobs this week
  const expectedWeekRevenue = weekJobRows.reduce((s, j) => s + Number((j as { price?: number | null }).price ?? 0), 0)

  const newLeadsCount = (websiteLeadsCount ?? 0) + (manualLeadsCount ?? 0)

  // Show '10+' when query limit is hit so operator knows the list may be truncated
  const overdueDisplayCount = overdueJobs?.length === 10 ? '10+' : String(overdueJobs?.length ?? 0)
  const unpaidDisplayCount  = unpaidJobs?.length  === 10 ? '10+' : String(unpaidJobs?.length  ?? 0)

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Today</h1>
          <p className="page-subtitle">{formatDateOnly(today, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      <ReadErrorNotice message={readError} />

      <EstimateApprovalNotifications notifications={(approvalNotifications ?? []) as AppNotification[]} />

      <RainBanner show={anyRainToday} />

      <RecurringGapAlert customers={gapCustomers} />

      <DormantCustomersAlert customers={dormantCustomers} />

      <StatsGrid
        todayJobsCount={todayJobs?.length ?? 0}
        todayTotal={todayTotal}
        newLeadsCount={newLeadsCount}
        overdueCount={overdueJobs?.length ?? 0}
        overdueDisplayCount={overdueDisplayCount}
        completedTodayCount={completedTodayJobs?.length ?? 0}
        collectedTodayRevenue={collectedTodayRevenue}
        weekJobsCount={weekJobsCount}
        expectedWeekRevenue={expectedWeekRevenue}
        unpaidTotal={unpaidTotal}
      />

      <TodayJobsSection
        jobs={orderedTodayJobs}
        routeUrl={todayRouteUrl}
        jobCoordMap={jobCoordMap}
        weatherMap={weatherMap}
        smsMode={smsMode}
      />

      <EstimateVisitsSection visits={estimateVisits ?? []} smsMode={smsMode} />

      <OverdueSection
        jobs={overdueJobs ?? []}
        displayCount={overdueDisplayCount}
        todayStartMs={todayStartMs}
        today={today}
      />

      <CompletedTodaySection jobs={completedTodayJobs ?? []} timeZone={timeZone} />

      <TomorrowSection jobs={tomorrowJobs ?? []} tomorrowStr={tomorrowStr} smsMode={smsMode} />

      <NeedsFollowUpSection jobs={needsFollowUpJobs} todayStartMs={todayStartMs} timeZone={timeZone} />

      <ApprovedEstimatesSection estimates={approvedEstimates} timeZone={timeZone} />

      <UnpaidSection
        jobs={unpaidJobs ?? []}
        displayCount={unpaidDisplayCount}
        unpaidTotal={unpaidTotal}
        timeZone={timeZone}
        smsMode={smsMode}
      />
    </div>
  )
}

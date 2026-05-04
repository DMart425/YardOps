import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/push'

export async function GET(req: NextRequest) {
  // Verify the request is from Vercel Cron (or an authorized caller)
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()

  // Read timezone from settings so "today" matches the user's local date
  const { data: tzRow } = await admin.from('pricing_settings').select('time_zone').limit(1).single()
  const timeZone = tzRow?.time_zone ?? 'America/Chicago'
  const today = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

  const { data: jobs } = await admin
    .from('jobs')
    .select(`
      id, title, status, price, scheduled_date,
      customers ( first_name, last_name ),
      properties ( service_address, city )
    `)
    .eq('scheduled_date', today)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true })

  // Today's estimate visits
  const { data: visitRows } = await admin
    .from('estimates')
    .select('id, visit_scheduled_time, customers ( first_name, last_name )')
    .eq('visit_scheduled_date', today)
    .not('status', 'in', '("converted","declined")')

  const visits = visitRows ?? []

  if ((!jobs || jobs.length === 0) && visits.length === 0) {
    // No jobs today — still send a ping so you know it's running
    await notifyAllUsers(admin, {
      title: '☀️ YardOps — No jobs today',
      body: 'Nothing scheduled for today. Enjoy the day off!',
      url: '/today',
      tag: 'morning-summary',
    })
    return NextResponse.json({ sent: true, jobs: 0 })
  }

  const safeJobs = jobs ?? []
  const total = safeJobs.reduce((s, j) => s + Number(j.price ?? 0), 0)
  const names = safeJobs.map((j) => {
    const raw = j.customers
    const c = (Array.isArray(raw) ? raw[0] : raw) as { first_name: string; last_name: string | null } | null
    return c ? c.first_name : 'Job'
  })

  const jobPart =
    safeJobs.length === 1
      ? `1 job: ${names[0]}`
      : safeJobs.length > 1
        ? `${safeJobs.length} jobs: ${names.slice(0, 3).join(', ')}${safeJobs.length > 3 ? ` +${safeJobs.length - 3} more` : ''}`
        : ''

  const visitPart = visits.length > 0
    ? `${visits.length} estimate visit${visits.length === 1 ? '' : 's'}`
    : ''

  const body = [jobPart ? `${jobPart} · $${total.toFixed(2)}` : null, visitPart].filter(Boolean).join(' · ')

  const titleParts: string[] = []
  if (safeJobs.length > 0) titleParts.push(`${safeJobs.length} job${safeJobs.length === 1 ? '' : 's'}`)
  if (visits.length > 0) titleParts.push(`${visits.length} estimate visit${visits.length === 1 ? '' : 's'}`)

  await notifyAllUsers(admin, {
    title: `☀️ Good morning — ${titleParts.join(' + ')} today`,
    body,
    url: '/today',
    tag: 'morning-summary',
  })

  return NextResponse.json({ sent: true, jobs: safeJobs.length, visits: visits.length, total })
}

async function notifyAllUsers(
  admin: ReturnType<typeof createAdminClient>,
  payload: Parameters<typeof sendPushToUser>[1],
) {
  // Get all distinct user IDs that have push subscriptions
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('user_id')

  if (!subs) return

  const userIds = [...new Set(subs.map((s) => s.user_id))]
  await Promise.all(userIds.map((uid) => sendPushToUser(uid, payload)))
}

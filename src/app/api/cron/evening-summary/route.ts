import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/push'
import { getLocalDateStr, resolveTimeZone } from '@/lib/date'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()

  // Read timezone from settings so "today" matches the user's local date
  const { data: tzRow } = await admin.from('pricing_settings').select('time_zone').limit(1).single()
  const timeZone = resolveTimeZone(tzRow?.time_zone)
  const today = getLocalDateStr(timeZone)

  const { data: jobs } = await admin
    .from('jobs')
    .select('id, status, price, payment_status, customers(first_name)')
    .eq('scheduled_date', today)
    .neq('status', 'cancelled')

  const safeJobs = jobs ?? []
  const completed  = safeJobs.filter(j => j.status === 'completed')
  const skipped    = safeJobs.filter(j => j.status === 'skipped')
  const remaining  = safeJobs.filter(j => j.status === 'scheduled' || j.status === 'in_progress')
  const unpaid     = completed.filter(j => j.payment_status === 'unpaid' || j.payment_status === 'partial')
  const earned     = completed.reduce((s, j) => s + Number(j.price ?? 0), 0)

  if (safeJobs.length === 0) {
    await notifyAllUsers(admin, {
      title: '🌇 End of Day',
      body: 'No jobs were scheduled today.',
      url: '/today',
      tag: 'evening-summary',
    })
    return NextResponse.json({ sent: true, completed: 0 })
  }

  const parts: string[] = []
  parts.push(`${completed.length} job${completed.length === 1 ? '' : 's'} completed`)
  if (earned > 0) parts.push(`$${earned.toFixed(0)} earned`)
  if (unpaid.length > 0) parts.push(`${unpaid.length} unpaid`)
  if (skipped.length > 0) parts.push(`${skipped.length} skipped`)
  if (remaining.length > 0) parts.push(`${remaining.length} still open`)

  await notifyAllUsers(admin, {
    title: `🌇 Day complete — ${completed.length}/${safeJobs.length} jobs done`,
    body: parts.join(' · '),
    url: '/today',
    tag: 'evening-summary',
  })

  return NextResponse.json({ sent: true, completed: completed.length, earned })
}

async function notifyAllUsers(
  admin: ReturnType<typeof createAdminClient>,
  payload: Parameters<typeof sendPushToUser>[1],
) {
  const { data: subs } = await admin.from('push_subscriptions').select('user_id')
  if (!subs) return
  const userIds = [...new Set(subs.map(s => s.user_id))]
  await Promise.all(userIds.map(uid => sendPushToUser(uid, payload)))
}

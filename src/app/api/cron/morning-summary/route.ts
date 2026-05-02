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

  // Today's date in local time — jobs are stored as YYYY-MM-DD
  const today = new Date().toLocaleDateString('en-CA') // "YYYY-MM-DD"

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

  if (!jobs || jobs.length === 0) {
    // No jobs today — still send a ping so you know it's running
    await notifyAllUsers(admin, {
      title: '☀️ YardOps — No jobs today',
      body: 'Nothing scheduled for today. Enjoy the day off!',
      url: '/today',
      tag: 'morning-summary',
    })
    return NextResponse.json({ sent: true, jobs: 0 })
  }

  const total = jobs.reduce((s, j) => s + Number(j.price ?? 0), 0)
  const names = jobs.map((j) => {
    const raw = j.customers
    const c = (Array.isArray(raw) ? raw[0] : raw) as { first_name: string; last_name: string | null } | null
    return c ? c.first_name : 'Job'
  })

  const body =
    jobs.length === 1
      ? `1 job: ${names[0]} · $${total.toFixed(2)}`
      : `${jobs.length} jobs: ${names.slice(0, 3).join(', ')}${jobs.length > 3 ? ` +${jobs.length - 3} more` : ''} · $${total.toFixed(2)}`

  await notifyAllUsers(admin, {
    title: `☀️ Good morning — ${jobs.length} job${jobs.length === 1 ? '' : 's'} today`,
    body,
    url: '/today',
    tag: 'morning-summary',
  })

  return NextResponse.json({ sent: true, jobs: jobs.length, total })
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

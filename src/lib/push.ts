import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

let configured = false
function configure() {
  if (configured) return
  const publicKey  = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys are not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.')
  }
  webpush.setVapidDetails(
    'mailto:support@wicksburglawnservice.com',
    publicKey,
    privateKey,
  )
  configured = true
}

export interface PushPayload {
  title: string
  body:  string
  url?:  string
  tag?:  string
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number; removed: number }> {
  configure()
  const admin = createAdminClient()

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) return { sent: 0, failed: 0, removed: 0 }

  let sent = 0
  let failed = 0
  let removed = 0

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          JSON.stringify(payload),
        )
        sent++
        await admin
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', s.id)
      } catch (err: unknown) {
        failed++
        // 404 = unsubscribed, 410 = gone — remove from DB
        const statusCode = (err as { statusCode?: number })?.statusCode
        if (statusCode === 404 || statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('id', s.id)
          removed++
        }
      }
    }),
  )

  return { sent, failed, removed }
}

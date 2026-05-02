import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPushToUser } from '@/lib/push'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const result = await sendPushToUser(user.id, {
    title: '🧪 YardOps test',
    body:  'Push notifications are working! Tap to open.',
    url:   '/today',
    tag:   'test',
  })

  return NextResponse.json(result)
}

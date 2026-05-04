'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { MessageType } from '@/types/database'

export async function deleteEstimate(estimateId: string) {
  const supabase = await createClient()
  await supabase.from('estimates').delete().eq('id', estimateId)
  redirect('/estimates')
}

export async function updateEstimateStatus(estimateId: string, status: string) {
  const supabase = await createClient()
  await supabase.from('estimates').update({ status }).eq('id', estimateId)
  revalidatePath('/estimates')
  revalidatePath(`/estimates/${estimateId}`)
}

export async function logSmsSent(estimateId: string, customerId: string, body: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: customer } = await supabase
    .from('customers')
    .select('phone')
    .eq('id', customerId)
    .single()

  await supabase.from('message_logs').insert({
    user_id: user.id,
    estimate_id: estimateId,
    customer_id: customerId,
    message_type: 'estimate_follow_up' as MessageType,
    recipient_phone: customer?.phone ?? null,
    message_body: body,
    delivery_method: 'sms',
    manually_marked_sent: true,
    sent_at: new Date().toISOString(),
  })
}

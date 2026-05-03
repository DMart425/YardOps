'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

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

  await supabase.from('message_logs').insert({
    estimate_id: estimateId,
    customer_id: customerId,
    channel: 'sms',
    body,
    sent_by: user?.id ?? null,
  })
}

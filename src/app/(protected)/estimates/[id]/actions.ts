'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { FormState, MessageType } from '@/types/database'

function val(formData: FormData, key: string): string {
  return ((formData.get(key) as string) ?? '').trim()
}

export async function deleteEstimate(
  estimateId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  void prevState
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (val(formData, 'delete_confirmation') !== 'DELETE') {
    return { error: 'Type DELETE to confirm estimate deletion.' }
  }

  const { data: estimate, error: estimateError } = await supabase
    .from('estimates')
    .select('id, created_by, status, customer_id, property_id')
    .eq('id', estimateId)
    .eq('created_by', user.id)
    .maybeSingle()

  if (estimateError || !estimate) {
    return { error: 'Estimate not found.' }
  }

  const { error: deleteItemsError } = await supabase
    .from('estimate_items')
    .delete()
    .eq('created_by', user.id)
    .eq('estimate_id', estimateId)

  if (deleteItemsError) {
    return { error: 'Unable to delete estimate line items right now. Please try again.' }
  }

  const { error: deleteEstimateError } = await supabase
    .from('estimates')
    .delete()
    .eq('created_by', user.id)
    .eq('id', estimateId)

  if (deleteEstimateError) {
    return { error: 'Unable to delete estimate right now. Please try again.' }
  }

  revalidatePath('/estimates')
  if (estimate.customer_id) revalidatePath(`/customers/${estimate.customer_id}`)
  if (estimate.property_id) revalidatePath(`/properties/${estimate.property_id}`)
  redirect('/estimates')
}

export async function updateEstimateStatus(estimateId: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const updates: Record<string, unknown> = { status }
  if (status === 'sent') {
    updates.last_sent_at = new Date().toISOString()
  }
  if (status === 'approved') {
    updates.accepted_at = new Date().toISOString()
  }
  if (status === 'draft') {
    updates.accepted_at = null
  }

  await supabase
    .from('estimates')
    .update(updates)
    .eq('id', estimateId)
    .eq('created_by', user.id)

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

'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export interface AcceptState {
  success?: boolean
  error?: string
}

export async function acceptEstimate(
  prevState: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const token      = (formData.get('token') as string)?.trim()
  const firstName  = (formData.get('first_name') as string)?.trim()
  const lastName   = (formData.get('last_name') as string)?.trim() || null
  const phone      = (formData.get('phone') as string)?.trim() || null
  const email      = (formData.get('email') as string)?.trim() || null
  const accessNotes = (formData.get('access_notes') as string)?.trim() || null

  if (!token)     return { error: 'Invalid link.' }
  if (!firstName) return { error: 'Name is required.' }

  const supabase = createAdminClient()

  // 1. Fetch estimate by token
  const { data: estimate } = await supabase
    .from('estimates')
    .select('id, status, valid_until, customer_id, property_id')
    .eq('public_token', token)
    .single()

  if (!estimate) return { error: 'Estimate not found. The link may be invalid.' }

  if (estimate.status === 'approved' || estimate.status === 'converted') {
    return { error: 'This estimate has already been accepted.' }
  }
  if (estimate.status === 'declined') {
    return { error: 'This estimate was declined.' }
  }
  if (estimate.status === 'expired') {
    return { error: 'This estimate has expired.' }
  }
  if (estimate.valid_until) {
    const expiry = new Date(estimate.valid_until + 'T23:59:59')
    if (expiry < new Date()) {
      // Also mark as expired in DB
      await supabase
        .from('estimates')
        .update({ status: 'expired' })
        .eq('id', estimate.id)
      return { error: 'This estimate has expired.' }
    }
  }

  // 2. Update customer details
  await supabase
    .from('customers')
    .update({
      first_name: firstName,
      last_name:  lastName,
      phone,
      email,
    })
    .eq('id', estimate.customer_id)

  // 3. Flip lead → active
  const { data: customer } = await supabase
    .from('customers')
    .select('status')
    .eq('id', estimate.customer_id)
    .single()

  if (customer?.status === 'lead') {
    await supabase
      .from('customers')
      .update({ status: 'active' })
      .eq('id', estimate.customer_id)
  }

  // 4. Update property access notes
  if (accessNotes !== null) {
    await supabase
      .from('properties')
      .update({ access_notes: accessNotes })
      .eq('id', estimate.property_id)
  }

  // 5. Mark estimate approved
  await supabase
    .from('estimates')
    .update({ status: 'approved', accepted_at: new Date().toISOString() })
    .eq('id', estimate.id)

  revalidatePath('/estimates')
  revalidatePath('/leads')
  revalidatePath('/customers')

  return { success: true }
}

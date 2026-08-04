'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireBusinessContext } from '@/lib/business/context'

// Verifies the customer belongs to the caller's business. Tokens must never be
// mintable for arbitrary customer UUIDs (cross-tenant IDOR guard).
async function verifyCustomerOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerId: string,
  businessId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('business_id', businessId)
    .maybeSingle()
  return data != null
}

export async function getOrCreatePortalToken(customerId: string): Promise<{ token: string } | { error: string }> {
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  if (!(await verifyCustomerOwnership(supabase, customerId, businessId))) {
    return { error: 'Customer not found.' }
  }

  // Upsert: create token if none exists, return existing if already there
  const { data, error } = await supabase
    .from('customer_portal_tokens')
    .upsert(
      { customer_id: customerId, business_id: businessId, created_by: userId },
      { onConflict: 'customer_id', ignoreDuplicates: true }
    )
    .select('token')
    .single()

  if (error || !data) {
    // Upsert with ignoreDuplicates returns nothing on conflict — fetch existing
    const { data: existing, error: fetchError } = await supabase
      .from('customer_portal_tokens')
      .select('token')
      .eq('customer_id', customerId)
      .eq('business_id', businessId)
      .single()

    if (fetchError || !existing) return { error: 'Could not generate portal link.' }
    return { token: existing.token }
  }

  return { token: data.token }
}

// Invalidates the customer's current portal link and mints a fresh token.
// Use when a link was forwarded or leaked — the old URL stops working
// immediately. The new token comes from the column default
// (gen_random_bytes(32) hex).
export async function regeneratePortalToken(customerId: string): Promise<{ token: string } | { error: string }> {
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  if (!(await verifyCustomerOwnership(supabase, customerId, businessId))) {
    return { error: 'Customer not found.' }
  }

  const { error: deleteError } = await supabase
    .from('customer_portal_tokens')
    .delete()
    .eq('customer_id', customerId)
    .eq('business_id', businessId)

  if (deleteError) return { error: 'Could not revoke the old portal link.' }

  const { data, error } = await supabase
    .from('customer_portal_tokens')
    .insert({ customer_id: customerId, business_id: businessId, created_by: userId })
    .select('token')
    .single()

  if (error || !data) return { error: 'Old link revoked, but a new link could not be created. Try again.' }

  revalidatePath(`/customers/${customerId}`)
  return { token: data.token }
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { requireBusinessContext } from '@/lib/business/context'

export async function getOrCreatePortalToken(customerId: string): Promise<{ token: string } | { error: string }> {
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

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

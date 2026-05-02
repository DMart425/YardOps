'use server'

import { createClient } from '@/lib/supabase/server'

export async function getOrCreatePortalToken(customerId: string): Promise<{ token: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // Upsert: create token if none exists, return existing if already there
  const { data, error } = await supabase
    .from('customer_portal_tokens')
    .upsert(
      { customer_id: customerId, created_by: user.id },
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
      .single()

    if (fetchError || !existing) return { error: 'Could not generate portal link.' }
    return { token: existing.token }
  }

  return { token: data.token }
}

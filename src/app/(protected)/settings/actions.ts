'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { FormState } from '@/types/database'

export async function saveSettings(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const parse = (key: string, fallback: number) => {
    const n = parseFloat(formData.get(key) as string ?? '')
    return isNaN(n) ? fallback : n
  }

  const target_hourly_rate   = parse('target_hourly_rate', 65)
  const minimum_price        = parse('minimum_price', 55)
  const round_to_nearest     = parse('round_to_nearest', 5)
  const default_setup_minutes = parse('default_setup_minutes', 10)
  const venmo_handle         = (formData.get('venmo_handle') as string ?? '').trim().replace(/^@/, '') || null

  const { error } = await supabase
    .from('pricing_settings')
    .upsert({
      user_id:              user.id,
      target_hourly_rate,
      minimum_price,
      round_to_nearest,
      default_setup_minutes,
      venmo_handle,
    }, { onConflict: 'user_id' })

  if (error) return { error: error.message }

  revalidatePath('/settings')
  return { error: null, success: 'Settings saved.' }
}

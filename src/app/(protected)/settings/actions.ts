'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { FormState } from '@/types/database'
import { resolveTimeZone } from '@/lib/date'
import { requireBusinessContext } from '@/lib/business/context'
import { formatPhoneInput } from '@/lib/format'

export async function saveSettings(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const parse = (key: string, fallback: number) => {
    const n = parseFloat(formData.get(key) as string ?? '')
    return isNaN(n) ? fallback : n
  }

  const target_hourly_rate    = parse('target_hourly_rate', 65)
  const minimum_price         = parse('minimum_price', 55)
  const round_to_nearest      = parse('round_to_nearest', 5)
  const default_setup_minutes = parse('default_setup_minutes', 10)
  const venmo_handle          = (formData.get('venmo_handle') as string ?? '').trim().replace(/^@/, '') || null
  const rawTimeZone           = (formData.get('time_zone') as string ?? '').trim()
  const time_zone             = resolveTimeZone(rawTimeZone)
  const rawPhone              = (formData.get('business_phone') as string ?? '').trim()
  const business_phone        = rawPhone ? formatPhoneInput(rawPhone) : null

  const [settingsResult, businessResult] = await Promise.all([
    supabase
      .from('pricing_settings')
      .upsert({
        user_id: userId,
        target_hourly_rate,
        minimum_price,
        round_to_nearest,
        default_setup_minutes,
        venmo_handle,
        time_zone,
      }, { onConflict: 'user_id' }),
    supabase
      .from('businesses')
      .update({ phone: business_phone })
      .eq('id', businessId),
  ])

  if (settingsResult.error) return { error: settingsResult.error.message }
  if (businessResult.error) return { error: businessResult.error.message }

  revalidatePath('/settings')
  return { error: null, success: 'Settings saved.', savedAt: Date.now() }
}

export async function addBlackoutDate(date: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Invalid date.' }

  const { data: existing } = await supabase
    .from('pricing_settings')
    .select('blackout_dates')
    .eq('user_id', user.id)
    .single()

  const current: string[] = (existing?.blackout_dates as string[] | null) ?? []
  if (current.includes(date)) return {}

  const { error } = await supabase
    .from('pricing_settings')
    .upsert({ user_id: user.id, blackout_dates: [...current, date] }, { onConflict: 'user_id' })

  if (error) return { error: error.message }
  revalidatePath('/settings')
  revalidatePath('/jobs')
  return {}
}

export async function removeBlackoutDate(date: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: existing } = await supabase
    .from('pricing_settings')
    .select('blackout_dates')
    .eq('user_id', user.id)
    .single()

  const current: string[] = (existing?.blackout_dates as string[] | null) ?? []
  const updated = current.filter(d => d !== date)

  const { error } = await supabase
    .from('pricing_settings')
    .upsert({ user_id: user.id, blackout_dates: updated }, { onConflict: 'user_id' })

  if (error) return { error: error.message }
  revalidatePath('/settings')
  revalidatePath('/jobs')
  return {}
}

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
  const time_zone            = (formData.get('time_zone') as string ?? '').trim() || 'America/Chicago'

  const { error } = await supabase
    .from('pricing_settings')
    .upsert({
      user_id:              user.id,
      target_hourly_rate,
      minimum_price,
      round_to_nearest,
      default_setup_minutes,
      venmo_handle,
      time_zone,
    }, { onConflict: 'user_id' })

  if (error) return { error: error.message }

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

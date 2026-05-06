'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { FormState } from '@/types/database'

function val(formData: FormData, key: string): string {
  return ((formData.get(key) as string) ?? '').trim()
}

export async function markNotificationReviewed(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  void prevState
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const notificationId = val(formData, 'notification_id')
  if (!notificationId) {
    return { error: 'Notification not found.' }
  }

  const { error } = await supabase
    .from('app_notifications')
    .update({
      is_reviewed: true,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', notificationId)
    .eq('user_id', user.id)
    .eq('notification_type', 'estimate_approved')

  if (error) {
    return { error: 'Could not mark notification reviewed.' }
  }

  revalidatePath('/', 'layout')
  revalidatePath('/today')
  revalidatePath('/estimates')
  return { error: null }
}
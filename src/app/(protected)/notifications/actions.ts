'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { FormState } from '@/types/database'
import { requireBusinessContext } from '@/lib/business/context'

function val(formData: FormData, key: string): string {
  return ((formData.get(key) as string) ?? '').trim()
}

export async function markNotificationReviewed(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  void prevState
  const supabase = await createClient()
  const { userId } = await requireBusinessContext()

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
    .eq('user_id', userId)
    .eq('notification_type', 'estimate_approved')

  if (error) {
    return { error: 'Could not mark notification reviewed.' }
  }

  revalidatePath('/', 'layout')
  revalidatePath('/today')
  revalidatePath('/estimates')
  return { error: null }
}
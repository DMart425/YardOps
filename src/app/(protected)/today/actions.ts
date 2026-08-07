'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireBusinessContext } from '@/lib/business/context'
import { addDays, getLocalDateStr, resolveTimeZone } from '@/lib/date'

export type SnoozeAlertType = 'recurring_gap' | 'dormant'

const SNOOZE_DAYS = 7

// Hides one customer from one Today retention alert for SNOOZE_DAYS.
// Snoozing again extends from today (upsert on customer_id + alert_type).
// Permanent removal is "Mark Inactive" on the customer page — not this.
export async function snoozeCustomerAlert(
  customerId: string,
  alertType: SnoozeAlertType,
  _formData?: FormData
): Promise<void> {
  void _formData
  if (alertType !== 'recurring_gap' && alertType !== 'dormant') {
    throw new Error('Invalid alert type.')
  }

  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  // Ownership validation: the customer must belong to this business.
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('business_id', businessId)
    .maybeSingle()
  if (!customer) throw new Error('Customer not found.')

  // Snooze window anchors on the business-local date, matching the alert queries.
  const { data: tzRow } = await supabase
    .from('pricing_settings')
    .select('time_zone')
    .eq('user_id', userId)
    .maybeSingle()
  const today = getLocalDateStr(resolveTimeZone(tzRow?.time_zone))
  const snoozedUntil = addDays(today, SNOOZE_DAYS)

  const { error } = await supabase
    .from('customer_alert_snoozes')
    .upsert(
      {
        business_id:   businessId,
        customer_id:   customerId,
        alert_type:    alertType,
        snoozed_until: snoozedUntil,
        created_by:    userId,
      },
      { onConflict: 'customer_id,alert_type' }
    )

  if (error) throw new Error('Could not snooze this alert. Please try again.')

  revalidatePath('/today')
}

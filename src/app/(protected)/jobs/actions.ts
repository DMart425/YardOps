'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { FormState } from '@/types/database'
import { requireBusinessContext } from '@/lib/business/context'

// Derives a service_package code from a property's individual service booleans.
// Used as a fallback when neither the parent job nor default_service_package is set.
function deriveServicePackageFromBooleans(prop: {
  default_mowing_enabled?: boolean | null
  default_weed_eating_enabled?: boolean | null
  default_edging_enabled?: boolean | null
  default_blow_off_enabled?: boolean | null
} | null): string | null {
  if (!prop) return null
  const hasMow  = !!prop.default_mowing_enabled
  const hasWeed = !!prop.default_weed_eating_enabled
  const hasEdge = !!prop.default_edging_enabled
  const hasBlow = !!prop.default_blow_off_enabled
  if (!hasMow && !hasWeed && !hasEdge && !hasBlow) return null
  if (hasMow && !hasWeed && !hasEdge && !hasBlow) return 'mow_only'
  if (hasMow && hasWeed && !hasEdge && hasBlow)   return 'mow_trim_blow'
  if (!hasMow && (hasWeed || hasEdge || hasBlow)) return 'trim_cleanup'
  if (hasMow  && (hasWeed || hasEdge || hasBlow)) return 'full_service'
  return null
}

type JobRescheduleFields = {
  reschedule_count: number | null
  reschedule_log: string | null
  scheduled_date: string | null
  scheduled_time_window: string | null
}

export async function createJob(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const customerId = formData.get('customer_id') as string
  const propertyId  = formData.get('property_id') as string
  if (!customerId) return { error: 'Please select a customer.' }
  if (!propertyId)  return { error: 'Please select a property.' }

  const priceRaw = formData.get('price') as string
  const price    = priceRaw ? parseFloat(priceRaw) : null

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      created_by:            userId,
      business_id:           businessId,
      customer_id:           customerId,
      property_id:           propertyId,
      title:                 'Lawn Service',
      job_type:              (formData.get('job_type') as string) || 'one_time',
      service_package:       (formData.get('service_package') as string) || null,
      scheduled_date:        (formData.get('scheduled_date') as string) || null,
      scheduled_time_window: (formData.get('scheduled_time_window') as string) || null,
      price:                 price && !isNaN(price) ? price : null,
      payment_status:        (formData.get('payment_status') as string) || 'unpaid',
      internal_notes:        (formData.get('internal_notes') as string)?.trim() || null,
      status:                'scheduled',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/jobs')
  revalidatePath('/today')
  redirect(`/jobs/${job.id}`)
}

export async function completeJob(
  id: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const { businessId } = await requireBusinessContext()

  // Fetch existing job to complete
  const { data: existing } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .eq('business_id', businessId)
    .single()

  if (!existing) return { error: 'Job not found.' }

  const priceRaw = formData.get('price') as string
  const price    = priceRaw ? parseFloat(priceRaw) : existing.price

  // Compute actual minutes: prefer manual override, else compute from started_at
  const minutesRaw = formData.get('actual_minutes') as string
  let actualMinutes: number | null = null
  if (minutesRaw) {
    const m = parseInt(minutesRaw, 10)
    if (!isNaN(m) && m >= 0) actualMinutes = m
  } else if (existing.started_at) {
    const elapsedMs = Date.now() - new Date(existing.started_at).getTime()
    actualMinutes = Math.max(1, Math.round(elapsedMs / 60000))
  }

  const { error } = await supabase
    .from('jobs')
    .update({
      status:           'completed',
      completed_at:     new Date().toISOString(),
      actual_minutes:   actualMinutes,
      completion_notes: (formData.get('completion_notes') as string)?.trim() || null,
      payment_status:   (formData.get('payment_status') as string) || 'unpaid',
      payment_method:   (formData.get('payment_method') as string) || null,
      price:            price && !isNaN(price) ? price : existing.price,
    })
    .eq('id', id)
    .eq('business_id', businessId)

  if (error) return { error: error.message }

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${id}`)
  revalidatePath('/today')
  return { error: null, success: 'Job completed.' }
}

export async function scheduleFollowUpJob(
  id: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const { data: existing } = await supabase
    .from('jobs')
    .select('*, properties(default_price, default_service_package, default_mowing_enabled, default_weed_eating_enabled, default_edging_enabled, default_blow_off_enabled)')
    .eq('id', id)
    .eq('business_id', businessId)
    .single()

  if (!existing) return { error: 'Job not found.' }
  if (existing.status !== 'completed') return { error: 'Follow-up visits can only be scheduled from completed jobs.' }

  if (existing.next_job_created_id) {
    return { error: null, success: 'A follow-up visit already exists for this job.' }
  }

  const nextDate = (formData.get('next_scheduled_date') as string)?.trim() || ''
  if (!nextDate) return { error: 'Next visit date is required.' }

  const nextTimeWindowRaw = (formData.get('next_time_window') as string)?.trim() || ''
  const customNextTimeWindow = (formData.get('custom_next_time_window') as string)?.trim() || ''
  if (nextTimeWindowRaw === 'custom' && !customNextTimeWindow) {
    return { error: 'Custom next visit time window is required.' }
  }
  const storedNextTimeWindow = nextTimeWindowRaw === 'custom' ? customNextTimeWindow : nextTimeWindowRaw || null

  const { data: nextJob, error: nextJobError } = await supabase
    .from('jobs')
    .insert({
      created_by:            userId,
      business_id:           businessId,
      customer_id:           existing.customer_id,
      property_id:           existing.property_id,
      title:                 existing.title,
      job_type:              'recurring',
      service_package:       existing.service_package
                               ?? existing.properties?.default_service_package
                               ?? deriveServicePackageFromBooleans(existing.properties)
                               ?? null,
      scheduled_date:        nextDate,
      scheduled_time_window: storedNextTimeWindow,
      price:                 existing.price ?? existing.properties?.default_price ?? null,
      payment_status:        'unpaid',
      status:                'scheduled',
      recurrence_source:     id,
    })
    .select('id')
    .single()

  if (nextJobError || !nextJob) {
    return { error: nextJobError?.message ?? 'Could not create follow-up visit.' }
  }

  const { error: linkErr } = await supabase
    .from('jobs')
    .update({ next_job_created_id: nextJob.id })
    .eq('id', id)
    .eq('business_id', businessId)

  if (linkErr) {
    return { error: `Follow-up visit created, but link update failed: ${linkErr.message}` }
  }

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${id}`)
  revalidatePath('/today')

  return { error: null, success: 'Follow-up visit scheduled.' }
}

export async function markInProgress(
  id: string,
  prevState: FormState,
  _formData: FormData
): Promise<FormState> {
  void prevState
  void _formData
  const supabase = await createClient()
  const { businessId } = await requireBusinessContext()

  const { data: updated, error } = await supabase
    .from('jobs')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', id)
    .eq('business_id', businessId)
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!updated) return { error: 'Job not found.' }

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${id}`)
  revalidatePath('/today')
  return { error: null, success: 'Job started.' }
}

export async function skipJob(
  id: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const { businessId } = await requireBusinessContext()

  const { data: updated, error } = await supabase
    .from('jobs')
    .update({
      status:         'skipped',
      skipped_reason: (formData.get('reason') as string)?.trim() || null,
    })
    .eq('id', id)
    .eq('business_id', businessId)
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!updated) return { error: 'Job not found.' }

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${id}`)
  revalidatePath('/today')
  return { error: null, success: 'Job skipped.' }
}

export async function cancelJob(
  id: string,
  prevState: FormState,
  _formData: FormData
): Promise<FormState> {
  void prevState
  void _formData
  const supabase = await createClient()
  const { businessId } = await requireBusinessContext()

  const { data: updated, error } = await supabase
    .from('jobs')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('business_id', businessId)
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!updated) return { error: 'Job not found.' }

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${id}`)
  revalidatePath('/today')
  return { error: null, success: 'Job cancelled.' }
}

export async function markPaid(
  id: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const { businessId } = await requireBusinessContext()

  // Fetch current price so we can set amount_paid
  const { data: job } = await supabase
    .from('jobs')
    .select('price')
    .eq('id', id)
    .eq('business_id', businessId)
    .single()

  const { error } = await supabase
    .from('jobs')
    .update({
      payment_status: 'paid',
      payment_method: (formData.get('payment_method') as string) || null,
      amount_paid: job?.price ?? null,
    })
    .eq('id', id)
    .eq('business_id', businessId)

  if (error) return { error: error.message }

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${id}`)
  revalidatePath('/today')
  revalidatePath('/finances')
  return { error: null, success: 'Marked as paid.' }
}

export async function markPartial(
  id: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const { businessId } = await requireBusinessContext()

  const amountPaid = parseFloat(formData.get('amount_paid') as string)
  if (isNaN(amountPaid) || amountPaid <= 0) return { error: 'Enter a valid amount.' }

  const { data: updated, error } = await supabase
    .from('jobs')
    .update({
      payment_status: 'partial',
      payment_method: (formData.get('payment_method') as string) || null,
      amount_paid: amountPaid,
    })
    .eq('id', id)
    .eq('business_id', businessId)
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!updated) return { error: 'Job not found.' }

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${id}`)
  revalidatePath('/today')
  revalidatePath('/finances')
  return { error: null, success: `Partial payment of $${amountPaid.toFixed(0)} recorded.` }
}

export async function rescheduleJob(
  id: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const { businessId } = await requireBusinessContext()

  const newDate = (formData.get('new_date') as string)?.trim()
  if (!newDate) return { error: 'Please pick a new date.' }

  const reasonCode  = (formData.get('reason_code') as string)?.trim() || ''
  if (!reasonCode) return { error: 'Please select a reason.' }

  const customReason = (formData.get('custom_reason') as string)?.trim() || ''
  if (reasonCode === 'other' && !customReason) return { error: 'Please describe the reason.' }

  const timeWindowRaw = (formData.get('new_time_window') as string)?.trim() || ''
  const customTimeWin = (formData.get('custom_time_window') as string)?.trim() || ''
  if (timeWindowRaw === 'custom' && !customTimeWin) return { error: 'Please enter a custom time window.' }

  // Determine stored time window value (empty string = Anytime)
  const storedTimeWindow = timeWindowRaw === 'custom' ? customTimeWin : timeWindowRaw

  // Determine display label for reason
  const REASON_LABELS: Record<string, string> = {
    rain_weather:         'Rain / Weather',
    customer_requested:   'Customer requested',
    equipment_issue:      'Equipment issue',
    access_issue:         'Access issue / gate / pets',
    unavailable_operator: 'Owner/operator unavailable',
    yard_not_ready:       'Yard not ready',
    route_change:         'Route change',
  }
  const reasonLabel = reasonCode === 'other' ? customReason : (REASON_LABELS[reasonCode] ?? reasonCode)

  // Fetch current job state
  const { data: existingRaw } = await supabase
    .from('jobs')
    .select('reschedule_count, reschedule_log, scheduled_date, scheduled_time_window')
    .eq('id', id)
    .eq('business_id', businessId)
    .single()

  const existing = existingRaw as JobRescheduleFields | null
  if (!existing) return { error: 'Job not found.' }

  // Build readable log entry
  const today = new Date().toISOString().split('T')[0]
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const oldTimeLabel = existing.scheduled_time_window ? ` ${cap(existing.scheduled_time_window)}` : ''
  const newTimeLabel = storedTimeWindow ? ` ${cap(storedTimeWindow)}` : ''
  const logEntry = `${today}: Rescheduled from ${existing.scheduled_date ?? '?'}${oldTimeLabel} to ${newDate}${newTimeLabel}. Reason: ${reasonLabel}.`
  const newLog   = existing.reschedule_log ? `${existing.reschedule_log}\n${logEntry}` : logEntry
  const newCount = (existing.reschedule_count ?? 0) + 1

  const { error } = await supabase
    .from('jobs')
    .update({
      status:                'scheduled',
      scheduled_date:        newDate,
      scheduled_time_window: storedTimeWindow || null,
      started_at:            null,
      rescheduled_from:      existing.scheduled_date,
      reschedule_count:      newCount,
      reschedule_log:        newLog,
    })
    .eq('id', id)
    .eq('business_id', businessId)

  if (error) return { error: error.message }

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${id}`)
  revalidatePath('/today')
  return { error: null, success: `Rescheduled to ${newDate}.` }
}

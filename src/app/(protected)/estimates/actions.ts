'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { FormState } from '@/types/database'

// ── helpers ────────────────────────────────────────────────────────────────
function str(fd: FormData, key: string) {
  const v = (fd.get(key) as string)?.trim()
  return v || null
}
function num(fd: FormData, key: string) {
  const v = fd.get(key) as string
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}

// ── createEstimate ──────────────────────────────────────────────────────────
export async function createEstimate(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const customerId = str(formData, 'customer_id')
  const propertyId = str(formData, 'property_id')
  if (!customerId) return { error: 'Please select a customer.' }
  if (!propertyId)  return { error: 'Please select a property.' }

  // Parse structured inputs from the pricing engine form
  let estimateInputs: Record<string, unknown> | null = null
  try {
    const raw = formData.get('estimate_inputs_json') as string
    if (raw) estimateInputs = JSON.parse(raw)
  } catch {
    return { error: 'Invalid estimate inputs.' }
  }

  if (!estimateInputs) return { error: 'Missing estimate inputs.' }

  const finalEstimate    = parseFloat(formData.get('final_estimate') as string ?? '0')
  const estimatedMinutes = parseInt(formData.get('estimated_minutes') as string ?? '0')
  const frequency        = str(formData, 'frequency') ?? 'weekly'

  const { data: estimate, error } = await supabase
    .from('estimates')
    .insert({
      created_by:        user.id,
      customer_id:       customerId,
      property_id:       propertyId,
      status:            'draft',
      frequency,
      valid_until:       str(formData, 'valid_until'),
      notes:             str(formData, 'notes'),
      subtotal:          finalEstimate,
      total:             finalEstimate,
      estimated_minutes: estimatedMinutes,
      estimate_inputs:   estimateInputs,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/estimates')
  redirect(`/estimates/${estimate.id}`)
}

// ── convertToJob ────────────────────────────────────────────────────────────
export async function convertToJob(
  estimateId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: estimate } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', estimateId)
    .eq('created_by', user.id)
    .single()

  if (!estimate) return { error: 'Estimate not found.' }

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      created_by:      user.id,
      customer_id:     estimate.customer_id,
      property_id:     estimate.property_id,
      estimate_id:     estimateId,
      title:           'Lawn Service',
      job_type:        'one_time',
      scheduled_date:  str(formData, 'scheduled_date'),
      price:           estimate.total,
      payment_status:  'unpaid',
      status:          'scheduled',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // Mark estimate converted
  await supabase
    .from('estimates')
    .update({ status: 'converted' })
    .eq('id', estimateId)

  // Promote lead → active customer now that they've accepted
  await supabase
    .from('customers')
    .update({ status: 'active' })
    .eq('id', estimate.customer_id)
    .eq('status', 'lead')

  revalidatePath('/estimates')
  revalidatePath('/jobs')
  revalidatePath('/leads')
  redirect(`/jobs/${job.id}`)
}

// ── updateEstimateStatus ────────────────────────────────────────────────────
export async function updateEstimateStatus(
  estimateId: string,
  status: string,
  prevState: FormState,
  _formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('estimates')
    .update({ status })
    .eq('id', estimateId)
    .eq('created_by', user.id)

  if (error) return { error: error.message }

  revalidatePath('/estimates')
  revalidatePath(`/estimates/${estimateId}`)
  return { error: null, success: `Marked as ${status}.` }
}

// ── scheduleEstimateVisit ────────────────────────────────────────────────────
export async function scheduleEstimateVisit(
  estimateId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const visitDate = str(formData, 'visit_date')
  const visitTime = str(formData, 'visit_time')

  if (!visitDate) return { error: 'Please select a date.' }

  const { error } = await supabase
    .from('estimates')
    .update({ visit_scheduled_date: visitDate, visit_scheduled_time: visitTime })
    .eq('id', estimateId)
    .eq('created_by', user.id)

  if (error) return { error: error.message }

  revalidatePath('/estimates')
  revalidatePath(`/estimates/${estimateId}`)
  revalidatePath('/today')
  return { error: null, success: 'Visit scheduled.' }
}

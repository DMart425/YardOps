'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { FormState } from '@/types/database'
import { calculateEstimate, formatMinutes, type EstimateInputs } from '@/lib/pricing'

// ── helpers ────────────────────────────────────────────────────────────────
function str(fd: FormData, key: string) {
  const v = (fd.get(key) as string)?.trim()
  return v || null
}

type EstimatePayload = {
  customer_id: string
  property_id: string
  frequency: string
  valid_until: string | null
  notes: string | null
  subtotal: number
  total: number
  estimated_minutes: number
  estimate_inputs: Record<string, unknown>
}

type EstimatePayloadParseResult =
  | { payload: EstimatePayload }
  | { error: string }

type JobScope = {
  title: string
  servicePackage: string | null
  internalNotes: string
}

function deriveJobScopeFromEstimate(estimate: { estimate_inputs: Record<string, unknown> | null; estimated_minutes: number | null }): JobScope {
  const rawInputs = estimate.estimate_inputs
  if (!rawInputs) {
    return {
      title: 'Lawn Service',
      servicePackage: null,
      internalNotes: 'Estimate Scope:\n- Service details unavailable on this estimate.',
    }
  }

  try {
    const result = calculateEstimate(rawInputs as unknown as EstimateInputs)
    const { breakdown, lineItems, totalMinutes } = result

    const coreServices: string[] = []
    if (breakdown.mowingMinutes > 0) coreServices.push('Mow')
    if (breakdown.weedEatingMinutes > 0) coreServices.push('Weed Eat')
    if (breakdown.edgingMinutes > 0) coreServices.push('Edge')
    if (breakdown.blowOffMinutes > 0) coreServices.push('Blow Off')

    const serviceSummary = coreServices.length > 0 ? coreServices.join(', ') : 'Standard Service'
    const title = coreServices.length > 0 ? `Lawn Service - ${serviceSummary}` : 'Lawn Service'

    const hasMow = breakdown.mowingMinutes > 0
    const hasWeed = breakdown.weedEatingMinutes > 0
    const hasEdge = breakdown.edgingMinutes > 0
    const hasBlow = breakdown.blowOffMinutes > 0

    let servicePackage: string | null = null
    if (hasMow && !hasWeed && !hasEdge && !hasBlow) servicePackage = 'mow_only'
    else if (hasMow && hasWeed && !hasEdge && hasBlow) servicePackage = 'mow_trim_blow'
    else if (!hasMow && (hasWeed || hasEdge || hasBlow)) servicePackage = 'trim_cleanup'
    else if (hasMow && (hasWeed || hasEdge || hasBlow)) servicePackage = 'full_service'

    const checklist = [
      'Estimate Scope:',
      `- Core services: ${serviceSummary}`,
      `- Estimated time: ${formatMinutes(Math.max(estimate.estimated_minutes ?? totalMinutes, 0))}`,
    ]

    lineItems
      .filter(item => item.isAddOn)
      .forEach(item => {
        checklist.push(`- Add-on: ${item.label}${item.price != null ? ` (+$${item.price.toFixed(2)})` : ''}`)
      })

    if (breakdown.obstacleMinutes > 0) {
      checklist.push(`- Extra obstacle time: ${breakdown.obstacleMinutes} min`)
    }

    return {
      title,
      servicePackage,
      internalNotes: checklist.join('\n'),
    }
  } catch {
    return {
      title: 'Lawn Service',
      servicePackage: null,
      internalNotes: 'Estimate Scope:\n- Unable to parse estimate scope details.',
    }
  }
}

function parseEstimatePayload(formData: FormData): EstimatePayloadParseResult {
  let estimateInputs: Record<string, unknown> | null = null
  try {
    const raw = formData.get('estimate_inputs_json') as string
    if (raw) estimateInputs = JSON.parse(raw)
  } catch {
    return { error: 'Invalid estimate inputs.' }
  }

  if (!estimateInputs) return { error: 'Missing estimate inputs.' }

  const customerId = str(formData, 'customer_id')
  const propertyId = str(formData, 'property_id')
  if (!customerId) return { error: 'Please select a customer.' }
  if (!propertyId) return { error: 'Please select a property.' }

  const finalEstimate = parseFloat(formData.get('final_estimate') as string ?? '0')
  const estimatedMinutes = parseInt(formData.get('estimated_minutes') as string ?? '0')
  const frequency = str(formData, 'frequency') ?? 'weekly'

  return {
    payload: {
      customer_id: customerId,
      property_id: propertyId,
      frequency,
      valid_until: str(formData, 'valid_until'),
      notes: str(formData, 'notes'),
      subtotal: finalEstimate,
      total: finalEstimate,
      estimated_minutes: estimatedMinutes,
      estimate_inputs: estimateInputs,
    },
  }
}

// ── createEstimate ──────────────────────────────────────────────────────────
export async function createEstimate(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  void prevState
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const parsed = parseEstimatePayload(formData)
  if ('error' in parsed) return { error: parsed.error }

  const { data: estimate, error } = await supabase
    .from('estimates')
    .insert({
      created_by:        user.id,
      status:            'draft',
      ...parsed.payload,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/estimates')
  redirect(`/estimates/${estimate.id}`)
}

export async function updateEstimate(
  estimateId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  void prevState
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const parsed = parseEstimatePayload(formData)
  if ('error' in parsed) return { error: parsed.error }

  const { error } = await supabase
    .from('estimates')
    .update(parsed.payload)
    .eq('id', estimateId)
    .eq('created_by', user.id)

  if (error) return { error: error.message }

  revalidatePath('/estimates')
  revalidatePath(`/estimates/${estimateId}`)
  redirect(`/estimates/${estimateId}`)
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

  const scope = deriveJobScopeFromEstimate(estimate)

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      created_by:      user.id,
      customer_id:     estimate.customer_id,
      property_id:     estimate.property_id,
      estimate_id:     estimateId,
      title:           scope.title,
      service_package: scope.servicePackage,
      job_type:        'one_time',
      scheduled_date:  str(formData, 'scheduled_date'),
      quoted_total:    estimate.total,
      price:           estimate.total,
      payment_status:  'unpaid',
      internal_notes:  scope.internalNotes,
      customer_notes:  estimate.notes,
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
  void prevState
  void _formData
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
  void prevState
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

export async function clearEstimateVisit(
  estimateId: string,
  prevState: FormState,
  _formData: FormData
): Promise<FormState> {
  void prevState
  void _formData
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('estimates')
    .update({ visit_scheduled_date: null, visit_scheduled_time: null })
    .eq('id', estimateId)
    .eq('created_by', user.id)

  if (error) return { error: error.message }

  revalidatePath('/estimates')
  revalidatePath(`/estimates/${estimateId}`)
  revalidatePath('/today')
  return { error: null, success: 'Visit cleared.' }
}

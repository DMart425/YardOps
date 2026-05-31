'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { FormState } from '@/types/database'
import { calculateEstimate, formatMinutes, type EstimateInputs } from '@/lib/pricing'
import { requireBusinessContext } from '@/lib/business/context'

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

type EstimatePayloadCore = {
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

type EstimatePayloadCoreParseResult =
  | { payload: EstimatePayloadCore }
  | { error: string }

type JobScope = {
  title: string
  servicePackage: string | null
  internalNotes: string
}

function deriveJobTypeFromFrequency(frequency: string | null): 'one_time' | 'recurring' {
  if (frequency === 'weekly' || frequency === 'biweekly') return 'recurring'
  return 'one_time'
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

function parseEstimatePayloadCore(formData: FormData): EstimatePayloadCoreParseResult {
  let estimateInputs: Record<string, unknown> | null = null
  try {
    const raw = formData.get('estimate_inputs_json') as string
    if (raw) estimateInputs = JSON.parse(raw)
  } catch {
    return { error: 'Invalid estimate inputs.' }
  }

  if (!estimateInputs) return { error: 'Missing estimate inputs.' }

  const finalEstimate = parseFloat(formData.get('final_estimate') as string ?? '0')
  const estimatedMinutes = parseInt(formData.get('estimated_minutes') as string ?? '0')
  const frequency = str(formData, 'frequency') ?? 'weekly'

  return {
    payload: {
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

function parseEstimatePayload(formData: FormData): EstimatePayloadParseResult {
  const parsedCore = parseEstimatePayloadCore(formData)
  if ('error' in parsedCore) return parsedCore

  const customerId = str(formData, 'customer_id')
  const propertyId = str(formData, 'property_id')
  if (!customerId) return { error: 'Please select a customer.' }
  if (!propertyId) return { error: 'Please select a property.' }

  return {
    payload: {
      customer_id: customerId,
      property_id: propertyId,
      ...parsedCore.payload,
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
  const { userId, businessId } = await requireBusinessContext()

  const parsed = parseEstimatePayload(formData)
  if ('error' in parsed) return { error: parsed.error }

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('id', parsed.payload.customer_id)
    .eq('business_id', businessId)
    .maybeSingle()

  if (customerError || !customer) {
    return { error: 'Please select an existing customer/contact.' }
  }

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('id, customer_id, status')
    .eq('id', parsed.payload.property_id)
    .eq('business_id', businessId)
    .maybeSingle()

  if (propertyError || !property) {
    return { error: 'Please select an existing property.' }
  }

  if (property.status !== 'active') {
    return { error: 'Please select an active property.' }
  }

  if (property.customer_id !== parsed.payload.customer_id) {
    return { error: 'Selected property does not belong to the selected customer.' }
  }

  const { data: estimate, error } = await supabase
    .from('estimates')
    .insert({
      created_by:  userId,
      business_id: businessId,
      status:      'draft',
      ...parsed.payload,
    })
    .select('id')
    .single()

  if (error) return { error: 'Could not create estimate. Please try again.' }

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
  const { businessId } = await requireBusinessContext()

  const parsed = parseEstimatePayload(formData)
  if ('error' in parsed) return { error: parsed.error }

  const { data: existingEstimate, error: existingEstimateError } = await supabase
    .from('estimates')
    .select('id, status, revision_number')
    .eq('id', estimateId)
    .eq('business_id', businessId)
    .maybeSingle()

  if (existingEstimateError || !existingEstimate) {
    return { error: 'Estimate not found.' }
  }

  if (existingEstimate.status === 'converted') {
    return { error: 'Converted estimates are locked and cannot be edited.' }
  }

  const revisionUpdate: Record<string, unknown> = {}
  if (existingEstimate.status === 'sent' || existingEstimate.status === 'approved') {
    revisionUpdate.revision_number = (existingEstimate.revision_number ?? 1) + 1
    revisionUpdate.last_revised_at = new Date().toISOString()
    revisionUpdate.status = 'draft'
    revisionUpdate.accepted_at = null
    revisionUpdate.approved_by_source = null
    revisionUpdate.manually_approved_at = null
    revisionUpdate.approval_note = null
  }

  const { error } = await supabase
    .from('estimates')
    .update({
      ...parsed.payload,
      ...revisionUpdate,
    })
    .eq('id', estimateId)
    .eq('business_id', businessId)

  if (error) return { error: error.message }

  revalidatePath('/estimates')
  revalidatePath(`/estimates/${estimateId}`)
  redirect(`/estimates/${estimateId}`)
}

export async function manuallyApproveEstimate(
  estimateId: string,
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  void prevState
  const supabase = await createClient()
  const { businessId } = await requireBusinessContext()

  const approvalNote = str(formData, 'approval_note')
  if (!approvalNote) {
    return { error: 'Approval note is required.' }
  }

  const { data: estimate, error: estimateError } = await supabase
    .from('estimates')
    .select('id, status')
    .eq('id', estimateId)
    .eq('business_id', businessId)
    .maybeSingle()

  if (estimateError || !estimate) return { error: 'Estimate not found.' }

  if (estimate.status === 'converted') {
    return { error: 'Converted estimates are locked.' }
  }

  const approvedAt = new Date().toISOString()
  const { error } = await supabase
    .from('estimates')
    .update({
      status: 'approved',
      accepted_at: approvedAt,
      approved_by_source: 'manual',
      manually_approved_at: approvedAt,
      approval_note: approvalNote,
    })
    .eq('id', estimateId)
    .eq('business_id', businessId)

  if (error) return { error: error.message }

  revalidatePath('/estimates')
  revalidatePath(`/estimates/${estimateId}`)
  revalidatePath('/today')
  return { error: null, success: 'Marked as approved.' }
}

// ── convertToJob ────────────────────────────────────────────────────────────
export async function convertToJob(
  estimateId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const { data: estimate } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', estimateId)
    .eq('business_id', businessId)
    .single()

  if (!estimate) return { error: 'Estimate not found.' }

  if (estimate.status === 'converted') {
    return { error: 'This estimate has already been converted to a job.' }
  }

  const scope = deriveJobScopeFromEstimate(estimate)

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      created_by:      userId,
      business_id:     businessId,
      customer_id:     estimate.customer_id,
      property_id:     estimate.property_id,
      estimate_id:     estimateId,
      title:              scope.title,
      service_package:    scope.servicePackage,
      job_type:           deriveJobTypeFromFrequency(estimate.frequency),
      scheduled_date:     str(formData, 'scheduled_date'),
      scheduled_time_window: str(formData, 'scheduled_time_window'),
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

  // Best-effort: save estimate total as property default price if operator checked the box.
  // Does not block conversion if this update fails.
  const saveAsDefault = formData.get('save_as_default_price') === 'on'
  if (saveAsDefault && estimate.property_id && estimate.total != null && Number(estimate.total) > 0) {
    await supabase
      .from('properties')
      .update({ default_price: estimate.total })
      .eq('id', estimate.property_id)
      .eq('business_id', businessId)
    revalidatePath(`/properties/${estimate.property_id}`)
  }

  // Mark estimate converted
  await supabase
    .from('estimates')
    .update({ status: 'converted' })
    .eq('id', estimateId)
    .eq('business_id', businessId)

  // Promote lead → active customer now that they've accepted
  await supabase
    .from('customers')
    .update({ status: 'active' })
    .eq('id', estimate.customer_id)
    .eq('business_id', businessId)
    .eq('status', 'lead')

  // Best-effort: clear any unreviewed approval notification so Today page
  // does not show a stale "approved" alert after conversion.
  await supabase
    .from('app_notifications')
    .update({ is_reviewed: true, reviewed_at: new Date().toISOString() })
    .eq('estimate_id', estimateId)
    .eq('is_reviewed', false)
    .eq('notification_type', 'estimate_approved')

  revalidatePath('/estimates')
  revalidatePath('/jobs')
  revalidatePath('/leads')
  revalidatePath('/today')
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
  const { businessId } = await requireBusinessContext()

  const { data: estimate, error: estimateError } = await supabase
    .from('estimates')
    .select('id, status')
    .eq('id', estimateId)
    .eq('business_id', businessId)
    .maybeSingle()

  if (estimateError || !estimate) return { error: 'Estimate not found.' }

  if (estimate.status === 'converted') {
    return { error: 'Converted estimates are locked.' }
  }

  const updates: Record<string, unknown> = { status }
  if (status === 'sent') {
    updates.last_sent_at = new Date().toISOString()
  }
  if (status === 'approved') {
    updates.accepted_at = new Date().toISOString()
  }
  if (status === 'draft') {
    updates.accepted_at = null
    updates.approved_by_source = null
    updates.manually_approved_at = null
    updates.approval_note = null
  }
  if (status !== 'approved') {
    updates.manually_approved_at = null
  }

  const { error } = await supabase
    .from('estimates')
    .update(updates)
    .eq('id', estimateId)
    .eq('business_id', businessId)

  if (error) return { error: error.message }

  revalidatePath('/estimates')
  revalidatePath(`/estimates/${estimateId}`)
  revalidatePath('/today')
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
  const { businessId } = await requireBusinessContext()

  const visitDate = str(formData, 'visit_date')
  const visitTime = str(formData, 'visit_time')

  if (!visitDate) return { error: 'Please select a date.' }

  const { error } = await supabase
    .from('estimates')
    .update({ visit_scheduled_date: visitDate, visit_scheduled_time: visitTime })
    .eq('id', estimateId)
    .eq('business_id', businessId)

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
  const { businessId } = await requireBusinessContext()

  const { error } = await supabase
    .from('estimates')
    .update({ visit_scheduled_date: null, visit_scheduled_time: null })
    .eq('id', estimateId)
    .eq('business_id', businessId)

  if (error) return { error: error.message }

  revalidatePath('/estimates')
  revalidatePath(`/estimates/${estimateId}`)
  revalidatePath('/today')
  return { error: null, success: 'Visit cleared.' }
}

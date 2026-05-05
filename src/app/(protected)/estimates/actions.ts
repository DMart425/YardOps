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

function num(fd: FormData, key: string) {
  const raw = str(fd, key)
  if (!raw) return null
  const n = parseFloat(raw)
  return Number.isNaN(n) ? null : n
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const parsedCore = parseEstimatePayloadCore(formData)
  if ('error' in parsedCore) return { error: parsedCore.error }

  const customerMode = (str(formData, 'customer_mode') === 'new') ? 'new' : 'existing'
  const propertyMode = (str(formData, 'property_mode') === 'new') ? 'new' : 'existing'

  let resolvedCustomerId = str(formData, 'customer_id')
  let resolvedPropertyId = str(formData, 'property_id')
  let createdCustomerId: string | null = null
  let createdPropertyId: string | null = null

  const rollbackAndError = async (message: string): Promise<FormState> => {
    if (createdPropertyId) {
      await supabase
        .from('properties')
        .delete()
        .eq('id', createdPropertyId)
        .eq('created_by', user.id)
    }
    if (createdCustomerId) {
      await supabase
        .from('customers')
        .delete()
        .eq('id', createdCustomerId)
        .eq('created_by', user.id)
    }
    return { error: message }
  }

  if (customerMode === 'existing') {
    if (!resolvedCustomerId) return { error: 'Please select a customer.' }
  } else {
    const firstName = str(formData, 'new_customer_first_name')
    const lastName = str(formData, 'new_customer_last_name')
    const phone = str(formData, 'new_customer_phone')
    const email = str(formData, 'new_customer_email')

    if (!firstName) return { error: 'Please enter a customer first name.' }
    if (!lastName) return { error: 'Please enter a customer last name.' }
    if (!phone) return { error: 'Please enter a customer phone number.' }

    const { data: existingCustomer, error: findCustomerError } = await supabase
      .from('customers')
      .select('id')
      .eq('created_by', user.id)
      .eq('phone', phone)
      .maybeSingle()

    if (findCustomerError) return { error: 'Unable to verify existing customer by phone right now.' }

    if (existingCustomer?.id) {
      resolvedCustomerId = existingCustomer.id
    } else {
      const { data: createdCustomer, error: createCustomerError } = await supabase
        .from('customers')
        .insert({
          created_by: user.id,
          first_name: firstName,
          last_name: lastName,
          phone,
          email,
          status: 'lead',
        })
        .select('id')
        .single()

      if (createCustomerError || !createdCustomer) {
        return { error: 'Could not create customer. Please try again.' }
      }

      createdCustomerId = createdCustomer.id
      resolvedCustomerId = createdCustomer.id
    }
  }

  if (propertyMode === 'existing') {
    if (!resolvedPropertyId) return { error: 'Please select a property.' }

    const { data: existingProperty, error: findPropertyError } = await supabase
      .from('properties')
      .select('id, customer_id')
      .eq('id', resolvedPropertyId)
      .eq('created_by', user.id)
      .maybeSingle()

    if (findPropertyError || !existingProperty) {
      return await rollbackAndError('Selected property was not found.')
    }

    if (customerMode === 'existing' && existingProperty.customer_id !== resolvedCustomerId) {
      return await rollbackAndError('Selected property does not belong to the selected customer.')
    }

    if (customerMode === 'new') {
      const reassignmentConfirmed = str(formData, 'property_reassignment_confirmed') === 'true'
      if (!reassignmentConfirmed) {
        return await rollbackAndError('Please confirm property reassignment by checking the confirmation box.')
      }
    }
  } else {
    if (!resolvedCustomerId) return await rollbackAndError('Missing customer for new property.')

    const serviceAddress = str(formData, 'new_property_service_address')
    const city = str(formData, 'new_property_city')
    const county = str(formData, 'new_property_county')
    const state = (str(formData, 'new_property_state') ?? 'AL').toUpperCase()
    const parcelAcres = num(formData, 'new_property_parcel_acres')
    const mowableAcres = num(formData, 'new_property_estimated_mowable_acres')

    if (!serviceAddress) return await rollbackAndError('Please enter a property street address.')
    if (!city) return await rollbackAndError('Please enter a property city.')
    if (!county) return await rollbackAndError('Please enter a property county.')
    if (!state) return await rollbackAndError('Please enter a property state.')

    // Check if this address already exists anywhere for current user (decision matrix: property duplicate detection)
    const { data: existingPropertyAnywhere, error: findPropertyError } = await supabase
      .from('properties')
      .select('id, customer_id')
      .eq('created_by', user.id)
      .eq('service_address', serviceAddress)
      .eq('city', city)
      .eq('state', state)
      .maybeSingle()

    if (findPropertyError) {
      return await rollbackAndError('Unable to verify existing property right now.')
    }

    if (existingPropertyAnywhere?.id) {
      // Property already exists somewhere
      if (existingPropertyAnywhere.customer_id === resolvedCustomerId) {
        // Reuse existing property linked to this customer
        resolvedPropertyId = existingPropertyAnywhere.id
      } else {
        // Property exists under a different customer
        return await rollbackAndError('Property already exists. Switch to Existing Property if this is a tenant/customer turnover.')
      }
    } else {
      // Property doesn't exist, create it
      const { data: createdProperty, error: createPropertyError } = await supabase
        .from('properties')
        .insert({
          created_by: user.id,
          customer_id: resolvedCustomerId,
          service_address: serviceAddress,
          city,
          county,
          state,
          parcel_acres: parcelAcres,
          estimated_mowable_acres: mowableAcres,
          lot_size_source: 'manual',
          status: 'active',
        })
        .select('id')
        .single()

      if (createPropertyError || !createdProperty) {
        return await rollbackAndError('Could not create property. Please try again.')
      }

      createdPropertyId = createdProperty.id
      resolvedPropertyId = createdProperty.id
    }
  }

  if (!resolvedCustomerId) return await rollbackAndError('Missing customer selection.')
  if (!resolvedPropertyId) return await rollbackAndError('Missing property selection.')

  // Handle property reassignment for New Customer + Existing Property
  if (customerMode === 'new' && propertyMode === 'existing') {
    const { error: updatePropertyError } = await supabase
      .from('properties')
      .update({ customer_id: resolvedCustomerId })
      .eq('id', resolvedPropertyId)
      .eq('created_by', user.id)

    if (updatePropertyError) {
      return await rollbackAndError('Could not update property. Please try again.')
    }
  }

  const { data: estimate, error } = await supabase
    .from('estimates')
    .insert({
      created_by:        user.id,
      status:            'draft',
      customer_id:       resolvedCustomerId,
      property_id:       resolvedPropertyId,
      ...parsedCore.payload,
    })
    .select('id')
    .single()

  if (error) return await rollbackAndError('Could not create estimate. Please try again.')

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

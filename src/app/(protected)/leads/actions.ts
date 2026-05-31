'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { FormState } from '@/types/database'
import { geocodeAddress } from '@/lib/geocode'
import { formatFrequencyLabel } from '@/lib/frequency'
import { requireBusinessContext } from '@/lib/business/context'

function str(fd: FormData, key: string) {
  const v = (fd.get(key) as string)?.trim()
  return v || null
}

function num(fd: FormData, key: string) {
  const raw = (fd.get(key) as string | null)?.trim()
  if (!raw) return null
  const parsed = parseFloat(raw)
  return Number.isNaN(parsed) ? null : parsed
}

function required(fd: FormData, key: string, label: string): string | { error: string } {
  const value = ((fd.get(key) as string | null) ?? '').trim()
  if (!value) return { error: `${label} is required.` }
  return value
}

function buildLeadIntakeNotes(args: {
  existingNotes: string | null
  sourceLabel: string
  intakeAddress?: string | null
  requestedFrequency?: string | null
  requestedPackage?: string | null
}) {
  const { existingNotes, sourceLabel, intakeAddress, requestedFrequency, requestedPackage } = args
  const lines: string[] = []

  if (intakeAddress) lines.push(`Intake address: ${intakeAddress}`)
  if (requestedFrequency) lines.push(`Requested frequency: ${requestedFrequency}`)
  if (requestedPackage) lines.push(`Requested package: ${requestedPackage}`)

  if (!lines.length) return existingNotes

  const intakeBlock = `${sourceLabel} intake details:\n- ${lines.join('\n- ')}`
  return existingNotes ? `${existingNotes}\n\n${intakeBlock}` : intakeBlock
}

// ── createLead ──────────────────────────────────────────────────────────────
// Creates a manual lead/contact with a full property: customer (status='lead') + properties row
export async function createLead(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  void prevState
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const firstName = str(formData, 'first_name')
  if (!firstName) return { error: 'First name is required.' }

  const serviceAddress = required(formData, 'service_address', 'Street address')
  if (typeof serviceAddress !== 'string') return serviceAddress
  const city = required(formData, 'city', 'City')
  if (typeof city !== 'string') return city
  const state = required(formData, 'state', 'State')
  if (typeof state !== 'string') return state
  const county = required(formData, 'county', 'County')
  if (typeof county !== 'string') return county

  const postalCode = str(formData, 'postal_code')
  const serviceFrequency = str(formData, 'service_frequency') ?? 'one_time'

  // Individual service selections (checkboxes — present in FormData only when checked)
  const svcMowing    = formData.get('svc_mowing')    === 'true'
  const svcWeedEating = formData.get('svc_weed_eating') === 'true'
  const svcEdging    = formData.get('svc_edging')    === 'true'
  const svcBlowOff   = formData.get('svc_blow_off')  === 'true'

  // Build a human-readable service summary for the intake notes
  const selectedServices = [
    svcMowing     && 'Mowing',
    svcWeedEating && 'Weed eating / trimming',
    svcEdging     && 'Edging',
    svcBlowOff    && 'Blow off walkways / driveway / patio',
  ].filter(Boolean).join(', ')

  const intakeAddress = [serviceAddress, city, state, postalCode].filter(Boolean).join(', ')
  const requestedFrequency = str(formData, 'service_frequency')
  const notes = buildLeadIntakeNotes({
    existingNotes: str(formData, 'notes'),
    sourceLabel: 'Manual lead',
    intakeAddress,
    requestedFrequency,
    requestedPackage: selectedServices || null,
  })

  const { data: customer, error: custError } = await supabase
    .from('customers')
    .insert({
      created_by: userId,
      business_id: businessId,
      first_name: firstName,
      last_name: str(formData, 'last_name'),
      phone: str(formData, 'phone'),
      email: str(formData, 'email'),
      notes,
      status: 'lead',
    })
    .select('id')
    .single()

  if (custError) return { error: custError.message }

  const geo = await geocodeAddress({
    address: serviceAddress,
    city,
    state,
    postalCode,
  })

  const { error: propError } = await supabase
    .from('properties')
    .insert({
      created_by: userId,
      business_id: businessId,
      customer_id: customer.id,
      property_name: str(formData, 'property_name'),
      service_address: serviceAddress,
      city,
      state,
      postal_code: postalCode,
      county,
      latitude: geo?.latitude ?? null,
      longitude: geo?.longitude ?? null,
      parcel_id: str(formData, 'parcel_id'),
      parcel_acres: num(formData, 'parcel_acres'),
      estimated_mowable_acres: num(formData, 'estimated_mowable_acres'),
      lot_size_source: str(formData, 'lot_size_source') ?? 'manual',
      default_mowing_enabled: svcMowing,
      default_weed_eating_enabled: svcWeedEating,
      default_edging_enabled: svcEdging,
      default_blow_off_enabled: svcBlowOff,
      service_frequency: serviceFrequency,
      preferred_service_day: str(formData, 'preferred_service_day'),
      access_notes: str(formData, 'access_notes'),
      obstacle_notes: str(formData, 'obstacle_notes'),
      parking_notes: str(formData, 'parking_notes'),
      internal_notes: str(formData, 'internal_notes'),
      status: 'active',
      auto_schedule_next: false,
    })

  if (propError) {
    const { error: rollbackError } = await supabase
      .from('customers')
      .delete()
      .eq('id', customer.id)
      .eq('business_id', businessId)

    if (rollbackError) {
      return { error: `Property save failed after lead creation and automatic rollback failed: ${propError.message}` }
    }
    return { error: `Property save failed. Lead was not created. ${propError.message}` }
  }

  revalidatePath('/leads')
  revalidatePath('/properties')
  redirect(`/leads/${customer.id}`)
}

// ── convertWebsiteLead ──────────────────────────────────────────────────────
// Converts a website `leads` table row → customer/contact (status='lead') only
export async function convertWebsiteLead(
  leadId: string,
  prevState: FormState,
  _formData: FormData
): Promise<FormState> {
  void prevState
  void _formData
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  // Claim the lead first to make conversion idempotent across repeated clicks/races.
  const { data: claimedLead, error: claimError } = await supabase
    .from('leads')
    .update({ status: 'converted', created_by: userId })
    .eq('id', leadId)
    .eq('business_id', businessId)
    .eq('status', 'new')
    .select('id, name, phone, email, address, frequency, notes')
    .maybeSingle()

  if (claimError) return { error: claimError.message }

  if (!claimedLead) {
    const { data: existingLead, error: existingLeadError } = await supabase
      .from('leads')
      .select('status')
      .eq('id', leadId)
      .eq('business_id', businessId)
      .maybeSingle()

    if (existingLeadError) return { error: existingLeadError.message }
    if (!existingLead) return { error: 'Lead not found.' }

    if (existingLead.status === 'converted') {
      return { error: 'This website lead was already converted.' }
    }

    return { error: `This website lead cannot be converted from status "${existingLead.status ?? 'unknown'}".` }
  }

  // Split name into first/last
  const parts = (claimedLead.name as string).trim().split(' ')
  const firstName = parts[0] ?? 'Unknown'
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : null

  const notes = buildLeadIntakeNotes({
    existingNotes: claimedLead.notes ?? null,
    sourceLabel: 'Website lead',
    intakeAddress: claimedLead.address ?? null,
    requestedFrequency: claimedLead.frequency
      ? formatFrequencyLabel(claimedLead.frequency)
      : null,
  })

  const { data: customer, error: custError } = await supabase
    .from('customers')
    .insert({
      created_by: userId,
      business_id: businessId,
      first_name: firstName,
      last_name: lastName,
      phone: claimedLead.phone ?? null,
      email: claimedLead.email ?? null,
      notes,
      status: 'lead',
    })
    .select('id')
    .single()

  if (custError) {
    // Best-effort rollback to allow retried conversion if customer insert fails.
    await supabase
      .from('leads')
      .update({ status: 'new', created_by: null })
      .eq('id', leadId)
      .eq('business_id', businessId)
      .eq('status', 'converted')

    return { error: custError.message }
  }

  revalidatePath('/leads')
  redirect(`/leads/${customer.id}`)
}

// ── archiveLead ─────────────────────────────────────────────────────────────
// Archives a manual lead (sets customer.status='archived')
export async function archiveLead(
  customerId: string,
  prevState: FormState,
  _formData: FormData
): Promise<FormState> {
  void prevState
  void _formData
  const supabase = await createClient()
  const { businessId } = await requireBusinessContext()

  const { data: updated, error } = await supabase
    .from('customers')
    .update({ status: 'archived' })
    .eq('id', customerId)
    .eq('business_id', businessId)
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!updated) return { error: 'Lead not found.' }

  revalidatePath('/leads')
  redirect('/leads')
}

// ── dismissWebsiteLead ──────────────────────────────────────────────────────
// Dismisses a website lead without creating a customer
export async function dismissWebsiteLead(
  leadId: string,
  prevState: FormState,
  _formData: FormData
): Promise<FormState> {
  void prevState
  void _formData
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const { error } = await supabase
    .from('leads')
    .update({ status: 'archived', created_by: userId })
    .eq('id', leadId)
    .eq('business_id', businessId)

  if (error) return { error: error.message }

  revalidatePath('/leads')
  redirect('/leads')
}

// ── deleteWebsiteLead ───────────────────────────────────────────────────────
// Hard-deletes a single website lead row
export async function deleteWebsiteLead(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  void _prevState
  const supabase = await createClient()
  const { businessId } = await requireBusinessContext()

  const leadId = formData.get('lead_id') as string
  if (!leadId) return { error: 'Missing lead ID.' }
  const deleteConfirmation = (formData.get('delete_confirmation') as string | null)?.trim()

  if (deleteConfirmation !== 'DELETE') {
    return { error: 'Type DELETE to permanently remove this website lead.' }
  }

  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', leadId)
    .eq('business_id', businessId)

  if (error) return { error: error.message }

  revalidatePath('/leads')
  redirect('/leads')
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { FormState } from '@/types/database'
import { geocodeAddress } from '@/lib/geocode'

function str(formData: FormData, key: string): string | null {
  const v = (formData.get(key) as string)?.trim()
  return v || null
}

function num(formData: FormData, key: string): number | null {
  const v = formData.get(key) as string
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

export async function createProperty(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const customerId = str(formData, 'customer_id')
  if (!customerId) return { error: 'Please select a customer.' }

  const address = (formData.get('service_address') as string).trim()
  const city = str(formData, 'city')
  const state = str(formData, 'state') ?? 'AL'
  const postalCode = str(formData, 'postal_code')

  // Geocode the address (best-effort, non-blocking on failure)
  const geo = await geocodeAddress({ address, city, state, postalCode })

  const { data: property, error } = await supabase.from('properties').insert({
    created_by: user.id,
    customer_id: customerId,
    property_name: str(formData, 'property_name'),
    service_address: address,
    city,
    state,
    postal_code: postalCode,
    county: str(formData, 'county'),
    latitude: geo?.latitude ?? null,
    longitude: geo?.longitude ?? null,
    parcel_acres: num(formData, 'parcel_acres'),
    estimated_mowable_acres: num(formData, 'estimated_mowable_acres'),
    lot_size_source: str(formData, 'lot_size_source') ?? 'manual',
    default_service_package: str(formData, 'default_service_package'),
    default_price: num(formData, 'default_price'),
    service_frequency: (formData.get('service_frequency') as string) || 'one_time',
    preferred_service_day: str(formData, 'preferred_service_day'),
    auto_schedule_next: formData.get('auto_schedule_next') === 'on',
    gate_code: str(formData, 'gate_code'),
    pet_warning: str(formData, 'pet_warning'),
    access_notes: str(formData, 'access_notes'),
    obstacle_notes: str(formData, 'obstacle_notes'),
    parking_notes: str(formData, 'parking_notes'),
    internal_notes: str(formData, 'internal_notes'),
    status: (formData.get('status') as string) || 'active',
  }).select('id').single()

  if (error) return { error: error.message }

  revalidatePath('/properties')
  revalidatePath(`/customers/${customerId}`)
  redirect(`/properties/${property.id}`)
}

export async function updateProperty(
  id: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const customerId = str(formData, 'customer_id')
  if (!customerId) return { error: 'Please select a customer.' }

  const address = (formData.get('service_address') as string).trim()
  const city = str(formData, 'city')
  const state = str(formData, 'state') ?? 'AL'
  const postalCode = str(formData, 'postal_code')

  // If property has no lat/lon yet, geocode it now
  const { data: existing } = await supabase
    .from('properties')
    .select('latitude, longitude')
    .eq('id', id)
    .single()
  let geoUpdate: { latitude?: number; longitude?: number } = {}
  if (!existing?.latitude || !existing?.longitude) {
    const geo = await geocodeAddress({ address, city, state, postalCode })
    if (geo) geoUpdate = { latitude: geo.latitude, longitude: geo.longitude }
  }

  const { error } = await supabase
    .from('properties')
    .update({
      customer_id: customerId,
      property_name: str(formData, 'property_name'),
      service_address: address,
      city,
      state,
      postal_code: postalCode,
      county: str(formData, 'county'),
      ...geoUpdate,
      parcel_acres: num(formData, 'parcel_acres'),
      estimated_mowable_acres: num(formData, 'estimated_mowable_acres'),
      lot_size_source: str(formData, 'lot_size_source'),
      default_service_package: str(formData, 'default_service_package'),
      default_price: num(formData, 'default_price'),
      service_frequency: (formData.get('service_frequency') as string) || 'one_time',
      preferred_service_day: str(formData, 'preferred_service_day'),
      auto_schedule_next: formData.get('auto_schedule_next') === 'on',
      gate_code: str(formData, 'gate_code'),
      pet_warning: str(formData, 'pet_warning'),
      access_notes: str(formData, 'access_notes'),
      obstacle_notes: str(formData, 'obstacle_notes'),
      parking_notes: str(formData, 'parking_notes'),
      internal_notes: str(formData, 'internal_notes'),
      status: (formData.get('status') as string) || 'active',
    })
    .eq('id', id)
    .eq('created_by', user.id)

  if (error) return { error: error.message }

  revalidatePath('/properties')
  revalidatePath(`/properties/${id}`)
  return { error: null, success: 'Changes saved.' }
}

export async function applyParcelToProperty(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  void _prevState
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const propertyId  = formData.get('property_id') as string
  const parcelId    = formData.get('parcel_id') as string
  const parcelAcres = parseFloat(formData.get('parcel_acres') as string)
  const mowableAcres = parseFloat(formData.get('mowable_acres') as string)

  if (!propertyId || !parcelId) return { error: 'Missing data.' }

  const { error } = await supabase
    .from('properties')
    .update({
      parcel_id: parcelId,
      parcel_acres: parcelAcres,
      estimated_mowable_acres: mowableAcres,
    })
    .eq('id', propertyId)
    .eq('created_by', user.id)

  if (error) return { error: error.message }

  revalidatePath('/properties')
  revalidatePath(`/properties/${propertyId}`)
  revalidatePath('/leads')
  return { error: null, success: 'Parcel data applied.' }
}

function val(formData: FormData, key: string): string {
  return ((formData.get(key) as string) ?? '').trim()
}

export async function archiveProperty(
  id: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  void prevState
  void formData
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // TODO: Future: restrict archive/delete controls to owner/admin company roles once company_members exists.
  const { error } = await supabase
    .from('properties')
    .update({ status: 'archived' })
    .eq('id', id)
    .eq('created_by', user.id)

  if (error) return { error: 'Unable to archive property right now. Please try again.' }

  revalidatePath('/properties')
  revalidatePath(`/properties/${id}`)
  redirect('/properties')
}

export async function deletePropertyPermanently(
  id: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  void prevState
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // TODO: Future: restrict archive/delete controls to owner/admin company roles once company_members exists.
  if (val(formData, 'delete_confirmation') !== 'DELETE') {
    return { error: 'Type DELETE to confirm permanent property deletion.' }
  }

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('id')
    .eq('id', id)
    .eq('created_by', user.id)
    .maybeSingle()

  if (propertyError || !property) {
    return { error: 'Property not found.' }
  }

  const [{ count: jobsCount }, { count: estimatesCount }, { count: messagesCount }] = await Promise.all([
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', user.id)
      .eq('property_id', id),
    supabase
      .from('estimates')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', user.id)
      .eq('property_id', id),
    supabase
      .from('message_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('property_id', id),
  ])

  if ((jobsCount ?? 0) > 0 || (estimatesCount ?? 0) > 0 || (messagesCount ?? 0) > 0) {
    return { error: 'This property has business history. Archive this property instead of deleting permanently.' }
  }

  const { error: deleteError } = await supabase
    .from('properties')
    .delete()
    .eq('id', id)
    .eq('created_by', user.id)

  if (deleteError) {
    return { error: 'Unable to permanently delete property right now. Please try again.' }
  }

  revalidatePath('/properties')
  redirect('/properties')
}

export async function reassignProperty(
  id: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  void prevState
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const newCustomerId = str(formData, 'new_customer_id')
  if (!newCustomerId) return { error: 'Please select a customer to reassign this property.' }

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('id, customer_id')
    .eq('id', id)
    .eq('created_by', user.id)
    .maybeSingle()

  if (propertyError || !property) {
    return { error: 'Property not found.' }
  }

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('id', newCustomerId)
    .eq('created_by', user.id)
    .maybeSingle()

  if (customerError || !customer) {
    return { error: 'Selected customer not found.' }
  }

  const previousCustomerId = property.customer_id

  const { error: updateError } = await supabase
    .from('properties')
    .update({ customer_id: newCustomerId })
    .eq('id', id)
    .eq('created_by', user.id)

  if (updateError) {
    return { error: 'Unable to reassign property right now. Please try again.' }
  }

  revalidatePath('/properties')
  revalidatePath(`/properties/${id}`)
  if (previousCustomerId) revalidatePath(`/customers/${previousCustomerId}`)
  revalidatePath(`/customers/${newCustomerId}`)
  return { error: null, success: 'Property reassigned.' }
}

export async function restoreProperty(
  id: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  void prevState
  void formData
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('id')
    .eq('id', id)
    .eq('created_by', user.id)
    .maybeSingle()

  if (propertyError || !property) {
    return { error: 'Property not found.' }
  }

  const { error: updateError } = await supabase
    .from('properties')
    .update({ status: 'active' })
    .eq('id', id)
    .eq('created_by', user.id)

  if (updateError) {
    return { error: 'Unable to restore property right now. Please try again.' }
  }

  revalidatePath('/properties')
  revalidatePath(`/properties/${id}`)
  return { error: null, success: 'Property restored.' }
}

/**
 * Backfill latitude/longitude for all properties owned by the current user
 * that are missing coordinates. Runs sequentially with a 1.1s pause between
 * requests to respect Nominatim's 1 req/sec rate limit.
 */
export async function backfillPropertyCoordinates(
  _prevState: FormState,
  _formData: FormData
): Promise<FormState> {
  void _prevState
  void _formData
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: properties } = await supabase
    .from('properties')
    .select('id, service_address, city, state, postal_code')
    .eq('created_by', user.id)
    .or('latitude.is.null,longitude.is.null')

  if (!properties || properties.length === 0) {
    return { error: null, success: 'All properties already have coordinates.' }
  }

  let succeeded = 0
  let failed = 0

  for (const p of properties) {
    if (!p.service_address) { failed++; continue }
    const geo = await geocodeAddress({
      address: p.service_address,
      city: p.city,
      state: p.state,
      postalCode: p.postal_code,
    })
    if (geo) {
      await supabase
        .from('properties')
        .update({ latitude: geo.latitude, longitude: geo.longitude })
        .eq('id', p.id)
        .eq('created_by', user.id)
      succeeded++
    } else {
      failed++
    }
    // Respect Nominatim's 1 req/sec rate limit
    await new Promise(r => setTimeout(r, 1100))
  }

  revalidatePath('/properties')
  revalidatePath('/today')
  return {
    error: null,
    success: `Geocoded ${succeeded} of ${properties.length} properties${failed > 0 ? ` (${failed} failed)` : ''}.`,
  }
}

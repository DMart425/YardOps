'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { FormState } from '@/types/database'

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

  const { data: property, error } = await supabase.from('properties').insert({
    created_by: user.id,
    customer_id: customerId,
    property_name: str(formData, 'property_name'),
    service_address: (formData.get('service_address') as string).trim(),
    city: str(formData, 'city'),
    state: str(formData, 'state') ?? 'AL',
    postal_code: str(formData, 'postal_code'),
    county: str(formData, 'county'),
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

  const { error } = await supabase
    .from('properties')
    .update({
      customer_id: customerId,
      property_name: str(formData, 'property_name'),
      service_address: (formData.get('service_address') as string).trim(),
      city: str(formData, 'city'),
      state: str(formData, 'state') ?? 'AL',
      postal_code: str(formData, 'postal_code'),
      county: str(formData, 'county'),
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

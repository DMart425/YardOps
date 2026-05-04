'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { FormState } from '@/types/database'

function str(fd: FormData, key: string) {
  const v = (fd.get(key) as string)?.trim()
  return v || null
}

// ── createLead ──────────────────────────────────────────────────────────────
// Creates a manual lead: customer (status='lead') + property
export async function createLead(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  void prevState
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const firstName = str(formData, 'first_name')
  if (!firstName) return { error: 'First name is required.' }

  const address = str(formData, 'service_address')
  if (!address) return { error: 'Service address is required.' }

  const { data: customer, error: custError } = await supabase
    .from('customers')
    .insert({
      created_by: user.id,
      first_name: firstName,
      last_name: str(formData, 'last_name'),
      phone: str(formData, 'phone'),
      email: str(formData, 'email'),
      notes: str(formData, 'notes'),
      status: 'lead',
    })
    .select('id')
    .single()

  if (custError) return { error: custError.message }

  const { error: propError } = await supabase
    .from('properties')
    .insert({
      created_by: user.id,
      customer_id: customer.id,
      service_address: address,
      service_frequency: (str(formData, 'service_frequency') ?? 'biweekly') as 'weekly' | 'biweekly' | 'one_time' | 'custom' | 'paused',
      status: 'active',
    })

  if (propError) return { error: propError.message }

  revalidatePath('/leads')
  redirect(`/leads/${customer.id}`)
}

// ── convertWebsiteLead ──────────────────────────────────────────────────────
// Converts a website `leads` table row → customer (status='lead') + property
export async function convertWebsiteLead(
  leadId: string,
  prevState: FormState,
  _formData: FormData
): Promise<FormState> {
  void prevState
  void _formData
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single()

  if (!lead) return { error: 'Lead not found.' }

  // Split name into first/last
  const parts = (lead.name as string).trim().split(' ')
  const firstName = parts[0] ?? 'Unknown'
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : null

  // Map website frequency values to DB enum
  const freqMap: Record<string, 'weekly' | 'biweekly' | 'one_time' | 'custom' | 'paused'> = {
    Weekly: 'weekly',
    Biweekly: 'biweekly',
    'One-Time Cut': 'one_time',
    'Not Sure Yet': 'biweekly',
  }
  const frequency = freqMap[lead.frequency as string] ?? 'biweekly'

  const { data: customer, error: custError } = await supabase
    .from('customers')
    .insert({
      created_by: user.id,
      first_name: firstName,
      last_name: lastName,
      phone: lead.phone ?? null,
      email: lead.email ?? null,
      notes: lead.notes ?? null,
      status: 'lead',
    })
    .select('id')
    .single()

  if (custError) return { error: custError.message }

  const { error: propError } = await supabase
    .from('properties')
    .insert({
      created_by: user.id,
      customer_id: customer.id,
      service_address: lead.address,
      service_frequency: frequency,
      status: 'active',
    })

  if (propError) return { error: propError.message }

  // Mark website lead as converted so it won't show up again
  await supabase
    .from('leads')
    .update({ status: 'converted' })
    .eq('id', leadId)

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('customers')
    .update({ status: 'archived' })
    .eq('id', customerId)
    .eq('created_by', user.id)

  if (error) return { error: error.message }

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('leads')
    .update({ status: 'archived' })
    .eq('id', leadId)

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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const leadId = formData.get('lead_id') as string
  if (!leadId) return { error: 'Missing lead ID.' }

  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', leadId)

  if (error) return { error: error.message }

  revalidatePath('/leads')
  return { error: null, success: 'Deleted.' }
}

// ── clearAllWebsiteLeads ────────────────────────────────────────────────────
// Hard-deletes ALL leads with status='new'
export async function clearAllWebsiteLeads(
  _prevState: FormState,
  _formData: FormData
): Promise<FormState> {
  void _prevState
  void _formData
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('status', 'new')

  if (error) return { error: error.message }

  revalidatePath('/leads')
  redirect('/leads')
}

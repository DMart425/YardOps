'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { FormState } from '@/types/database'

function str(fd: FormData, key: string) {
  const v = (fd.get(key) as string)?.trim()
  return v || null
}

function buildLeadIntakeNotes(args: {
  existingNotes: string | null
  sourceLabel: string
  intakeAddress?: string | null
  requestedFrequency?: string | null
}) {
  const { existingNotes, sourceLabel, intakeAddress, requestedFrequency } = args
  const lines: string[] = []

  if (intakeAddress) lines.push(`Intake address: ${intakeAddress}`)
  if (requestedFrequency) lines.push(`Requested frequency: ${requestedFrequency}`)

  if (!lines.length) return existingNotes

  const intakeBlock = `${sourceLabel} intake details:\n- ${lines.join('\n- ')}`
  return existingNotes ? `${existingNotes}\n\n${intakeBlock}` : intakeBlock
}

// ── createLead ──────────────────────────────────────────────────────────────
// Creates a manual lead/contact only: customer (status='lead')
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

  const intakeAddress = str(formData, 'service_address')
  const requestedFrequency = str(formData, 'service_frequency')
  const notes = buildLeadIntakeNotes({
    existingNotes: str(formData, 'notes'),
    sourceLabel: 'Manual lead',
    intakeAddress,
    requestedFrequency,
  })

  const { data: customer, error: custError } = await supabase
    .from('customers')
    .insert({
      created_by: user.id,
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

  revalidatePath('/leads')
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

  const notes = buildLeadIntakeNotes({
    existingNotes: lead.notes ?? null,
    sourceLabel: 'Website lead',
    intakeAddress: lead.address ?? null,
    requestedFrequency: lead.frequency ?? null,
  })

  const { data: customer, error: custError } = await supabase
    .from('customers')
    .insert({
      created_by: user.id,
      first_name: firstName,
      last_name: lastName,
      phone: lead.phone ?? null,
      email: lead.email ?? null,
      notes,
      status: 'lead',
    })
    .select('id')
    .single()

  if (custError) return { error: custError.message }

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
  const deleteConfirmation = (formData.get('delete_confirmation') as string | null)?.trim()

  if (deleteConfirmation !== 'DELETE') {
    return { error: 'Type DELETE to permanently remove this website lead.' }
  }

  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', leadId)

  if (error) return { error: error.message }

  revalidatePath('/leads')
  redirect('/leads')
}

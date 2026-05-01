'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { FormState } from '@/types/database'

export async function createCustomer(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase.from('customers').insert({
    created_by: user.id,
    first_name: (formData.get('first_name') as string).trim(),
    last_name: (formData.get('last_name') as string)?.trim() || null,
    phone: (formData.get('phone') as string)?.trim() || null,
    email: (formData.get('email') as string)?.trim() || null,
    preferred_contact_method: (formData.get('preferred_contact_method') as string) || null,
    notes: (formData.get('notes') as string)?.trim() || null,
    status: (formData.get('status') as string) || 'lead',
  })

  if (error) return { error: error.message }

  revalidatePath('/customers')
  redirect('/customers')
}

export async function updateCustomer(
  id: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('customers')
    .update({
      first_name: (formData.get('first_name') as string).trim(),
      last_name: (formData.get('last_name') as string)?.trim() || null,
      phone: (formData.get('phone') as string)?.trim() || null,
      email: (formData.get('email') as string)?.trim() || null,
      preferred_contact_method: (formData.get('preferred_contact_method') as string) || null,
      notes: (formData.get('notes') as string)?.trim() || null,
      status: (formData.get('status') as string) || 'lead',
    })
    .eq('id', id)
    .eq('created_by', user.id)

  if (error) return { error: error.message }

  revalidatePath('/customers')
  revalidatePath(`/customers/${id}`)
  return { error: null, success: 'Changes saved.' }
}

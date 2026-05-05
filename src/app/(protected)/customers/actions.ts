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
      tags: (formData.getAll('tags') as string[]).filter(Boolean),
    })
    .eq('id', id)
    .eq('created_by', user.id)

  if (error) return { error: error.message }

  revalidatePath('/customers')
  revalidatePath(`/customers/${id}`)
  return { error: null, success: 'Changes saved.' }
}

function val(formData: FormData, key: string): string {
  return ((formData.get(key) as string) ?? '').trim()
}

export async function archiveCustomer(
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
    .from('customers')
    .update({ status: 'archived' })
    .eq('id', id)
    .eq('created_by', user.id)

  if (error) return { error: 'Unable to archive customer right now. Please try again.' }

  revalidatePath('/customers')
  revalidatePath(`/customers/${id}`)
  redirect('/customers')
}

export async function markLeadCustomerActive(
  customerId: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  void prevState
  void formData
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('customers')
    .update({ status: 'active' })
    .eq('id', customerId)
    .eq('created_by', user.id)

  if (error) {
    return { error: 'Unable to mark this lead as active right now. Please try again.' }
  }

  revalidatePath('/customers')
  revalidatePath('/leads')
  revalidatePath(`/customers/${customerId}`)
  return { error: null, success: 'Lead marked as active customer.' }
}

export async function deleteCustomerPermanently(
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
    return { error: 'Type DELETE to confirm permanent customer deletion.' }
  }

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('id', id)
    .eq('created_by', user.id)
    .maybeSingle()

  if (customerError || !customer) {
    return { error: 'Customer not found.' }
  }

  const [{ count: directJobs }, { count: directEstimates }, { count: directMessages }, { count: portalTokens }] = await Promise.all([
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', user.id)
      .eq('customer_id', id),
    supabase
      .from('estimates')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', user.id)
      .eq('customer_id', id),
    supabase
      .from('message_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('customer_id', id),
    supabase
      .from('customer_portal_tokens')
      .select('token', { count: 'exact', head: true })
      .eq('created_by', user.id)
      .eq('customer_id', id),
  ])

  if ((directJobs ?? 0) > 0 || (directEstimates ?? 0) > 0 || (directMessages ?? 0) > 0 || (portalTokens ?? 0) > 0) {
    return { error: 'This customer has business history. Archive this customer instead of deleting permanently.' }
  }

  const { data: properties, error: propertiesError } = await supabase
    .from('properties')
    .select('id')
    .eq('created_by', user.id)
    .eq('customer_id', id)

  if (propertiesError) {
    return { error: 'Unable to verify customer properties right now. Please try again.' }
  }

  const propertyIds = (properties ?? []).map(p => p.id)
  if (propertyIds.length > 0) {
    const [{ count: propertyJobs }, { count: propertyEstimates }, { count: propertyMessages }] = await Promise.all([
      supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', user.id)
        .in('property_id', propertyIds),
      supabase
        .from('estimates')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', user.id)
        .in('property_id', propertyIds),
      supabase
        .from('message_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('property_id', propertyIds),
    ])

    if ((propertyJobs ?? 0) > 0 || (propertyEstimates ?? 0) > 0 || (propertyMessages ?? 0) > 0) {
      return { error: 'This customer has property history. Archive this customer instead of deleting permanently.' }
    }

    const { error: deletePropertiesError } = await supabase
      .from('properties')
      .delete()
      .eq('created_by', user.id)
      .eq('customer_id', id)

    if (deletePropertiesError) {
      return { error: 'Unable to delete customer properties right now. Please try again.' }
    }
  }

  const { error: deleteCustomerError } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .eq('created_by', user.id)

  if (deleteCustomerError) {
    return { error: 'Unable to permanently delete customer right now. Please try again.' }
  }

  revalidatePath('/customers')
  revalidatePath('/properties')
  redirect('/customers')
}

export async function deleteTestCustomerWithLinkedTestRecords(
  id: string,
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  void prevState
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // TODO: Future: restrict archive/delete controls to owner/admin company roles once company_members exists.
  if (val(formData, 'delete_test_confirmation') !== 'DELETE TEST DATA') {
    return { error: 'Type DELETE TEST DATA to confirm test cleanup deletion.' }
  }

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('id', id)
    .eq('created_by', user.id)
    .maybeSingle()

  if (customerError || !customer) {
    return { error: 'Customer not found for this user.' }
  }

  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id')
    .eq('created_by', user.id)
    .eq('customer_id', id)

  if (jobsError) return { error: 'Unable to load linked jobs for test cleanup.' }
  const jobIds = (jobs ?? []).map(j => j.id)

  const { data: estimates, error: estimatesError } = await supabase
    .from('estimates')
    .select('id')
    .eq('created_by', user.id)
    .eq('customer_id', id)

  if (estimatesError) return { error: 'Unable to load linked estimates for test cleanup.' }
  const estimateIds = (estimates ?? []).map(e => e.id)

  if (jobIds.length > 0) {
    const { error: deleteJobPhotosError } = await supabase
      .from('job_photos')
      .delete()
      .in('job_id', jobIds)

    if (deleteJobPhotosError) return { error: 'Failed deleting linked job photos during test cleanup.' }

    const { error: deleteExpensesError } = await supabase
      .from('expenses')
      .delete()
      .eq('user_id', user.id)
      .in('job_id', jobIds)

    if (deleteExpensesError) return { error: 'Failed deleting linked expenses during test cleanup.' }

    const { error: deleteJobVisitsError } = await supabase
      .from('job_visits')
      .delete()
      .in('job_id', jobIds)

    if (deleteJobVisitsError) return { error: 'Failed deleting linked job visits during test cleanup.' }
  }

  const { error: deleteMessageLogsError } = await supabase
    .from('message_logs')
    .delete()
    .eq('user_id', user.id)
    .eq('customer_id', id)

  if (deleteMessageLogsError) return { error: 'Failed deleting customer message logs during test cleanup.' }

  const { error: deletePortalTokensError } = await supabase
    .from('customer_portal_tokens')
    .delete()
    .eq('created_by', user.id)
    .eq('customer_id', id)

  if (deletePortalTokensError) return { error: 'Failed deleting customer portal tokens during test cleanup.' }

  if (estimateIds.length > 0) {
    const { error: deleteEstimateItemsError } = await supabase
      .from('estimate_items')
      .delete()
      .eq('created_by', user.id)
      .in('estimate_id', estimateIds)

    if (deleteEstimateItemsError) return { error: 'Failed deleting estimate items during test cleanup.' }
  }

  if (jobIds.length > 0) {
    const { error: deleteJobsError } = await supabase
      .from('jobs')
      .delete()
      .eq('created_by', user.id)
      .eq('customer_id', id)

    if (deleteJobsError) return { error: 'Failed deleting customer jobs during test cleanup.' }
  }

  if (estimateIds.length > 0) {
    const { error: deleteEstimatesError } = await supabase
      .from('estimates')
      .delete()
      .eq('created_by', user.id)
      .eq('customer_id', id)

    if (deleteEstimatesError) return { error: 'Failed deleting customer estimates during test cleanup.' }
  }

  const { error: deletePropertiesError } = await supabase
    .from('properties')
    .delete()
    .eq('created_by', user.id)
    .eq('customer_id', id)

  if (deletePropertiesError) return { error: 'Failed deleting customer properties during test cleanup.' }

  const { error: deleteCustomerError } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .eq('created_by', user.id)

  if (deleteCustomerError) return { error: 'Failed deleting customer row during test cleanup.' }

  revalidatePath('/customers')
  revalidatePath('/properties')
  redirect('/customers')
}

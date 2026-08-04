'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireBusinessContext } from '@/lib/business/context'
import type { Database } from '@/types/supabase'

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024
const ALLOWED_RECEIPT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
}

export async function createExpense(formData: FormData) {
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const jobId = (formData.get('job_id') as string) || null

  if (jobId) {
    const { data: job } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', jobId)
      .eq('business_id', businessId)
      .maybeSingle()
    if (!job) throw new Error('Job not found.')
  }

  let receiptUrl: string | null = null
  const receiptFile = formData.get('receipt') as File | null

  if (receiptFile && receiptFile.size > 0) {
    // Size/type validation mirrors photo uploads; receipts also allow PDF.
    // Extension derives from the validated MIME type, not the client filename.
    if (receiptFile.size > MAX_RECEIPT_BYTES) throw new Error('Receipt is too large (max 10 MB).')
    const receiptExt = ALLOWED_RECEIPT_TYPES[receiptFile.type]
    if (!receiptExt) throw new Error('Unsupported receipt type. Use JPG, PNG, WebP, HEIC, or PDF.')

    const admin = createAdminClient()
    const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${receiptExt}`
    const bytes = await receiptFile.arrayBuffer()

    const { error: uploadError } = await admin.storage
      .from('receipts')
      .upload(path, bytes, { contentType: receiptFile.type, upsert: false })

    if (!uploadError) {
      const { data: signed } = await admin.storage
        .from('receipts')
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10) // 10-year signed URL
      receiptUrl = signed?.signedUrl ?? null
    }
  }

  const { error } = await supabase.from('expenses').insert({
    user_id: userId,
    business_id: businessId,
    category: formData.get('category') as string,
    vendor: (formData.get('vendor') as string) || null,
    description: (formData.get('description') as string) || null,
    amount: Number(formData.get('amount')),
    purchased_at: formData.get('purchased_at') as string,
    notes: (formData.get('notes') as string) || null,
    receipt_url: receiptUrl,
    job_id: jobId,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/finances')
  if (jobId) {
    revalidatePath(`/jobs/${jobId}`)
    redirect(`/jobs/${jobId}`)
  }
  redirect('/finances')
}

export async function updateExpense(id: string, formData: FormData) {
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  let receiptUrl: string | undefined = undefined
  const receiptFile = formData.get('receipt') as File | null

  if (receiptFile && receiptFile.size > 0) {
    // Size/type validation mirrors photo uploads; receipts also allow PDF.
    // Extension derives from the validated MIME type, not the client filename.
    if (receiptFile.size > MAX_RECEIPT_BYTES) throw new Error('Receipt is too large (max 10 MB).')
    const receiptExt = ALLOWED_RECEIPT_TYPES[receiptFile.type]
    if (!receiptExt) throw new Error('Unsupported receipt type. Use JPG, PNG, WebP, HEIC, or PDF.')

    const admin = createAdminClient()
    const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${receiptExt}`
    const bytes = await receiptFile.arrayBuffer()

    const { error: uploadError } = await admin.storage
      .from('receipts')
      .upload(path, bytes, { contentType: receiptFile.type, upsert: false })

    if (!uploadError) {
      const { data: signed } = await admin.storage
        .from('receipts')
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10)
      receiptUrl = signed?.signedUrl ?? undefined
    }
  }

  const updateJobId = (formData.get('job_id') as string) || null

  if (updateJobId) {
    const { data: job } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', updateJobId)
      .eq('business_id', businessId)
      .maybeSingle()
    if (!job) throw new Error('Job not found.')
  }

  const updates: Database['public']['Tables']['expenses']['Update'] = {
    category: formData.get('category') as string,
    vendor: (formData.get('vendor') as string) || null,
    description: (formData.get('description') as string) || null,
    amount: Number(formData.get('amount')),
    purchased_at: formData.get('purchased_at') as string,
    notes: (formData.get('notes') as string) || null,
    job_id: updateJobId,
  }
  if (receiptUrl !== undefined) updates.receipt_url = receiptUrl

  const { data: updated } = await supabase
    .from('expenses')
    .update(updates)
    .eq('id', id)
    .eq('business_id', businessId)
    .select('id')
    .maybeSingle()

  if (!updated) throw new Error('Expense not found.')

  revalidatePath('/finances')
  revalidatePath('/finances/expenses/' + id)
}

export async function deleteExpense(id: string) {
  const supabase = await createClient()
  const { businessId } = await requireBusinessContext()

  const { data: expense } = await supabase
    .from('expenses')
    .select('id')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle()

  if (!expense) throw new Error('Expense not found.')

  await supabase.from('expenses').delete().eq('id', id).eq('business_id', businessId)

  revalidatePath('/finances')
  redirect('/finances')
}

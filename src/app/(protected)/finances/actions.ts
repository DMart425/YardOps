'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function createExpense(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let receiptUrl: string | null = null
  const receiptFile = formData.get('receipt') as File | null

  if (receiptFile && receiptFile.size > 0) {
    const admin = createAdminClient()
    const ext = receiptFile.name.split('.').pop() ?? 'bin'
    const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`
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
    user_id: user.id,
    category: formData.get('category') as string,
    vendor: (formData.get('vendor') as string) || null,
    description: (formData.get('description') as string) || null,
    amount: Number(formData.get('amount')),
    purchased_at: formData.get('purchased_at') as string,
    notes: (formData.get('notes') as string) || null,
    receipt_url: receiptUrl,
    job_id: (formData.get('job_id') as string) || null,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/finances')
  const jobId = formData.get('job_id') as string
  if (jobId) {
    revalidatePath(`/jobs/${jobId}`)
    redirect(`/jobs/${jobId}`)
  }
  redirect('/finances')
}

export async function updateExpense(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let receiptUrl: string | undefined = undefined
  const receiptFile = formData.get('receipt') as File | null

  if (receiptFile && receiptFile.size > 0) {
    const admin = createAdminClient()
    const ext = receiptFile.name.split('.').pop() ?? 'bin'
    const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`
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

  const updates: Record<string, unknown> = {
    category: formData.get('category') as string,
    vendor: (formData.get('vendor') as string) || null,
    description: (formData.get('description') as string) || null,
    amount: Number(formData.get('amount')),
    purchased_at: formData.get('purchased_at') as string,
    notes: (formData.get('notes') as string) || null,
    job_id: (formData.get('job_id') as string) || null,
  }
  if (receiptUrl !== undefined) updates.receipt_url = receiptUrl

  await supabase.from('expenses').update(updates).eq('id', id)
  revalidatePath('/finances')
  revalidatePath('/finances/expenses/' + id)
}

export async function deleteExpense(id: string) {
  const supabase = await createClient()
  await supabase.from('expenses').delete().eq('id', id)
  revalidatePath('/finances')
  redirect('/finances')
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { requireBusinessContext } from '@/lib/business/context'

export async function uploadJobPhoto(jobId: string, formData: FormData) {
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const file = formData.get('photo') as File | null
  if (!file || file.size === 0) return

  // Verify the parent job belongs to this business before inserting a photo
  const { data: job } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('business_id', businessId)
    .maybeSingle()

  if (!job) throw new Error('Job not found.')

  // Validate size and type before touching storage. The extension and content
  // type are derived from the validated MIME type — never from the client
  // filename or a client-supplied content type (blocks e.g. .html uploads
  // parked on long-lived signed URLs).
  const MAX_PHOTO_BYTES = 10 * 1024 * 1024
  const ALLOWED_PHOTO_TYPES: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png':  'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
  }
  if (file.size > MAX_PHOTO_BYTES) throw new Error('Photo is too large (max 10 MB).')
  const photoExt = ALLOWED_PHOTO_TYPES[file.type]
  if (!photoExt) throw new Error('Unsupported photo type. Use JPG, PNG, WebP, or HEIC.')

  const kindRaw = (formData.get('kind') as string) || 'after'
  const kind = kindRaw === 'before' ? 'before' : 'after'
  const caption = (formData.get('caption') as string)?.trim() || null

  const admin = createAdminClient()
  const path = `${userId}/${jobId}/${Date.now()}-${crypto.randomUUID()}.${photoExt}`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await admin.storage
    .from('job-photos')
    .upload(path, bytes, { contentType: file.type, upsert: false })

  if (uploadError) throw new Error(uploadError.message)

  const { data: signed } = await admin.storage
    .from('job-photos')
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10)

  const signedUrl = signed?.signedUrl
  if (!signedUrl) throw new Error('Failed to sign photo URL')

  const { error: insertError } = await supabase.from('job_photos').insert({
    user_id:      userId,
    business_id:  businessId,
    job_id:       jobId,
    storage_path: path,
    signed_url:   signedUrl,
    kind,
    caption,
  })

  if (insertError) throw new Error(insertError.message)

  revalidatePath(`/jobs/${jobId}`)
}

export async function deleteJobPhoto(photoId: string, jobId: string) {
  const supabase = await createClient()
  const { businessId } = await requireBusinessContext()

  const { data: photo } = await supabase
    .from('job_photos')
    .select('storage_path')
    .eq('id', photoId)
    .eq('business_id', businessId)
    .single()

  if (!photo) return

  const admin = createAdminClient()
  await admin.storage.from('job-photos').remove([photo.storage_path])
  await supabase.from('job_photos').delete().eq('id', photoId).eq('business_id', businessId)

  revalidatePath(`/jobs/${jobId}`)
}

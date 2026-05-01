'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createEquipment(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase.from('equipment').insert({
    user_id: user.id,
    name: formData.get('name') as string,
    equipment_type: (formData.get('equipment_type') as string) || null,
    make: (formData.get('make') as string) || null,
    model: (formData.get('model') as string) || null,
    serial_number: (formData.get('serial_number') as string) || null,
    current_hours: Number(formData.get('current_hours') ?? 0),
    notes: (formData.get('notes') as string) || null,
    status: 'active',
  }).select('id').single()

  if (error) throw new Error(error.message)
  revalidatePath('/equipment')
  redirect('/equipment/' + data.id)
}

export async function updateEquipment(id: string, formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.from('equipment').update({
    name: formData.get('name') as string,
    equipment_type: (formData.get('equipment_type') as string) || null,
    make: (formData.get('make') as string) || null,
    model: (formData.get('model') as string) || null,
    serial_number: (formData.get('serial_number') as string) || null,
    current_hours: Number(formData.get('current_hours') ?? 0),
    notes: (formData.get('notes') as string) || null,
    status: formData.get('status') as string,
  }).eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/equipment/' + id)
  revalidatePath('/equipment')
  redirect('/equipment/' + id + '?saved=1')
}

export async function addMaintenanceItem(equipmentId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const intervalHours = formData.get('interval_hours')
  const intervalDays = formData.get('interval_days')

  await supabase.from('maintenance_items').insert({
    user_id: user.id,
    equipment_id: equipmentId,
    name: formData.get('name') as string,
    interval_hours: intervalHours ? Number(intervalHours) : null,
    interval_days: intervalDays ? Number(intervalDays) : null,
    notes: (formData.get('notes') as string) || null,
  })

  revalidatePath('/equipment/' + equipmentId)
}

export async function logService(itemId: string, equipmentId: string, formData: FormData) {
  const supabase = await createClient()

  const completedAt = new Date().toISOString()
  const completedHours = Number(formData.get('completed_hours') ?? 0)

  // Get interval info to compute next due
  const { data: item } = await supabase
    .from('maintenance_items')
    .select('interval_hours, interval_days')
    .eq('id', itemId)
    .single()

  const nextDueHours = item?.interval_hours
    ? completedHours + item.interval_hours
    : null

  let nextDueDate: string | null = null
  if (item?.interval_days) {
    const d = new Date()
    d.setDate(d.getDate() + item.interval_days)
    nextDueDate = d.toISOString().split('T')[0]
  }

  await supabase.from('maintenance_items').update({
    last_completed_at: completedAt,
    last_completed_hours: completedHours,
    next_due_hours: nextDueHours,
    next_due_date: nextDueDate,
  }).eq('id', itemId)

  // Update equipment current_hours if higher (fallback if RPC doesn't exist)
  const { error: rpcError } = await supabase.rpc('update_equipment_hours_if_higher', {
    p_equipment_id: equipmentId,
    p_hours: completedHours,
  })
  if (rpcError) {
    await supabase.from('equipment')
      .update({ current_hours: completedHours })
      .eq('id', equipmentId)
      .lt('current_hours', completedHours)
  }

  revalidatePath('/equipment/' + equipmentId)
}

export async function deleteMaintenanceItem(itemId: string, equipmentId: string) {
  const supabase = await createClient()
  await supabase.from('maintenance_items').delete().eq('id', itemId)
  revalidatePath('/equipment/' + equipmentId)
}

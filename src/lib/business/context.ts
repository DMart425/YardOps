import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type BusinessMembershipRow = {
  business_id: string
  role: string
  created_at: string
}

export type BusinessContext = {
  userId: string
  businessId: string
  membershipRole: string
  membershipCount: number
}

function chooseDefaultMembership(rows: BusinessMembershipRow[]): BusinessMembershipRow {
  // For now: prefer owner role, otherwise oldest active membership.
  // Future: replace with explicit user-selected business context.
  const ownerMembership = rows.find((row) => row.role === 'owner')
  if (ownerMembership) return ownerMembership

  return [...rows].sort((a, b) => {
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })[0]
}

export async function requireBusinessContext(): Promise<BusinessContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('business_members')
    .select('business_id, role, created_at, businesses!inner(status)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('businesses.status', 'active')

  if (error) {
    throw new Error('Unable to load business membership for this account.')
  }

  const memberships: BusinessMembershipRow[] = (data ?? []).map((row) => ({
    business_id: String(row.business_id),
    role: String(row.role),
    created_at: String(row.created_at),
  }))

  if (memberships.length === 0) {
    throw new Error('No active business membership found for this account.')
  }

  const selectedMembership = chooseDefaultMembership(memberships)

  return {
    userId: user.id,
    businessId: selectedMembership.business_id,
    membershipRole: selectedMembership.role,
    membershipCount: memberships.length,
  }
}

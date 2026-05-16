import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MobileNav from '@/components/MobileNav'
import DesktopSidebar from '@/components/DesktopSidebar'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch unreviewed estimate approval notifications with linked estimate status so we
  // can exclude notifications whose estimate has already been converted to a job.
  // Notifications with no linked estimate (estimate_id null) are still counted.
  const { data: pendingNotifRows } = await supabase
    .from('app_notifications')
    .select('id, estimates!estimate_id(status)')
    .eq('user_id', user.id)
    .eq('notification_type', 'estimate_approved')
    .eq('is_reviewed', false)

  const estimateNotificationCount = (pendingNotifRows ?? []).filter(n => {
    const estRaw = (n as unknown as { estimates?: { status: string } | { status: string }[] | null }).estimates
    const est = Array.isArray(estRaw) ? estRaw[0] : estRaw
    return est?.status !== 'converted'
  }).length

  return (
    <div className="app-shell">
      <DesktopSidebar estimateNotificationCount={estimateNotificationCount ?? 0} />
      <main className="app-main">
        {children}
      </main>
      <MobileNav estimateNotificationCount={estimateNotificationCount ?? 0} />
    </div>
  )
}

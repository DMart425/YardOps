import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MobileNav from '@/components/MobileNav'
import DesktopSidebar from '@/components/DesktopSidebar'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { count: estimateNotificationCount } = await supabase
    .from('app_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('notification_type', 'estimate_approved')
    .eq('is_reviewed', false)

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

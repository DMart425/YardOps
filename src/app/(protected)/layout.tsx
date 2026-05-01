import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MobileNav from '@/components/MobileNav'
import DesktopSidebar from '@/components/DesktopSidebar'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="app-shell">
      <DesktopSidebar />
      <main className="app-main">
        {children}
      </main>
      <MobileNav />
    </div>
  )
}

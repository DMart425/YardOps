import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

/**
 * Service-role Supabase client — bypasses RLS.
 * ONLY use in server-side code (server actions, route handlers).
 * Never import this in client components.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

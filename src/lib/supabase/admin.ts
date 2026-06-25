import "server-only"
import { createClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client. BYPASSES Row Level Security.
 * Server-only — never import this into a Client Component.
 * Used for: seeding, admin user management, and the cron expiry job.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

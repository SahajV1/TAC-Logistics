import "server-only"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { Profile, SessionUser } from "@/lib/types"

/**
 * Returns the signed-in user's profile (with role + branch) or null.
 * Reads through RLS, so a staff user only ever sees their own profile row.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, branches(id, name)")
    .eq("id", user.id)
    .single<Profile>()

  if (!profile || !profile.is_active) return null

  return {
    ...profile,
    isAdmin: profile.role === "admin",
    branchName: profile.branches?.name ?? null,
  }
}

/** Redirects to /login if not authenticated. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  return user
}

/** Redirects non-admins to the dashboard. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (!user.isAdmin) redirect("/")
  return user
}

/**
 * Scopes a query to the user's branch. Admin → no filter (sees all).
 * Returns the branch_id to filter by, or null for admin (no filter).
 */
export function branchFilter(user: SessionUser): string | null {
  return user.isAdmin ? null : user.branch_id
}

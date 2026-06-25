import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { UserTable } from "./user-table"
import type { Branch, Profile } from "@/lib/types"

export const metadata = { title: "Staff" }

export default async function UsersPage() {
  await requireAdmin()
  const supabase = await createClient()

  const [userRes, branchRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("*, branches(id, name)")
      .order("full_name"),
    supabase.from("branches").select("id, name").order("name"),
  ])

  return (
    <>
      <PageHeader
        title="Staff & Access"
        description="Create staff logins, assign branches and control access."
      />
      <UserTable
        users={(userRes.data ?? []) as Profile[]}
        branches={(branchRes.data ?? []) as Pick<Branch, "id" | "name">[]}
      />
    </>
  )
}

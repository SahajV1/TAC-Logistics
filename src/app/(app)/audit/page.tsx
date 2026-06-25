import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { AuditTable } from "./audit-table"
import type { AuditLog, Branch } from "@/lib/types"

export const metadata = { title: "Audit Log" }

export default async function AuditPage() {
  await requireAdmin()
  const supabase = await createClient()

  const [logRes, branchRes] = await Promise.all([
    supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("branches").select("id, name"),
  ])

  const branchMap: Record<string, string> = {}
  for (const b of (branchRes.data ?? []) as Pick<Branch, "id" | "name">[]) {
    branchMap[b.id] = b.name
  }

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Every create, update and delete across the system (latest 500)."
      />
      <AuditTable
        logs={(logRes.data ?? []) as AuditLog[]}
        branchMap={branchMap}
      />
    </>
  )
}

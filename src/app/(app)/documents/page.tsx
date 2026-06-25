import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { DocumentTable } from "./document-table"
import type { DocTruckOption } from "./document-form"
import type { DocumentRow } from "@/lib/types"

export const metadata = { title: "Documents" }

export default async function DocumentsPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [docRes, truckRes] = await Promise.all([
    supabase
      .from("documents")
      .select("*, trucks(id, vehicle_number), branches(id, name)")
      .eq("is_current", true)
      .order("expiry_date", { ascending: true }),
    supabase
      .from("trucks")
      .select("id, vehicle_number, branch_id")
      .eq("status", "active")
      .order("vehicle_number"),
  ])

  return (
    <>
      <PageHeader
        title="Document Tracking"
        description="RC, Insurance, Pollution, Fitness & Permit — with uploads and renewal history."
      />
      <DocumentTable
        documents={(docRes.data ?? []) as DocumentRow[]}
        trucks={(truckRes.data ?? []) as DocTruckOption[]}
        isAdmin={user.isAdmin}
      />
    </>
  )
}

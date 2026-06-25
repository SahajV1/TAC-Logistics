import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { TruckTable } from "./truck-table"
import type { Branch, Truck } from "@/lib/types"

export const metadata = { title: "Trucks" }

export default async function TrucksPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [truckRes, branchRes] = await Promise.all([
    supabase.from("trucks").select("*, branches(id, name)").order("vehicle_number"),
    user.isAdmin
      ? supabase.from("branches").select("id, name").order("name")
      : Promise.resolve({ data: [] }),
  ])

  return (
    <>
      <PageHeader
        title="Truck Management"
        description="Company and rented vehicles across your branch."
      />
      <TruckTable
        trucks={(truckRes.data ?? []) as Truck[]}
        branches={(branchRes.data ?? []) as Pick<Branch, "id" | "name">[]}
        isAdmin={user.isAdmin}
        defaultBranchId={user.branch_id}
      />
    </>
  )
}

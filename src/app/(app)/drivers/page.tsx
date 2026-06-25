import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { DriverTable } from "./driver-table"
import type { Branch, Driver } from "@/lib/types"

export const metadata = { title: "Drivers" }

export default async function DriversPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [driverRes, branchRes] = await Promise.all([
    supabase
      .from("drivers")
      .select("*, branches(id, name)")
      .order("name"),
    user.isAdmin
      ? supabase.from("branches").select("id, name").order("name")
      : Promise.resolve({ data: [] }),
  ])

  return (
    <>
      <PageHeader
        title="Driver Management"
        description="Drivers, licence tracking and monthly salary."
      />
      <DriverTable
        drivers={(driverRes.data ?? []) as Driver[]}
        branches={(branchRes.data ?? []) as Pick<Branch, "id" | "name">[]}
        isAdmin={user.isAdmin}
        defaultBranchId={user.branch_id}
      />
    </>
  )
}

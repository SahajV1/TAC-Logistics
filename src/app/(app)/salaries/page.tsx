import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { SalaryTable } from "./salary-table"
import type { DriverPick, StaffPick } from "./salary-form"
import type { Branch, Salary } from "@/lib/types"

export const metadata = { title: "Salaries" }

export default async function SalariesPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [salaryRes, driverRes, staffRes, branchRes] = await Promise.all([
    supabase
      .from("salaries")
      .select("*, branches(id, name)")
      .order("month", { ascending: false }),
    supabase.from("drivers").select("id, name, branch_id").order("name"),
    supabase.from("profiles").select("id, full_name, branch_id").order("full_name"),
    user.isAdmin
      ? supabase.from("branches").select("id, name").order("name")
      : Promise.resolve({ data: [] }),
  ])

  return (
    <>
      <PageHeader
        title="Salary Management"
        description="Driver and staff salaries with bonus, deductions and payment status."
      />
      <SalaryTable
        salaries={(salaryRes.data ?? []) as Salary[]}
        drivers={(driverRes.data ?? []) as DriverPick[]}
        staff={(staffRes.data ?? []) as StaffPick[]}
        branches={(branchRes.data ?? []) as Pick<Branch, "id" | "name">[]}
        isAdmin={user.isAdmin}
        defaultBranchId={user.branch_id}
      />
    </>
  )
}

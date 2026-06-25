import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { ReportView, type BranchRow, type MonthRow } from "./report-view"
import type { Dispatch } from "@/lib/types"

export const metadata = { title: "Reports" }

const n = (v: unknown) => Number(v || 0)

export default async function ReportsPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const { data } = await supabase
    .from("dispatches")
    .select("*, branches(id, name)")
    .order("dispatch_date", { ascending: false })

  const dispatches = (data ?? []) as Dispatch[]

  // Monthly aggregation
  const monthMap = new Map<string, MonthRow>()
  for (const d of dispatches) {
    const month = d.dispatch_date.slice(0, 7)
    const row =
      monthMap.get(month) ??
      ({ month, trips: 0, fuel: 0, rent: 0, advance: 0, misc: 0, total: 0 } as MonthRow)
    row.trips += 1
    row.fuel += n(d.fuel_cost)
    row.rent += n(d.rent_amount)
    row.advance += n(d.advance_amount)
    row.misc += n(d.misc_amount)
    row.total += n(d.fuel_cost) + n(d.rent_amount) + n(d.advance_amount) + n(d.misc_amount)
    monthMap.set(month, row)
  }
  const monthly = [...monthMap.values()].sort((a, b) =>
    a.month < b.month ? 1 : -1
  )

  // Branch aggregation
  const branchMap = new Map<string, BranchRow>()
  for (const d of dispatches) {
    const branch = d.branches?.name ?? "Unassigned"
    const row =
      branchMap.get(branch) ??
      ({ branch, trips: 0, fuel: 0, rent: 0, total: 0 } as BranchRow)
    row.trips += 1
    row.fuel += n(d.fuel_cost)
    row.rent += n(d.rent_amount)
    row.total += n(d.fuel_cost) + n(d.rent_amount) + n(d.advance_amount) + n(d.misc_amount)
    branchMap.set(branch, row)
  }
  const branchly = [...branchMap.values()].sort((a, b) => b.total - a.total)

  const totals = {
    trips: dispatches.length,
    fuel: dispatches.reduce((a, d) => a + n(d.fuel_cost), 0),
    rent: dispatches.reduce((a, d) => a + n(d.rent_amount), 0),
    advance: dispatches.reduce((a, d) => a + n(d.advance_amount), 0),
    misc: dispatches.reduce((a, d) => a + n(d.misc_amount), 0),
  }

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        description={
          user.isAdmin
            ? "Dispatch, fuel and rent analytics across all branches."
            : `${user.branchName} branch analytics.`
        }
      />
      <ReportView
        monthly={monthly}
        branchly={branchly}
        totals={totals}
        isAdmin={user.isAdmin}
      />
    </>
  )
}

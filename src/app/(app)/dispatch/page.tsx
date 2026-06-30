import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { DispatchTable } from "./dispatch-table"
import type { Dispatch } from "@/lib/types"
import type {
  BranchOption,
  DriverOption,
  TruckOption,
} from "./dispatch-form"

export const metadata = { title: "Dispatch" }

export default async function DispatchPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [dispatchRes, driverRes, truckRes, branchRes, stationRes] =
    await Promise.all([
      supabase
        .from("dispatches")
        .select(
          "*, branches(id, name), creator:profiles!created_by(id, full_name)"
        )
        .order("dispatch_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("drivers")
        .select("id, name, branch_id")
        .eq("status", "active")
        .order("name"),
      supabase
        .from("trucks")
        .select(
          "id, vehicle_number, truck_type, owner_name, owner_phone, branch_id"
        )
        .eq("status", "active")
        .order("vehicle_number"),
      user.isAdmin
        ? supabase.from("branches").select("id, name").order("name")
        : Promise.resolve({ data: [] }),
      supabase
        .from("fuel_stations")
        .select("name")
        .eq("status", "active")
        .order("name"),
    ])

  const fuelStations = ((stationRes.data ?? []) as { name: string }[]).map(
    (s) => s.name
  )

  return (
    <>
      <PageHeader
        title="Truck Dispatch"
        description="Record trips with fuel, advance, toll, rent and miscellaneous costs."
      />
      <DispatchTable
        dispatches={(dispatchRes.data ?? []) as Dispatch[]}
        drivers={(driverRes.data ?? []) as DriverOption[]}
        trucks={(truckRes.data ?? []) as TruckOption[]}
        branches={(branchRes.data ?? []) as BranchOption[]}
        fuelStations={fuelStations}
        isAdmin={user.isAdmin}
        defaultBranchId={user.branch_id}
      />
    </>
  )
}

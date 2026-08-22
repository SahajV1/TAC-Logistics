import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { DispatchTable } from "./dispatch-table"
import { APP_SETTINGS_ID } from "@/lib/constants"
import type { AppSettings, Dispatch } from "@/lib/types"
import type {
  BranchOption,
  DealerOption,
  DriverOption,
  TruckOption,
} from "./dispatch-form"

export const metadata = { title: "Dispatch" }

export default async function DispatchPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [
    dispatchRes,
    driverRes,
    truckRes,
    branchRes,
    stationRes,
    dealerRes,
    settingsRes,
  ] = await Promise.all([
    supabase
      .from("dispatches")
      .select(
        "*, branches(id, name), creator:profiles!created_by(id, full_name), dealers(id, name)"
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
    supabase
      .from("dealers")
      .select("id, name")
      .eq("status", "active")
      .order("name"),
    supabase
      .from("app_settings")
      .select("fuel_price_per_litre")
      .eq("id", APP_SETTINGS_ID)
      .maybeSingle(),
  ])

  const fuelStations = ((stationRes.data ?? []) as { name: string }[]).map(
    (s) => s.name
  )
  const fuelPricePerLitre = Number(
    (settingsRes.data as Pick<AppSettings, "fuel_price_per_litre"> | null)
      ?.fuel_price_per_litre ?? 0
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
        dealers={(dealerRes.data ?? []) as DealerOption[]}
        isAdmin={user.isAdmin}
        defaultBranchId={user.branch_id}
        fuelPricePerLitre={fuelPricePerLitre}
      />
    </>
  )
}

import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { FuelStationTable } from "./fuel-station-table"
import type { FuelStation } from "@/lib/types"

export const metadata = { title: "Fuel Stations" }

export default async function FuelStationsPage() {
  const user = await requireAdmin()
  const supabase = await createClient()

  const { data } = await supabase
    .from("fuel_stations")
    .select("*")
    .order("name")

  return (
    <>
      <PageHeader
        title="Fuel Stations"
        description="Filling stations used across branches."
      />
      <FuelStationTable
        stations={(data ?? []) as FuelStation[]}
        isAdmin={user.isAdmin}
      />
    </>
  )
}

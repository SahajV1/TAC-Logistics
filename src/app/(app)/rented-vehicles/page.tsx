import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { RentedVehiclesView } from "./rented-vehicles-view"
import type { Dealer, Dispatch } from "@/lib/types"

export const metadata = { title: "Rented Vehicles" }

export default async function RentedVehiclesPage() {
  await requireUser()
  const supabase = await createClient()

  const [tripRes, dealerRes] = await Promise.all([
    // Staff see their own branch's rented dispatches (RLS); admins see all.
    supabase
      .from("dispatches")
      .select("*, dealers(id, name)")
      .eq("truck_type", "rented")
      .order("dispatch_date", { ascending: false }),
    supabase
      .from("dealers")
      .select("id, name")
      .eq("status", "active")
      .order("name"),
  ])

  const dealers = ((dealerRes.data ?? []) as Pick<Dealer, "id" | "name">[]).map(
    (d) => ({ id: d.id, name: d.name })
  )

  return (
    <>
      <PageHeader
        title="Rented Vehicles"
        description="Trucks hired from dealers — how many and at what cost, per dealer."
      />
      <RentedVehiclesView
        dealers={dealers}
        trips={(tripRes.data ?? []) as Dispatch[]}
      />
    </>
  )
}

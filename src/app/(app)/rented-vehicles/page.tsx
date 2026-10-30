import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { fetchAll } from "@/lib/supabase/fetch-all"
import { PageHeader } from "@/components/page-header"
import { RentedVehiclesView } from "./rented-vehicles-view"
import type { Dealer, Dispatch } from "@/lib/types"

export const metadata = { title: "Rented Vehicles" }

export default async function RentedVehiclesPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [tripRes, dealerRes, branchRes] = await Promise.all([
    // Staff see their own branch's rented dispatches (RLS); admins see all.
    fetchAll<Dispatch>((from, to) =>
      supabase
        .from("dispatches")
        .select("*, dealers(id, name)")
        .eq("truck_type", "rented")
        .order("dispatch_date", { ascending: false })
        .order("id")
        .range(from, to)
    ),
    supabase
      .from("dealers")
      .select("id, name")
      .eq("status", "active")
      .order("name"),
    user.isAdmin
      ? supabase.from("branches").select("id, name").order("name")
      : Promise.resolve({ data: [] }),
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
        trips={tripRes.data ?? []}
        branches={
          user.isAdmin
            ? ((branchRes.data ?? []) as { id: string; name: string }[])
            : undefined
        }
      />
    </>
  )
}

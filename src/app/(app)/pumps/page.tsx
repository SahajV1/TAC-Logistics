import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { fetchAll } from "@/lib/supabase/fetch-all"
import { PageHeader } from "@/components/page-header"
import { PumpLedger, type PumpFillUp } from "./pump-ledger"
import type {
  DealerTransaction,
  FuelStation,
  FuelStationPayment,
} from "@/lib/types"

export const metadata = { title: "Petrol Pumps" }

export default async function PumpsPage() {
  await requireUser()
  const supabase = await createClient()

  const [stationRes, fillUpRes, offsetRes, paymentRes] = await Promise.all([
    supabase.from("fuel_stations").select("*").order("name"),
    // Truck fill-ups recorded on dispatches. Staff see their own branch's
    // dispatches (RLS); admins see all branches.
    fetchAll<PumpFillUp>((from, to) =>
      supabase
        .from("dispatches")
        .select(
          "id, dispatch_date, vehicle_number, driver_name, from_location, to_location, fuel_litres, fuel_cost, fuel_station"
        )
        .not("fuel_station", "is", null)
        .order("dispatch_date", { ascending: false })
        .order("id")
        .range(from, to)
    ),
    fetchAll<DealerTransaction>((from, to) =>
      supabase
        .from("dealer_transactions")
        .select("*, dealers(id, name)")
        .eq("txn_type", "fuel_offset")
        .order("txn_date", { ascending: false })
        .order("id")
        .range(from, to)
    ),
    fetchAll<FuelStationPayment>((from, to) =>
      supabase
        .from("fuel_station_payments")
        .select("*")
        .order("pay_date", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to)
    ),
  ])

  return (
    <>
      <PageHeader
        title="Petrol Pumps"
        description="Fuel taken on credit at each affiliated pump (truck fill-ups + dealer fuel) and what is left to pay."
      />
      <PumpLedger
        stations={(stationRes.data ?? []) as FuelStation[]}
        fillUps={fillUpRes.data ?? []}
        dealerFuel={offsetRes.data ?? []}
        payments={paymentRes.data ?? []}
      />
    </>
  )
}

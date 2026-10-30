import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { fetchAll } from "@/lib/supabase/fetch-all"
import { PageHeader } from "@/components/page-header"
import { DealerLedger } from "./dealer-ledger"
import type { Dealer, DealerTransaction } from "@/lib/types"

export const metadata = { title: "Dealer Ledger" }

export default async function DealersPage() {
  await requireUser()
  const supabase = await createClient()

  const [dealerRes, txnRes, stationRes] = await Promise.all([
    supabase.from("dealers").select("*").order("name"),
    fetchAll<DealerTransaction>((from, to) =>
      supabase
        .from("dealer_transactions")
        .select("*, dealers(id, name)")
        .order("txn_date", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to)
    ),
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
        title="Dealer Ledger"
        description="Money owed to truck dealers, settled via fuel taken at our affiliated pumps or cash payments."
      />
      <DealerLedger
        dealers={(dealerRes.data ?? []) as Dealer[]}
        transactions={txnRes.data ?? []}
        fuelStations={fuelStations}
      />
    </>
  )
}

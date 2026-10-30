import "server-only"
import { createClient } from "@/lib/supabase/server"
import { normKey } from "@/lib/import"

/** The dealer ledger entries a rented dispatch generates. */
export function dispatchLedgerRows(d: {
  dispatch_id: string
  dealer_id: string
  dispatch_date: string
  vehicle_number: string
  rent_amount: number
  rented_advance_amount: number
  rented_fuel_litres: number
  rented_fuel_cost: number
  rented_fuel_station: string | null
  created_by: string
}) {
  const shared = {
    dealer_id: d.dealer_id,
    dispatch_id: d.dispatch_id,
    txn_date: d.dispatch_date,
    reference: d.vehicle_number,
    created_by: d.created_by,
  }
  const rows = []
  if (d.rent_amount > 0) {
    rows.push({
      ...shared,
      txn_type: "due" as const,
      amount: d.rent_amount,
      notes: "Auto: rent for this dispatch",
    })
  }
  if (d.rented_advance_amount > 0) {
    rows.push({
      ...shared,
      txn_type: "payment" as const,
      amount: d.rented_advance_amount,
      notes: "Auto: advance given for this dispatch",
    })
  }
  if (d.rented_fuel_litres > 0 && d.rented_fuel_cost > 0) {
    rows.push({
      ...shared,
      txn_type: "fuel_offset" as const,
      amount: d.rented_fuel_cost,
      fuel_station: d.rented_fuel_station,
      fuel_litres: d.rented_fuel_litres,
      notes: "Auto: fuel taken by dealer's truck",
    })
  }
  return rows
}

/**
 * Creates any dealers named in an upload that don't exist yet and adds them to
 * `known` (normKey(name) → id). Runs on the regular client: any signed-in user
 * may create dealers (see the dealers_all RLS policy).
 */
export async function ensureDealers(
  names: string[],
  known: Map<string, string>,
  userId: string
): Promise<{ error?: string }> {
  const missing = new Map<string, string>()
  for (const name of names) {
    if (!known.has(normKey(name))) missing.set(normKey(name), name)
  }
  if (missing.size === 0) return {}

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("dealers")
    .insert([...missing.values()].map((name) => ({ name, created_by: userId })))
    .select("id, name")
  if (error) return { error: error.message }
  for (const d of data) known.set(normKey(d.name), d.id)
  return {}
}

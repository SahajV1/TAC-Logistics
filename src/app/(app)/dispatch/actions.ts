"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireUser } from "@/lib/auth"
import { dispatchSchema } from "@/lib/schemas"
import { APP_SETTINGS_ID } from "@/lib/constants"

type Result = { error?: string }

// Add a fuel station to the master list so it appears in the dropdown next time.
// Best-effort: a failure here must never block saving the dispatch itself.
// Uses the service-role client so any staff member (not just admins) can grow
// the list straight from the dispatch form.
async function rememberFuelStation(name: string, createdBy: string) {
  try {
    await createAdminClient()
      .from("fuel_stations")
      .upsert(
        { name, created_by: createdBy },
        { onConflict: "name", ignoreDuplicates: true }
      )
  } catch {
    // table missing / network — ignore, the dispatch still saves
  }
}

// Resolve the dealer this rented truck is from: use the picked dealer's id,
// or — if the user typed a new dealer name inline — reuse an existing dealer
// of that name or create one. Any authenticated user may create dealers (see
// the dealers_all RLS policy), so this runs on the regular client.
async function resolveDealerId(
  dealerId: string | undefined,
  newDealerName: string | undefined,
  userId: string
): Promise<string | null> {
  if (dealerId) return dealerId
  const name = newDealerName?.trim()
  if (!name) return null

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from("dealers")
    .select("id")
    .eq("name", name)
    .maybeSingle()
  if (existing) return existing.id

  const { data: created } = await supabase
    .from("dealers")
    .insert({ name, created_by: userId })
    .select("id")
    .single()
  return created?.id ?? null
}

export async function saveDispatch(
  id: string | null,
  values: unknown
): Promise<Result> {
  const user = await requireUser()
  const parsed = dispatchSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" }
  }
  const v = parsed.data

  const branch_id = user.isAdmin ? v.branch_id : user.branch_id
  if (!branch_id) return { error: "Please choose a branch." }

  const fuel_station = v.fuel_station?.trim() || null
  if (fuel_station) await rememberFuelStation(fuel_station, user.id)

  // Fuel cost is never taken from the client — recompute from litres × the
  // admin-set rate so it can't drift from what the dispatch form showed.
  const supabase = await createClient()
  const { data: settings } = await supabase
    .from("app_settings")
    .select("fuel_price_per_litre")
    .eq("id", APP_SETTINGS_ID)
    .maybeSingle()
  const rate = Number(settings?.fuel_price_per_litre ?? 0)
  const fuel_cost = Math.round(v.fuel_litres * rate * 100) / 100

  const rented_fuel_litres = v.truck_type === "rented" ? v.rented_fuel_litres : 0
  const rented_fuel_cost = Math.round(rented_fuel_litres * rate * 100) / 100
  const rented_advance_amount =
    v.truck_type === "rented" ? v.rented_advance_amount : 0
  const rented_fuel_station =
    v.truck_type === "rented" && rented_fuel_litres > 0
      ? v.rented_fuel_station?.trim() || null
      : null

  const dealer_id =
    v.truck_type === "rented"
      ? await resolveDealerId(v.dealer_id, v.new_dealer_name, user.id)
      : null
  if (v.truck_type === "rented" && !dealer_id) {
    return { error: "Select or add the dealer this truck is rented from" }
  }

  const payload = {
    branch_id,
    dispatch_date: v.dispatch_date,
    driver_id: v.driver_id || null,
    driver_name: v.driver_name,
    truck_id: v.truck_id || null,
    vehicle_number: v.vehicle_number,
    from_location: v.from_location,
    to_location: v.to_location,
    fuel_litres: v.fuel_litres,
    fuel_cost,
    advance_amount: v.advance_amount,
    misc_amount: v.misc_amount,
    toll_amount: v.toll_amount,
    remarks: v.remarks || null,
    truck_type: v.truck_type,
    owner_details: v.truck_type === "rented" ? v.owner_details || null : null,
    rent_amount: v.truck_type === "rented" ? v.rent_amount : 0,
    rented_advance_amount,
    rented_fuel_litres,
    rented_fuel_cost,
    rented_fuel_station,
    dealer_id,
    fuel_station,
    status: v.status,
  }

  let dispatchId = id
  if (id) {
    const { error } = await supabase
      .from("dispatches")
      .update(payload)
      .eq("id", id)
    if (error) return { error: error.message }
  } else {
    const { data, error } = await supabase
      .from("dispatches")
      .insert({ ...payload, created_by: user.id })
      .select("id")
      .single()
    if (error) return { error: error.message }
    dispatchId = data.id
  }

  // Auto-generated ledger entries for this dispatch are always cleared and
  // rebuilt from the current values, so edits (or switching away from
  // "rented") never leave stale entries behind.
  if (dispatchId) {
    await supabase.from("dealer_transactions").delete().eq("dispatch_id", dispatchId)

    if (dealer_id) {
      const rows = []
      if (payload.rent_amount > 0) {
        rows.push({
          dealer_id,
          dispatch_id: dispatchId,
          txn_date: v.dispatch_date,
          txn_type: "due" as const,
          amount: payload.rent_amount,
          reference: v.vehicle_number,
          notes: "Auto: rent for this dispatch",
          created_by: user.id,
        })
      }
      if (rented_advance_amount > 0) {
        rows.push({
          dealer_id,
          dispatch_id: dispatchId,
          txn_date: v.dispatch_date,
          txn_type: "payment" as const,
          amount: rented_advance_amount,
          reference: v.vehicle_number,
          notes: "Auto: advance given for this dispatch",
          created_by: user.id,
        })
      }
      if (rented_fuel_litres > 0 && rented_fuel_cost > 0) {
        rows.push({
          dealer_id,
          dispatch_id: dispatchId,
          txn_date: v.dispatch_date,
          txn_type: "fuel_offset" as const,
          amount: rented_fuel_cost,
          fuel_station: rented_fuel_station,
          fuel_litres: rented_fuel_litres,
          reference: v.vehicle_number,
          notes: "Auto: fuel taken by dealer's truck",
          created_by: user.id,
        })
      }
      if (rows.length) {
        const { error } = await supabase.from("dealer_transactions").insert(rows)
        if (error)
          return {
            error: `Dispatch saved, but dealer ledger update failed: ${error.message}`,
          }
      }
    }
  }

  revalidatePath("/dispatch")
  revalidatePath("/rented-vehicles")
  revalidatePath("/dealers")
  revalidatePath("/")
  return {}
}

export async function deleteDispatch(id: string): Promise<Result> {
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.from("dispatches").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/dispatch")
  revalidatePath("/rented-vehicles")
  revalidatePath("/dealers")
  revalidatePath("/")
  return {}
}

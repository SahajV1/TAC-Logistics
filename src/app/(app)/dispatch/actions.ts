"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { fetchAll } from "@/lib/supabase/fetch-all"
import { requireUser } from "@/lib/auth"
import { dispatchSchema, importRequestSchema } from "@/lib/schemas"
import { APP_SETTINGS_ID } from "@/lib/constants"
import { dispatchLedgerRows, ensureDealers } from "@/lib/dealer-ledger"
import { rememberFuelStations } from "@/lib/fuel-stations"
import { formatDate } from "@/lib/format"
import {
  duplicateTracker,
  importFailure,
  normKey,
  parseDate,
  parseDispatchStatus,
  parseTruckType,
  readRow,
  resolveBranch,
  rowResult,
  shouldImport,
  type ImportResult,
  type ImportRowResult,
} from "@/lib/import"
import type { TruckType } from "@/lib/types"

type Result = { error?: string }

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
  if (fuel_station) await rememberFuelStations([fuel_station], user.id)

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
      const rows = dispatchLedgerRows({
        ...payload,
        dispatch_id: dispatchId,
        dealer_id,
        created_by: user.id,
      })
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

// How many ids to delete per request when undoing an upload; a longer list
// would not fit in the request URL.
const ROLLBACK_BATCH = 200

/**
 * Checks a sheet of dispatches and, when `options.commit` is set, saves them.
 * Both passes run the same validation, so the preview is what gets saved.
 * Mirrors saveDispatch, with these upload-only rules:
 *  - Fuel cost comes from litres × the admin rate as usual, except that an
 *    admin's sheet can state it. Old trips were bought at an older rate, and
 *    pump balances are built from these amounts.
 *  - Any dispatch whose date, vehicle and route already exist is held back as
 *    a duplicate, since uploading a sheet twice would double every total.
 */
async function runDispatchImport(
  rows: unknown,
  options: unknown,
  mode: "all" | "rented"
): Promise<ImportResult> {
  const user = await requireUser()
  const request = importRequestSchema.safeParse({ rows, options })
  if (!request.success) {
    return importFailure("This sheet could not be read. Please check it and try again.")
  }
  const { rows: sheetRows, options: opts } = request.data
  const supabase = await createClient()

  const dates = sheetRows
    .map((r) => parseDate(r.cells.date))
    .filter((d): d is string => !!d)
    .sort()

  const [branchRes, truckRes, driverRes, dealerRes, stationRes, settingsRes, existingRes] =
    await Promise.all([
      supabase.from("branches").select("id, name"),
      fetchAll<{
        id: string
        vehicle_number: string
        truck_type: TruckType
        owner_name: string | null
        owner_phone: string | null
        branch_id: string
      }>((from, to) =>
        supabase
          .from("trucks")
          .select("id, vehicle_number, truck_type, owner_name, owner_phone, branch_id")
          .order("id")
          .range(from, to)
      ),
      fetchAll<{ id: string; name: string; branch_id: string }>((from, to) =>
        supabase.from("drivers").select("id, name, branch_id").order("id").range(from, to)
      ),
      supabase.from("dealers").select("id, name"),
      supabase.from("fuel_stations").select("name"),
      supabase
        .from("app_settings")
        .select("fuel_price_per_litre")
        .eq("id", APP_SETTINGS_ID)
        .maybeSingle(),
      dates.length
        ? fetchAll<{
            branch_id: string
            dispatch_date: string
            vehicle_number: string
            from_location: string
            to_location: string
          }>((from, to) =>
            supabase
              .from("dispatches")
              .select("branch_id, dispatch_date, vehicle_number, from_location, to_location")
              .gte("dispatch_date", dates[0])
              .lte("dispatch_date", dates[dates.length - 1])
              .order("id")
              .range(from, to)
          )
        : Promise.resolve({ data: [], error: null }),
    ])

  const lookupError =
    branchRes.error ?? truckRes.error ?? driverRes.error ?? dealerRes.error ?? existingRes.error
  if (lookupError) return importFailure(lookupError.message)

  const rate = Number(settingsRes.data?.fuel_price_per_litre ?? 0)
  const branches = (branchRes.data ?? []) as { id: string; name: string }[]

  const trucksByNumber = new Map<string, NonNullable<typeof truckRes.data>>()
  for (const t of truckRes.data ?? []) {
    const key = normKey(t.vehicle_number)
    trucksByNumber.set(key, [...(trucksByNumber.get(key) ?? []), t])
  }
  const driversByName = new Map<string, NonNullable<typeof driverRes.data>>()
  for (const d of driverRes.data ?? []) {
    const key = normKey(d.name)
    driversByName.set(key, [...(driversByName.get(key) ?? []), d])
  }
  const dealerIds = new Map<string, string>(
    ((dealerRes.data ?? []) as { id: string; name: string }[]).map((d) => [
      normKey(d.name),
      d.id,
    ])
  )
  // Spelling on the master list wins, so "ss fillings" can't split one pump's
  // balance into two (the ledgers group by the exact station name).
  const stationNames = new Map<string, string>(
    ((stationRes.data ?? []) as { name: string }[]).map((s) => [normKey(s.name), s.name])
  )

  const dupKey = (
    branch: string,
    date: string,
    vehicle: string,
    from: string,
    to: string
  ) => [branch, date, normKey(vehicle), normKey(from), normKey(to)].join("|")
  const duplicateOf = duplicateTracker(
    (existingRes.data ?? []).map((d) =>
      dupKey(d.branch_id, d.dispatch_date, d.vehicle_number, d.from_location, d.to_location)
    )
  )

  const prepared = sheetRows.map(({ row, cells }) => {
    const r = readRow(cells)
    const notes: string[] = []

    const dispatch_date = r.date("date", "Date")
    const vehicleText = r.text("vehicle")
    const driver_name = r.text("driver")
    const from_location = r.text("from")
    const to_location = r.text("to")
    const dealerName = r.text("dealer")
    const rent_cell = r.num("rent", "Rent")

    const trucks = trucksByNumber.get(normKey(vehicleText)) ?? []
    const branch = resolveBranch(r.text("branch"), {
      isAdmin: user.isAdmin,
      userBranchId: user.branch_id,
      branches,
      inferred: trucks.length === 1 ? trucks[0].branch_id : null,
      fallback: opts.branchId,
    })
    if (branch.error) r.errors.push(branch.error)
    const branch_id = branch.id ?? ""

    const truck = trucks.find((t) => t.branch_id === branch_id)
    const vehicle_number = truck?.vehicle_number ?? vehicleText
    const driver = (driversByName.get(normKey(driver_name)) ?? []).find(
      (d) => d.branch_id === branch_id
    )

    const typeText = r.text("truck_type")
    const statedType = parseTruckType(typeText)
    if (typeText && !statedType) {
      r.errors.push(`Truck Type "${typeText}" should be Company or Rented`)
    }
    const truck_type: TruckType =
      mode === "rented"
        ? "rented"
        : (statedType ??
          truck?.truck_type ??
          (rent_cell > 0 || dealerName ? "rented" : "company"))
    const rented = truck_type === "rented"
    if (!rented && rent_cell > 0) {
      notes.push("Rent is ignored because this is a company truck")
    }

    const statusText = r.text("status")
    const status = statusText ? parseDispatchStatus(statusText) : "completed"
    if (!status) r.errors.push(`Unknown status "${statusText}"`)

    const stationFor = (name: string) => {
      if (!name) return ""
      const known = stationNames.get(normKey(name))
      if (!known) notes.push(`New petrol pump "${name}" will be added`)
      return known ?? name
    }
    const costFor = (litres: number, stated: number, label: string) => {
      const calculated = Math.round(litres * rate * 100) / 100
      if (user.isAdmin && stated > 0) return stated
      if (stated > 0 && Math.abs(stated - calculated) >= 0.01) {
        notes.push(`${label} ${stated} replaced by ${calculated} (litres × admin rate)`)
      }
      if (litres > 0 && calculated === 0) {
        notes.push("Fuel price is not set, so fuel cost will be ₹0")
      }
      return calculated
    }

    const fuel_litres = r.num("fuel_litres", "Fuel Litres")
    const fuel_cost = costFor(fuel_litres, r.num("fuel_cost", "Fuel Cost"), "Fuel Cost")
    const fuel_station = stationFor(r.text("fuel_station"))
    const rented_fuel_litres = rented ? r.num("rented_fuel_litres", "Rented Fuel Litres") : 0
    const rented_fuel_cost = rented
      ? costFor(rented_fuel_litres, r.num("rented_fuel_cost", "Rented Fuel Cost"), "Rented Fuel Cost")
      : 0
    const rented_fuel_station =
      rented_fuel_litres > 0 ? stationFor(r.text("rented_fuel_station")) : ""

    const dealer_id = rented ? dealerIds.get(normKey(dealerName)) : undefined
    if (rented && dealerName && !dealer_id) {
      notes.push(`New dealer "${dealerName}" will be added`)
    }
    const owner_details =
      r.text("owner_details") ||
      [truck?.owner_name, truck?.owner_phone].filter(Boolean).join(" · ") ||
      dealerName

    const values = {
      dispatch_date,
      driver_name,
      vehicle_number,
      from_location,
      to_location,
      fuel_litres,
      fuel_cost,
      advance_amount: r.num("advance", "Advance"),
      misc_amount: r.num("misc", "Misc"),
      toll_amount: r.num("toll", "Toll"),
      remarks: r.text("remarks"),
      truck_type,
      owner_details,
      rent_amount: rented ? rent_cell : 0,
      rented_advance_amount: rented ? r.num("rented_advance", "Rented Advance") : 0,
      rented_fuel_litres,
      rented_fuel_station,
      dealer_id,
      new_dealer_name: dealer_id ? "" : dealerName,
      fuel_station,
      status: status ?? "completed",
    }

    const parsed = dispatchSchema.safeParse(values)
    if (!parsed.success) r.errors.push(...parsed.error.issues.map((i) => i.message))

    const duplicate = r.errors.length
      ? null
      : duplicateOf(
          dupKey(branch_id, dispatch_date, vehicle_number, from_location, to_location),
          row
        )
    const summary = [
      parseDate(dispatch_date) ? formatDate(dispatch_date) : dispatch_date,
      vehicle_number,
      from_location && to_location ? `${from_location} → ${to_location}` : "",
    ]
      .filter(Boolean)
      .join(" · ")

    return {
      result: rowResult(row, summary, r.errors, duplicate, notes),
      dealerName: rented ? dealerName : "",
      payload: {
        id: crypto.randomUUID(),
        branch_id,
        dispatch_date,
        driver_id: driver?.id ?? null,
        driver_name,
        truck_id: truck?.id ?? null,
        vehicle_number,
        from_location,
        to_location,
        fuel_litres,
        fuel_cost,
        advance_amount: values.advance_amount,
        misc_amount: values.misc_amount,
        toll_amount: values.toll_amount,
        remarks: values.remarks || null,
        truck_type,
        owner_details: rented ? owner_details || null : null,
        rent_amount: values.rent_amount,
        rented_advance_amount: values.rented_advance_amount,
        rented_fuel_litres,
        rented_fuel_cost,
        rented_fuel_station: rented_fuel_station || null,
        fuel_station: fuel_station || null,
        status: status ?? "completed",
        created_by: user.id,
      },
    }
  })

  const results: ImportRowResult[] = prepared.map((p) => p.result)
  if (!opts.commit) return { rows: results, imported: 0 }

  const chosen = prepared.filter((p) => shouldImport(p.result, opts))
  if (chosen.length === 0) return { rows: results, imported: 0 }

  const dealers = await ensureDealers(
    chosen.map((p) => p.dealerName).filter(Boolean),
    dealerIds,
    user.id
  )
  if (dealers.error) return importFailure(dealers.error)

  await rememberFuelStations(
    [
      ...new Set(
        chosen
          .flatMap((p) => [p.payload.fuel_station, p.payload.rented_fuel_station])
          .filter((s): s is string => !!s && !stationNames.has(normKey(s)))
      ),
    ],
    user.id
  )

  const payloads = chosen.map((p) => ({
    ...p.payload,
    dealer_id: p.dealerName ? (dealerIds.get(normKey(p.dealerName)) ?? null) : null,
  }))

  const { error } = await supabase.from("dispatches").insert(payloads)
  if (error) return importFailure(error.message)

  const ledgerRows = payloads.flatMap((p) =>
    p.dealer_id
      ? dispatchLedgerRows({ ...p, dispatch_id: p.id, dealer_id: p.dealer_id })
      : []
  )
  if (ledgerRows.length) {
    const { error: ledgerError } = await supabase
      .from("dealer_transactions")
      .insert(ledgerRows)
    if (ledgerError) {
      // No transaction across the two inserts, so undo the dispatches rather
      // than leave rented trips with no matching dealer ledger entries.
      for (let i = 0; i < payloads.length; i += ROLLBACK_BATCH) {
        await supabase
          .from("dispatches")
          .delete()
          .in("id", payloads.slice(i, i + ROLLBACK_BATCH).map((p) => p.id))
      }
      return importFailure(
        `Nothing was saved: the dealer ledger update failed (${ledgerError.message}).`
      )
    }
  }

  revalidatePath("/dispatch")
  revalidatePath("/rented-vehicles")
  revalidatePath("/dealers")
  revalidatePath("/pumps")
  revalidatePath("/")
  return { rows: results, imported: payloads.length }
}

export async function importDispatches(rows: unknown, options: unknown) {
  return runDispatchImport(rows, options, "all")
}

export async function importRentedDispatches(rows: unknown, options: unknown) {
  return runDispatchImport(rows, options, "rented")
}

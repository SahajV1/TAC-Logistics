"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { fetchAll } from "@/lib/supabase/fetch-all"
import { requireUser } from "@/lib/auth"
import {
  dealerSchema,
  dealerTransactionSchema,
  importRequestSchema,
} from "@/lib/schemas"
import { ensureDealers } from "@/lib/dealer-ledger"
import { rememberFuelStations } from "@/lib/fuel-stations"
import { DEALER_TXN_TYPE_LABELS } from "@/lib/constants"
import { formatCurrency, formatDate } from "@/lib/format"
import {
  duplicateTracker,
  importFailure,
  normKey,
  parseDate,
  parseTxnType,
  readRow,
  rowResult,
  shouldImport,
  type ImportResult,
} from "@/lib/import"

type Result = { error?: string }

export async function saveDealer(
  id: string | null,
  values: unknown
): Promise<Result> {
  const user = await requireUser()
  const parsed = dealerSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" }
  }
  const v = parsed.data

  const payload = {
    name: v.name,
    phone: v.phone || null,
    address: v.address || null,
    notes: v.notes || null,
    status: v.status,
  }

  const supabase = await createClient()
  if (id) {
    const { error } = await supabase.from("dealers").update(payload).eq("id", id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from("dealers")
      .insert({ ...payload, created_by: user.id })
    if (error) return { error: error.message }
  }

  revalidatePath("/dealers")
  return {}
}

export async function deleteDealer(id: string): Promise<Result> {
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.from("dealers").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/dealers")
  return {}
}

export async function saveDealerTransaction(
  id: string | null,
  values: unknown
): Promise<Result> {
  const user = await requireUser()
  const parsed = dealerTransactionSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" }
  }
  const v = parsed.data

  const payload = {
    dealer_id: v.dealer_id,
    txn_date: v.txn_date,
    txn_type: v.txn_type,
    amount: v.amount,
    fuel_station: v.txn_type === "fuel_offset" ? v.fuel_station || null : null,
    fuel_litres: v.txn_type === "fuel_offset" ? v.fuel_litres || null : null,
    reference: v.reference || null,
    notes: v.notes || null,
  }

  const supabase = await createClient()
  if (id) {
    const { error } = await supabase
      .from("dealer_transactions")
      .update(payload)
      .eq("id", id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from("dealer_transactions")
      .insert({ ...payload, created_by: user.id })
    if (error) return { error: error.message }
  }

  revalidatePath("/dealers")
  return {}
}

export async function deleteDealerTransaction(id: string): Promise<Result> {
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("dealer_transactions")
    .delete()
    .eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/dealers")
  return {}
}

/**
 * Checks a sheet of dealer ledger entries and, when `options.commit` is set,
 * saves them. Entries are duplicates on dealer, date, type and amount; the
 * reference is left out on purpose, because a client sheet often has it blank
 * and a missed duplicate would double a dealer's balance. Fuel entries also
 * feed the Petrol Pumps page.
 */
export async function importDealerTransactions(
  rows: unknown,
  options: unknown
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

  const [dealerRes, stationRes, existingRes] = await Promise.all([
    supabase.from("dealers").select("id, name"),
    supabase.from("fuel_stations").select("name"),
    dates.length
      ? fetchAll<{
          dealer_id: string
          txn_date: string
          txn_type: string
          amount: number
        }>((from, to) =>
          supabase
            .from("dealer_transactions")
            .select("dealer_id, txn_date, txn_type, amount")
            .gte("txn_date", dates[0])
            .lte("txn_date", dates[dates.length - 1])
            .order("id")
            .range(from, to)
        )
      : Promise.resolve({ data: [], error: null }),
  ])
  const lookupError = dealerRes.error ?? existingRes.error
  if (lookupError) return importFailure(lookupError.message)

  const dealerIds = new Map<string, string>(
    ((dealerRes.data ?? []) as { id: string; name: string }[]).map((d) => [
      normKey(d.name),
      d.id,
    ])
  )
  const stationNames = new Map<string, string>(
    ((stationRes.data ?? []) as { name: string }[]).map((s) => [normKey(s.name), s.name])
  )

  const dupKey = (dealer: string, date: string, type: string, amount: number) =>
    [dealer, date, type, Number(amount).toFixed(2)].join("|")
  const duplicateOf = duplicateTracker(
    (existingRes.data ?? []).map((t) =>
      dupKey(t.dealer_id, t.txn_date, t.txn_type, t.amount)
    )
  )

  const prepared = sheetRows.map(({ row, cells }) => {
    const r = readRow(cells)
    const notes: string[] = []

    const txn_date = r.date("date", "Date")
    const dealerName = r.text("dealer")
    const dealer_id = dealerIds.get(normKey(dealerName))
    if (dealerName && !dealer_id) notes.push(`New dealer "${dealerName}" will be added`)

    const typeText = r.text("type")
    const txn_type = parseTxnType(typeText)
    if (!txn_type) {
      r.errors.push(
        typeText
          ? `Type "${typeText}" should be Due, Fuel or Payment`
          : "Type is missing (Due, Fuel or Payment)"
      )
    }
    const isFuel = txn_type === "fuel_offset"

    const stationText = isFuel ? r.text("fuel_station") : ""
    const fuel_station = stationNames.get(normKey(stationText)) ?? stationText
    if (stationText && !stationNames.has(normKey(stationText))) {
      notes.push(`New petrol pump "${stationText}" will be added`)
    }

    const values = {
      dealer_id: dealer_id ?? (dealerName ? "new" : ""),
      txn_type: txn_type ?? "due",
      txn_date,
      amount: r.num("amount", "Amount"),
      fuel_station,
      fuel_litres: isFuel ? r.num("fuel_litres", "Fuel Litres") : 0,
      reference: r.text("reference"),
      notes: r.text("notes"),
    }
    const parsed = dealerTransactionSchema.safeParse(values)
    if (!parsed.success) r.errors.push(...parsed.error.issues.map((i) => i.message))

    const duplicate = r.errors.length
      ? null
      : duplicateOf(
          dupKey(dealer_id ?? normKey(dealerName), txn_date, values.txn_type, values.amount),
          row
        )
    const summary = [
      parseDate(txn_date) ? formatDate(txn_date) : txn_date,
      dealerName,
      txn_type ? DEALER_TXN_TYPE_LABELS[txn_type] : "",
      values.amount ? formatCurrency(values.amount) : "",
    ]
      .filter(Boolean)
      .join(" · ")

    return {
      result: rowResult(row, summary, r.errors, duplicate, notes),
      dealerName,
      payload: {
        txn_date,
        txn_type: values.txn_type,
        amount: values.amount,
        fuel_station: fuel_station || null,
        fuel_litres: values.fuel_litres || null,
        reference: values.reference || null,
        notes: values.notes || null,
        created_by: user.id,
      },
    }
  })

  const results = prepared.map((p) => p.result)
  if (!opts.commit) return { rows: results, imported: 0 }

  const chosen = prepared.filter((p) => shouldImport(p.result, opts))
  if (chosen.length === 0) return { rows: results, imported: 0 }

  const dealers = await ensureDealers(
    chosen.map((p) => p.dealerName),
    dealerIds,
    user.id
  )
  if (dealers.error) return importFailure(dealers.error)

  await rememberFuelStations(
    [
      ...new Set(
        chosen
          .map((p) => p.payload.fuel_station)
          .filter((s): s is string => !!s && !stationNames.has(normKey(s)))
      ),
    ],
    user.id
  )

  const { error } = await supabase.from("dealer_transactions").insert(
    chosen.map((p) => ({
      ...p.payload,
      dealer_id: dealerIds.get(normKey(p.dealerName)),
    }))
  )
  if (error) return importFailure(error.message)

  revalidatePath("/dealers")
  revalidatePath("/pumps")
  return { rows: results, imported: chosen.length }
}

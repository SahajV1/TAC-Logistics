"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { fetchAll } from "@/lib/supabase/fetch-all"
import { requireUser } from "@/lib/auth"
import { importRequestSchema, pumpPaymentSchema } from "@/lib/schemas"
import { rememberFuelStations } from "@/lib/fuel-stations"
import { formatCurrency, formatDate } from "@/lib/format"
import {
  duplicateTracker,
  importFailure,
  normKey,
  parseDate,
  readRow,
  rowResult,
  shouldImport,
  type ImportResult,
} from "@/lib/import"

type Result = { error?: string }

export async function savePumpPayment(
  id: string | null,
  values: unknown
): Promise<Result> {
  const user = await requireUser()
  const parsed = pumpPaymentSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" }
  }
  const v = parsed.data

  const payload = {
    fuel_station: v.fuel_station,
    pay_date: v.pay_date,
    amount: v.amount,
    reference: v.reference || null,
    notes: v.notes || null,
  }

  const supabase = await createClient()
  if (id) {
    const { error } = await supabase
      .from("fuel_station_payments")
      .update(payload)
      .eq("id", id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from("fuel_station_payments")
      .insert({ ...payload, created_by: user.id })
    if (error) return { error: error.message }
  }

  revalidatePath("/pumps")
  return {}
}

export async function deletePumpPayment(id: string): Promise<Result> {
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("fuel_station_payments")
    .delete()
    .eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/pumps")
  return {}
}

/**
 * Checks a sheet of pump payments and, when `options.commit` is set, saves them.
 * Payments are the only thing this page owns: fuel taken is worked out from
 * dispatches and dealer entries, so accepting it here would count it twice. Rows
 * of a pump export marked as fill-ups are refused for that reason, and a
 * payment's negative export amount is read as the amount paid.
 */
export async function importPumpPayments(
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

  const [stationRes, existingRes] = await Promise.all([
    supabase.from("fuel_stations").select("name"),
    dates.length
      ? fetchAll<{ fuel_station: string; pay_date: string; amount: number }>(
          (from, to) =>
            supabase
              .from("fuel_station_payments")
              .select("fuel_station, pay_date, amount")
              .gte("pay_date", dates[0])
              .lte("pay_date", dates[dates.length - 1])
              .order("id")
              .range(from, to)
        )
      : Promise.resolve({ data: [], error: null }),
  ])
  if (existingRes.error) return importFailure(existingRes.error.message)

  const stationNames = new Map<string, string>(
    ((stationRes.data ?? []) as { name: string }[]).map((s) => [normKey(s.name), s.name])
  )

  const dupKey = (station: string, date: string, amount: number) =>
    [normKey(station), date, Number(amount).toFixed(2)].join("|")
  const duplicateOf = duplicateTracker(
    (existingRes.data ?? []).map((p) => dupKey(p.fuel_station, p.pay_date, p.amount))
  )

  const prepared = sheetRows.map(({ row, cells }) => {
    const r = readRow(cells)
    const notes: string[] = []

    const stationText = r.text("pump")
    const fuel_station = stationNames.get(normKey(stationText)) ?? stationText
    if (stationText && !stationNames.has(normKey(stationText))) {
      notes.push(`New petrol pump "${stationText}" will be added`)
    }

    const type = r.text("type")
    if (type && normKey(type) !== "payment") {
      r.errors.push(`"${type}" rows can't be uploaded: fuel comes from Dispatch and the Dealer Ledger`)
    }

    const values = {
      fuel_station,
      pay_date: r.date("date", "Date"),
      amount: Math.abs(r.num("amount", "Amount", { allowNegative: true })),
      reference: r.text("reference"),
      notes: r.text("notes"),
    }
    const parsed = pumpPaymentSchema.safeParse(values)
    if (!parsed.success) r.errors.push(...parsed.error.issues.map((i) => i.message))

    const duplicate = r.errors.length
      ? null
      : duplicateOf(dupKey(fuel_station, values.pay_date, values.amount), row)
    const summary = [
      parseDate(values.pay_date) ? formatDate(values.pay_date) : values.pay_date,
      fuel_station,
      values.amount ? formatCurrency(values.amount) : "",
    ]
      .filter(Boolean)
      .join(" · ")

    return {
      result: rowResult(row, summary, r.errors, duplicate, notes),
      payload: {
        ...values,
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

  await rememberFuelStations(
    [
      ...new Set(
        chosen
          .map((p) => p.payload.fuel_station)
          .filter((s) => !stationNames.has(normKey(s)))
      ),
    ],
    user.id
  )

  const { error } = await supabase
    .from("fuel_station_payments")
    .insert(chosen.map((p) => p.payload))
  if (error) return importFailure(error.message)

  revalidatePath("/pumps")
  return { rows: results, imported: chosen.length }
}

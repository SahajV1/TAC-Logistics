"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { fetchAll } from "@/lib/supabase/fetch-all"
import { requireAdmin } from "@/lib/auth"
import { importRequestSchema, salarySchema } from "@/lib/schemas"
import { formatMonth } from "@/lib/format"
import {
  cleanText,
  duplicateTracker,
  importFailure,
  normKey,
  parseDate,
  parseMonth,
  parsePersonType,
  parseYesNo,
  readRow,
  resolveBranch,
  rowResult,
  shouldImport,
  type ImportResult,
} from "@/lib/import"

type Result = { error?: string }

export async function saveSalary(
  id: string | null,
  values: unknown
): Promise<Result> {
  const user = await requireAdmin()
  const parsed = salarySchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" }
  }
  const v = parsed.data
  const branch_id = user.isAdmin ? v.branch_id : user.branch_id
  if (!branch_id) return { error: "Please choose a branch." }

  // Normalise to the first day of the month (DB stores a date).
  const month = `${v.month.slice(0, 7)}-01`

  const payload = {
    branch_id,
    person_type: v.person_type,
    driver_id: v.person_type === "driver" ? v.driver_id || null : null,
    staff_id: v.person_type === "staff" ? v.staff_id || null : null,
    person_name: v.person_name,
    month,
    base_salary: v.base_salary,
    bonus: v.bonus,
    deductions: v.deductions,
    advance: v.advance,
    paid: v.paid,
    paid_date: v.paid ? v.paid_date || null : null,
    notes: v.notes || null,
  }

  const supabase = await createClient()
  if (id) {
    const { error } = await supabase
      .from("salaries")
      .update(payload)
      .eq("id", id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from("salaries")
      .insert({ ...payload, created_by: user.id })
    if (error) return { error: error.message }
  }

  revalidatePath("/salaries")
  return {}
}

export async function deleteSalary(id: string): Promise<Result> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from("salaries").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/salaries")
  return {}
}

export async function toggleSalaryPaid(
  id: string,
  paid: boolean
): Promise<Result> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase
    .from("salaries")
    .update({
      paid,
      paid_date: paid ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/salaries")
  return {}
}

/**
 * Checks a sheet of salaries and, when `options.commit` is set, saves them.
 * A person is matched to their driver / staff record by name, the same link the
 * form's picker makes; a name with no record is still saved, as the form allows.
 * One person's month can only be uploaded once unless duplicates are included.
 */
export async function importSalaries(
  rows: unknown,
  options: unknown
): Promise<ImportResult> {
  const user = await requireAdmin()
  const request = importRequestSchema.safeParse({ rows, options })
  if (!request.success) {
    return importFailure("This sheet could not be read. Please check it and try again.")
  }
  const { rows: sheetRows, options: opts } = request.data
  const supabase = await createClient()

  const months = sheetRows
    .map((r) => parseMonth(r.cells.month))
    .filter((m): m is string => !!m)
    .sort()

  const [branchRes, driverRes, staffRes, existingRes] = await Promise.all([
    supabase.from("branches").select("id, name"),
    fetchAll<{ id: string; name: string; branch_id: string }>((from, to) =>
      supabase.from("drivers").select("id, name, branch_id").order("id").range(from, to)
    ),
    supabase.from("profiles").select("id, full_name, branch_id"),
    months.length
      ? fetchAll<{
          branch_id: string
          person_type: string
          person_name: string
          month: string
        }>((from, to) =>
          supabase
            .from("salaries")
            .select("branch_id, person_type, person_name, month")
            .gte("month", months[0])
            .lte("month", months[months.length - 1])
            .order("id")
            .range(from, to)
        )
      : Promise.resolve({ data: [], error: null }),
  ])

  const lookupError =
    branchRes.error ?? driverRes.error ?? staffRes.error ?? existingRes.error
  if (lookupError) return importFailure(lookupError.message)

  type Person = { id: string; name: string; branch_id: string | null }
  const group = (people: Person[]) => {
    const map = new Map<string, Person[]>()
    for (const p of people) {
      map.set(normKey(p.name), [...(map.get(normKey(p.name)) ?? []), p])
    }
    return map
  }
  const driversByName = group(driverRes.data ?? [])
  const staffByName = group(
    ((staffRes.data ?? []) as { id: string; full_name: string; branch_id: string | null }[]).map(
      (s) => ({ id: s.id, name: s.full_name, branch_id: s.branch_id })
    )
  )

  const dupKey = (branch: string, type: string, name: string, month: string) =>
    [branch, type, normKey(name), month].join("|")
  const duplicateOf = duplicateTracker(
    (existingRes.data ?? []).map((s) =>
      dupKey(s.branch_id, s.person_type, s.person_name, s.month)
    )
  )

  const prepared = sheetRows.map(({ row, cells }) => {
    const r = readRow(cells)
    const notes: string[] = []

    const person_name = r.text("person")
    const month = parseMonth(cells.month)
    if (r.has("month") && !month) {
      r.errors.push(`Month: "${cleanText(cells.month)}" is not a month (use Oct 2026)`)
    }

    const drivers = driversByName.get(normKey(person_name)) ?? []
    const staff = staffByName.get(normKey(person_name)) ?? []

    const typeText = r.text("type")
    const person_type =
      parsePersonType(typeText) ??
      (typeText ? null : drivers.length ? "driver" : staff.length ? "staff" : null)
    if (typeText && !person_type) {
      r.errors.push(`Type "${typeText}" should be Driver or Staff`)
    } else if (person_name && !person_type) {
      r.errors.push(`"${person_name}" is not on record: fill Type with Driver or Staff`)
    }

    const people = person_type === "staff" ? staff : drivers
    const branch = resolveBranch(r.text("branch"), {
      isAdmin: user.isAdmin,
      userBranchId: user.branch_id,
      branches: (branchRes.data ?? []) as { id: string; name: string }[],
      inferred: people.length === 1 ? people[0].branch_id : null,
      fallback: opts.branchId,
    })
    if (branch.error) r.errors.push(branch.error)
    const branch_id = branch.id ?? ""

    const person = people.find((p) => p.branch_id === branch_id)
    if (person_name && person_type && branch_id && !person) {
      notes.push(`Not linked to a ${person_type} record, saved by name only`)
    }

    if (!r.has("base")) r.errors.push("Base salary is missing")
    const paidText = r.text("paid")
    const paid = paidText ? parseYesNo(paidText) : false
    if (paid === null) r.errors.push(`Paid "${paidText}" should be Yes or No`)
    const paid_date = paid ? r.date("paid_date", "Paid Date") : ""

    const values = {
      person_type: person_type ?? "driver",
      person_name,
      month: month ?? cleanText(cells.month),
      base_salary: r.num("base", "Base"),
      bonus: r.num("bonus", "Bonus"),
      deductions: r.num("deductions", "Deductions"),
      advance: r.num("advance", "Advance"),
      paid: !!paid,
      paid_date,
      notes: r.text("notes"),
    }
    const parsed = salarySchema.safeParse(values)
    if (!parsed.success) r.errors.push(...parsed.error.issues.map((i) => i.message))

    const duplicate = r.errors.length
      ? null
      : duplicateOf(dupKey(branch_id, values.person_type, person_name, month!), row)
    const summary = [month ? formatMonth(month) : "", person_name]
      .filter(Boolean)
      .join(" · ")

    return {
      result: rowResult(row, summary, r.errors, duplicate, notes),
      payload: {
        ...values,
        branch_id,
        driver_id: person_type === "driver" ? (person?.id ?? null) : null,
        staff_id: person_type === "staff" ? (person?.id ?? null) : null,
        paid_date: parseDate(paid_date),
        notes: values.notes || null,
        created_by: user.id,
      },
    }
  })

  const results = prepared.map((p) => p.result)
  if (!opts.commit) return { rows: results, imported: 0 }

  const chosen = prepared.filter((p) => shouldImport(p.result, opts))
  if (chosen.length === 0) return { rows: results, imported: 0 }

  const { error } = await supabase.from("salaries").insert(chosen.map((p) => p.payload))
  if (error) return importFailure(error.message)

  revalidatePath("/salaries")
  return { rows: results, imported: chosen.length }
}

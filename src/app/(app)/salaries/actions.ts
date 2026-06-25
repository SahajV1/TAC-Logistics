"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/auth"
import { salarySchema } from "@/lib/schemas"

type Result = { error?: string }

export async function saveSalary(
  id: string | null,
  values: unknown
): Promise<Result> {
  const user = await requireUser()
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
  await requireUser()
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
  await requireUser()
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

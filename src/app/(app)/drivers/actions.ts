"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/auth"
import { driverSchema } from "@/lib/schemas"

type Result = { error?: string }

export async function saveDriver(
  id: string | null,
  values: unknown
): Promise<Result> {
  const user = await requireUser()
  const parsed = driverSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" }
  }
  const v = parsed.data
  const branch_id = user.isAdmin ? v.branch_id : user.branch_id
  if (!branch_id) return { error: "Please choose a branch." }

  const payload = {
    branch_id,
    name: v.name,
    phone: v.phone || null,
    license_number: v.license_number || null,
    license_expiry: v.license_expiry || null,
    address: v.address || null,
    monthly_salary: v.monthly_salary,
    status: v.status,
  }

  const supabase = await createClient()
  if (id) {
    const { error } = await supabase.from("drivers").update(payload).eq("id", id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from("drivers")
      .insert({ ...payload, created_by: user.id })
    if (error) return { error: error.message }
  }

  revalidatePath("/drivers")
  revalidatePath("/")
  return {}
}

export async function deleteDriver(id: string): Promise<Result> {
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.from("drivers").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/drivers")
  return {}
}

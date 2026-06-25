"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/auth"
import { dispatchSchema } from "@/lib/schemas"

type Result = { error?: string }

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
    fuel_cost: v.fuel_cost,
    advance_amount: v.advance_amount,
    misc_amount: v.misc_amount,
    remarks: v.remarks || null,
    truck_type: v.truck_type,
    owner_details: v.truck_type === "rented" ? v.owner_details || null : null,
    rent_amount: v.truck_type === "rented" ? v.rent_amount : 0,
    status: v.status,
  }

  const supabase = await createClient()

  if (id) {
    const { error } = await supabase
      .from("dispatches")
      .update(payload)
      .eq("id", id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from("dispatches")
      .insert({ ...payload, created_by: user.id })
    if (error) return { error: error.message }
  }

  revalidatePath("/dispatch")
  revalidatePath("/")
  return {}
}

export async function deleteDispatch(id: string): Promise<Result> {
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.from("dispatches").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/dispatch")
  revalidatePath("/")
  return {}
}

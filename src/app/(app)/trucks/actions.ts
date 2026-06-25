"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/auth"
import { truckSchema } from "@/lib/schemas"

type Result = { error?: string }

export async function saveTruck(
  id: string | null,
  values: unknown
): Promise<Result> {
  const user = await requireUser()
  const parsed = truckSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" }
  }
  const v = parsed.data
  const branch_id = user.isAdmin ? v.branch_id : user.branch_id
  if (!branch_id) return { error: "Please choose a branch." }
  const rented = v.truck_type === "rented"

  const payload = {
    branch_id,
    vehicle_number: v.vehicle_number,
    truck_type: v.truck_type,
    owner_name: rented ? v.owner_name || null : null,
    owner_phone: rented ? v.owner_phone || null : null,
    make_model: v.make_model || null,
    capacity_tons: v.capacity_tons || null,
    status: v.status,
  }

  const supabase = await createClient()
  if (id) {
    const { error } = await supabase.from("trucks").update(payload).eq("id", id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from("trucks")
      .insert({ ...payload, created_by: user.id })
    if (error) {
      if (error.code === "23505") {
        return { error: "A truck with this vehicle number already exists." }
      }
      return { error: error.message }
    }
  }

  revalidatePath("/trucks")
  revalidatePath("/")
  return {}
}

export async function deleteTruck(id: string): Promise<Result> {
  await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.from("trucks").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/trucks")
  return {}
}

"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { fuelStationSchema } from "@/lib/schemas"

type Result = { error?: string }

export async function saveFuelStation(
  id: string | null,
  values: unknown
): Promise<Result> {
  const user = await requireAdmin()
  const parsed = fuelStationSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" }
  }
  const v = parsed.data

  const payload = {
    name: v.name,
    location: v.location || null,
    contact: v.contact || null,
    status: v.status,
  }

  const supabase = await createClient()
  if (id) {
    const { error } = await supabase
      .from("fuel_stations")
      .update(payload)
      .eq("id", id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from("fuel_stations")
      .insert({ ...payload, created_by: user.id })
    if (error) return { error: error.message }
  }

  revalidatePath("/fuel-stations")
  return {}
}

export async function deleteFuelStation(id: string): Promise<Result> {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from("fuel_stations").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/fuel-stations")
  return {}
}

"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { fuelPriceSchema } from "@/lib/schemas"
import { APP_SETTINGS_ID } from "@/lib/constants"

type Result = { error?: string }

/** Admin-only: sets the fuel price per litre used to auto-calculate dispatch fuel cost. */
export async function updateFuelPrice(values: unknown): Promise<Result> {
  const user = await requireAdmin()
  const parsed = fuelPriceSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("app_settings")
    .update({
      fuel_price_per_litre: parsed.data.fuel_price_per_litre,
      updated_by: user.id,
    })
    .eq("id", APP_SETTINGS_ID)
  if (error) return { error: error.message }

  revalidatePath("/")
  revalidatePath("/dispatch")
  return {}
}

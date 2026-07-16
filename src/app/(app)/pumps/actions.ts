"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/auth"
import { pumpPaymentSchema } from "@/lib/schemas"

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

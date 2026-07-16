"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/auth"
import { dealerSchema, dealerTransactionSchema } from "@/lib/schemas"

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

"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/auth"
import { documentSchema } from "@/lib/schemas"
import type { DocumentRow } from "@/lib/types"

type Result = { error?: string }

export type FilePayload = { file_url: string | null; file_name: string | null }

export async function saveDocument(
  id: string | null,
  values: unknown,
  file: FilePayload
): Promise<Result> {
  const user = await requireUser()
  const parsed = documentSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" }
  }
  const v = parsed.data
  const supabase = await createClient()

  // Derive branch from the truck (RLS guarantees the user may access it).
  const { data: truck } = await supabase
    .from("trucks")
    .select("branch_id")
    .eq("id", v.truck_id)
    .single()
  if (!truck) return { error: "Truck not found in your branch." }

  const payload = {
    truck_id: v.truck_id,
    branch_id: truck.branch_id,
    doc_type: v.doc_type,
    doc_number: v.doc_number || null,
    issue_date: v.issue_date || null,
    expiry_date: v.expiry_date,
    notes: v.notes || null,
    file_url: file.file_url,
    file_name: file.file_name,
    is_current: true,
  }

  if (id) {
    const { error } = await supabase
      .from("documents")
      .update(payload)
      .eq("id", id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from("documents")
      .insert({ ...payload, created_by: user.id })
    if (error) return { error: error.message }
  }

  revalidatePath("/documents")
  revalidatePath("/alerts")
  revalidatePath("/")
  return {}
}

export async function deleteDocument(id: string): Promise<Result> {
  await requireUser()
  const supabase = await createClient()

  // Best-effort cleanup of the stored file.
  const { data: doc } = await supabase
    .from("documents")
    .select("file_url")
    .eq("id", id)
    .single()
  if (doc?.file_url) {
    await supabase.storage.from("documents").remove([doc.file_url])
  }

  const { error } = await supabase.from("documents").delete().eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/documents")
  revalidatePath("/alerts")
  return {}
}

/** Short-lived signed URL for viewing a private document scan. */
export async function getSignedUrl(
  path: string
): Promise<{ url?: string; error?: string }> {
  await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(path, 120)
  if (error) return { error: error.message }
  return { url: data.signedUrl }
}

/** Full version history for a truck + document type. */
export async function getDocumentHistory(
  truckId: string,
  docType: string
): Promise<DocumentRow[]> {
  await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("truck_id", truckId)
    .eq("doc_type", docType)
    .order("created_at", { ascending: false })
  return (data ?? []) as DocumentRow[]
}

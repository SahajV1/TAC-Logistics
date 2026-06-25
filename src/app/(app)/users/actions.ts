"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { userSchema } from "@/lib/schemas"

type Result = { error?: string }

export async function createUser(values: unknown): Promise<Result> {
  await requireAdmin()
  const parsed = userSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" }
  }
  const v = parsed.data
  if (!v.password) return { error: "A password is required for new accounts." }
  if (v.role === "staff" && !v.branch_id) {
    return { error: "Staff must be assigned to a branch." }
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
    user_metadata: {
      full_name: v.full_name,
      role: v.role,
      branch_id: v.role === "admin" ? null : v.branch_id,
      phone: v.phone ?? null,
    },
  })
  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      return { error: "A user with this email already exists." }
    }
    return { error: error.message }
  }

  revalidatePath("/users")
  return {}
}

export async function updateUser(
  id: string,
  values: unknown
): Promise<Result> {
  await requireAdmin()
  const parsed = userSchema.safeParse(values)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" }
  }
  const v = parsed.data
  if (v.role === "staff" && !v.branch_id) {
    return { error: "Staff must be assigned to a branch." }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from("profiles")
    .update({
      full_name: v.full_name,
      phone: v.phone ?? null,
      role: v.role,
      branch_id: v.role === "admin" ? null : v.branch_id,
    })
    .eq("id", id)
  if (error) return { error: error.message }

  if (v.password) {
    const { error: authErr } = await admin.auth.admin.updateUserById(id, {
      password: v.password,
    })
    if (authErr) return { error: authErr.message }
  }

  revalidatePath("/users")
  return {}
}

export async function setUserActive(
  id: string,
  active: boolean
): Promise<Result> {
  const me = await requireAdmin()
  if (me.id === id) return { error: "You cannot deactivate your own account." }

  const admin = createAdminClient()
  const { error } = await admin
    .from("profiles")
    .update({ is_active: active })
    .eq("id", id)
  if (error) return { error: error.message }

  // Ban / unban so a deactivated user's session is immediately invalidated.
  await admin.auth.admin.updateUserById(id, {
    ban_duration: active ? "none" : "876000h",
  })

  revalidatePath("/users")
  return {}
}

export async function deleteUser(id: string): Promise<Result> {
  const me = await requireAdmin()
  if (me.id === id) return { error: "You cannot delete your own account." }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return { error: error.message }

  revalidatePath("/users")
  return {}
}

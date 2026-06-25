import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendExpiryEmail, type ExpiryItem } from "@/lib/email"
import { daysUntil } from "@/lib/format"
import { DOC_TYPE_LABELS } from "@/lib/constants"
import type { Driver, DocumentRow, Profile } from "@/lib/types"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Alert when a document/licence is exactly this many days from expiry,
// expires today (0), or is already overdue (<0).
const THRESHOLDS = new Set([30, 15, 7, 1, 0])

function hits(daysLeft: number) {
  return THRESHOLDS.has(daysLeft) || daysLeft < 0
}

export async function GET(request: NextRequest) {
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const admin = createAdminClient()

  const [docRes, driverRes, profileRes, branchRes] = await Promise.all([
    admin
      .from("documents")
      .select("*, trucks(vehicle_number)")
      .eq("is_current", true),
    admin.from("drivers").select("*").not("license_expiry", "is", null),
    admin
      .from("profiles")
      .select("id, email, role, branch_id, is_active")
      .eq("is_active", true),
    admin.from("branches").select("id, name"),
  ])

  const profiles = (profileRes.data ?? []) as Pick<
    Profile,
    "id" | "email" | "role" | "branch_id" | "is_active"
  >[]
  const branchName = new Map<string, string>(
    ((branchRes.data ?? []) as { id: string; name: string }[]).map((b) => [
      b.id,
      b.name,
    ])
  )

  // Collect threshold-hitting items grouped by branch.
  const byBranch = new Map<string, ExpiryItem[]>()
  const add = (branchId: string, item: ExpiryItem) => {
    const list = byBranch.get(branchId) ?? []
    list.push(item)
    byBranch.set(branchId, list)
  }

  for (const d of (docRes.data ?? []) as (DocumentRow & {
    trucks?: { vehicle_number: string } | null
  })[]) {
    const dl = daysUntil(d.expiry_date)
    if (!hits(dl)) continue
    add(d.branch_id, {
      subject: d.trucks?.vehicle_number ?? "Vehicle",
      type: DOC_TYPE_LABELS[d.doc_type],
      expiry: d.expiry_date,
      daysLeft: dl,
    })
  }

  for (const dr of (driverRes.data ?? []) as Driver[]) {
    if (!dr.license_expiry) continue
    const dl = daysUntil(dr.license_expiry)
    if (!hits(dl)) continue
    add(dr.branch_id, {
      subject: dr.name,
      type: "Driver Licence",
      expiry: dr.license_expiry,
      daysLeft: dl,
    })
  }

  const adminEmails = profiles
    .filter((p) => p.role === "admin")
    .map((p) => p.email)

  const results: {
    branch: string
    recipients: number
    items: number
    ok: boolean
    error?: string
  }[] = []
  let emailsSent = 0

  for (const [branchId, items] of byBranch) {
    const staffEmails = profiles
      .filter((p) => p.branch_id === branchId)
      .map((p) => p.email)
    const to = [...new Set([...staffEmails, ...adminEmails])].filter(Boolean)
    if (to.length === 0) continue

    // sort soonest-first for a tidy email
    items.sort((a, b) => a.daysLeft - b.daysLeft)

    const res = await sendExpiryEmail({
      to,
      branchName: branchName.get(branchId) ?? "Branch",
      items,
    })
    if (res.ok) emailsSent++
    results.push({
      branch: branchName.get(branchId) ?? branchId,
      recipients: to.length,
      items: items.length,
      ok: res.ok,
      error: res.error,
    })
  }

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    branchesWithAlerts: byBranch.size,
    emailsSent,
    results,
  })
}

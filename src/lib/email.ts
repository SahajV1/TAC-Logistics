import "server-only"
import { Resend } from "resend"
import { formatDate } from "@/lib/format"

export type ExpiryItem = {
  subject: string // vehicle number or driver name
  type: string // e.g. "Insurance", "Driver Licence"
  expiry: string
  daysLeft: number
}

function row(item: ExpiryItem) {
  const when =
    item.daysLeft < 0
      ? `Expired ${Math.abs(item.daysLeft)}d ago`
      : item.daysLeft === 0
        ? "Expires today"
        : `${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"} left`
  const color = item.daysLeft <= 7 ? "#dc2626" : "#d97706"
  return `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;">${item.subject}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${item.type}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${formatDate(item.expiry)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:${color};font-weight:600;">${when}</td>
    </tr>`
}

function renderHtml(branchName: string, items: ExpiryItem[], appUrl: string) {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:640px;margin:auto;color:#0f172a;">
    <h2 style="margin:0 0 4px;">Document expiry reminder</h2>
    <p style="margin:0 0 16px;color:#475569;">Branch: <strong>${branchName}</strong> — ${items.length} item(s) need attention.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #eee;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f8fafc;text-align:left;">
          <th style="padding:8px 12px;">Vehicle / Driver</th>
          <th style="padding:8px 12px;">Document</th>
          <th style="padding:8px 12px;">Expiry</th>
          <th style="padding:8px 12px;">Status</th>
        </tr>
      </thead>
      <tbody>${items.map(row).join("")}</tbody>
    </table>
    <p style="margin:16px 0;">
      <a href="${appUrl}/alerts" style="background:#0f172a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Open alerts</a>
    </p>
    <p style="color:#94a3b8;font-size:12px;">Sent automatically by your Transport Management System.</p>
  </div>`
}

export async function sendExpiryEmail({
  to,
  branchName,
  items,
}: {
  to: string[]
  branchName: string
  items: ExpiryItem[]
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not configured" }
  if (to.length === 0 || items.length === 0) {
    return { ok: false, error: "Nothing to send" }
  }

  const from = process.env.EMAIL_FROM || "TMS Alerts <onboarding@resend.dev>"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const resend = new Resend(apiKey)

  const { error } = await resend.emails.send({
    from,
    to,
    subject: `⚠️ ${items.length} document(s) expiring — ${branchName}`,
    html: renderHtml(branchName, items, appUrl),
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

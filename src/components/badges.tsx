import { Badge } from "@/components/ui/badge"
import { daysUntil, expiryStatus, formatDate } from "@/lib/format"
import type { EntityStatus } from "@/lib/types"

export function StatusBadge({ status }: { status: EntityStatus }) {
  return (
    <Badge
      variant={status === "active" ? "outline" : "secondary"}
      className={
        status === "active"
          ? "border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
          : "text-muted-foreground"
      }
    >
      {status === "active" ? "Active" : "Inactive"}
    </Badge>
  )
}

/** Shows a date with an expiry-aware colour (expired / critical / warning / ok). */
export function ExpiryBadge({
  date,
  showDate = true,
}: {
  date: string | null
  showDate?: boolean
}) {
  if (!date) return <span className="text-muted-foreground">—</span>
  const status = expiryStatus(daysUntil(date))
  return (
    <Badge variant={status.variant} className="whitespace-nowrap">
      {showDate ? `${formatDate(date)} · ` : ""}
      {status.label}
    </Badge>
  )
}

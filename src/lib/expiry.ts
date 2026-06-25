import { EXPIRY_THRESHOLDS } from "@/lib/constants"
import { daysUntil } from "@/lib/format"
import type { DocumentRow } from "@/lib/types"

export type DocWithExpiry = DocumentRow & { daysLeft: number }

/** Adds daysLeft and sorts soonest-first (overdue first). */
export function annotateExpiry(docs: DocumentRow[]): DocWithExpiry[] {
  return docs
    .map((d) => ({ ...d, daysLeft: daysUntil(d.expiry_date) }))
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

/** Docs expiring within `windowDays` days (includes already-expired). */
export function expiringWithin(
  docs: DocumentRow[],
  windowDays: number
): DocWithExpiry[] {
  return annotateExpiry(docs).filter((d) => d.daysLeft <= windowDays)
}

/** Returns the exact alert threshold a doc hits today (30/15/7/1), else null. */
export function thresholdHitToday(daysLeft: number): number | null {
  return (EXPIRY_THRESHOLDS as readonly number[]).includes(daysLeft)
    ? daysLeft
    : null
}

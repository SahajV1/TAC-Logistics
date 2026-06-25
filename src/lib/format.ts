import { differenceInCalendarDays, format, parseISO } from "date-fns"

function toDate(value: string | Date): Date {
  return typeof value === "string" ? parseISO(value) : value
}

/** ₹ 1,23,456 — Indian Rupee, no decimals by default. */
export function formatCurrency(value: number | null | undefined): string {
  const n = Number(value ?? 0)
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-IN").format(Number(value ?? 0))
}

/** 24 Jun 2026 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—"
  try {
    return format(toDate(value), "dd MMM yyyy")
  } catch {
    return "—"
  }
}

/** 24 Jun 2026, 3:45 PM */
export function formatDateTime(
  value: string | Date | null | undefined
): string {
  if (!value) return "—"
  try {
    return format(toDate(value), "dd MMM yyyy, h:mm a")
  } catch {
    return "—"
  }
}

/** Jun 2026 */
export function formatMonth(value: string | Date | null | undefined): string {
  if (!value) return "—"
  try {
    return format(toDate(value), "MMM yyyy")
  } catch {
    return "—"
  }
}

/** Whole calendar days from today until `value` (negative = overdue). */
export function daysUntil(value: string | Date | null | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY
  return differenceInCalendarDays(toDate(value), new Date())
}

export type ExpiryLevel = "expired" | "critical" | "warning" | "ok"

export interface ExpiryStatus {
  level: ExpiryLevel
  label: string
  /** maps to a shadcn Badge variant */
  variant: "destructive" | "secondary" | "outline" | "default"
}

/** Classifies a days-left number into an alert level. */
export function expiryStatus(daysLeft: number): ExpiryStatus {
  if (daysLeft < 0)
    return { level: "expired", label: "Expired", variant: "destructive" }
  if (daysLeft <= 7)
    return {
      level: "critical",
      label: `${daysLeft}d left`,
      variant: "destructive",
    }
  if (daysLeft <= 30)
    return {
      level: "warning",
      label: `${daysLeft}d left`,
      variant: "secondary",
    }
  return { level: "ok", label: "Valid", variant: "outline" }
}

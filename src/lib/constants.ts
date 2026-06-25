import type {
  DispatchStatus,
  DocType,
  EntityStatus,
  TruckType,
} from "@/lib/types"

export const APP_NAME = "TMS"
export const APP_FULL_NAME = "Transport Management System"

export const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: "rc", label: "Registration (RC)" },
  { value: "insurance", label: "Insurance" },
  { value: "pollution", label: "Pollution (PUC)" },
  { value: "fitness", label: "Fitness" },
  { value: "permit", label: "Permit" },
]

export const DOC_TYPE_LABELS: Record<DocType, string> = Object.fromEntries(
  DOC_TYPES.map((d) => [d.value, d.label])
) as Record<DocType, string>

export const TRUCK_TYPES: { value: TruckType; label: string }[] = [
  { value: "company", label: "Company Owned" },
  { value: "rented", label: "Rented" },
]

export const ENTITY_STATUSES: { value: EntityStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
]

export const DISPATCH_STATUSES: {
  value: DispatchStatus
  label: string
}[] = [
  { value: "pending", label: "Pending" },
  { value: "in_transit", label: "In Transit" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
]

export const DISPATCH_STATUS_LABELS: Record<DispatchStatus, string> =
  Object.fromEntries(
    DISPATCH_STATUSES.map((s) => [s.value, s.label])
  ) as Record<DispatchStatus, string>

// Days-before-expiry thresholds that trigger alerts / emails.
export const EXPIRY_THRESHOLDS = [30, 15, 7, 1] as const

// Documents within this many days are surfaced on the dashboard / alerts page.
export const EXPIRY_WINDOW_DAYS = 30

export type NavItem = {
  href: string
  label: string
  icon: string // lucide icon name, resolved in the sidebar
  adminOnly?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/dispatch", label: "Dispatch", icon: "Truck" },
  { href: "/drivers", label: "Drivers", icon: "Users" },
  { href: "/trucks", label: "Trucks", icon: "Bus" },
  { href: "/documents", label: "Documents", icon: "FileText" },
  { href: "/alerts", label: "Alerts", icon: "BellRing" },
  { href: "/salaries", label: "Salaries", icon: "Wallet" },
  { href: "/reports", label: "Reports", icon: "BarChart3" },
  { href: "/users", label: "Staff", icon: "ShieldCheck", adminOnly: true },
  { href: "/audit", label: "Audit Log", icon: "ScrollText", adminOnly: true },
]

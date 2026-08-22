import type {
  DealerTxnType,
  DispatchStatus,
  DocType,
  EntityStatus,
  TruckType,
} from "@/lib/types"

export const APP_NAME = "TAC Logistics"
export const APP_FULL_NAME = "TAC Logistics"

// Fixed id of the singleton app_settings row (see supabase/app_settings.sql).
export const APP_SETTINGS_ID = "00000000-0000-0000-0000-000000000001"

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

// Form select options — spelled out so the money direction is unmistakable.
export const DEALER_TXN_TYPES: { value: DealerTxnType; label: string }[] = [
  { value: "due", label: "Due — money we have to give (rent etc.)" },
  { value: "fuel_offset", label: "Fuel taken by dealer at our pump (reduces due)" },
  { value: "payment", label: "Cash / bank paid to dealer (reduces due)" },
]

// Short labels for table badges and Excel exports.
export const DEALER_TXN_TYPE_LABELS: Record<DealerTxnType, string> = {
  due: "Due added",
  fuel_offset: "Fuel offset",
  payment: "Cash paid",
}

// Days-before-expiry thresholds that trigger alerts / emails.
export const EXPIRY_THRESHOLDS = [30, 15, 7, 1] as const

// Documents within this many days are surfaced on the dashboard / alerts page.
export const EXPIRY_WINDOW_DAYS = 30

export type NavItem = {
  href: string
  label: string
  icon: string // lucide icon name, resolved in the sidebar
  adminOnly?: boolean // shows an "admin" badge on the item
  staffVisible?: boolean // visible to non-admin staff (admins see everything)
}

// Non-admin staff see Dispatch, Trucks, Documents, Dealer Ledger and Petrol
// Pumps. Everything else is admin-only (enforced both here and by
// requireAdmin() on each page/action).
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/dispatch", label: "Dispatch", icon: "Truck", staffVisible: true },
  { href: "/drivers", label: "Drivers", icon: "Users" },
  { href: "/trucks", label: "Trucks", icon: "Bus", staffVisible: true },
  { href: "/documents", label: "Documents", icon: "FileText", staffVisible: true },
  { href: "/alerts", label: "Alerts", icon: "BellRing" },
  { href: "/salaries", label: "Salaries", icon: "Wallet" },
  { href: "/dealers", label: "Dealer Ledger", icon: "Handshake", staffVisible: true },
  { href: "/rented-vehicles", label: "Rented Vehicles", icon: "KeySquare", staffVisible: true },
  { href: "/pumps", label: "Petrol Pumps", icon: "Fuel", staffVisible: true },
  { href: "/reports", label: "Reports", icon: "BarChart3" },
  { href: "/users", label: "Staff", icon: "ShieldCheck", adminOnly: true },
  { href: "/audit", label: "Audit Log", icon: "ScrollText", adminOnly: true },
]

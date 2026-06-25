"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  BellRing,
  Bus,
  FileText,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { NAV_ITEMS } from "@/lib/constants"

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Truck,
  Users,
  Bus,
  FileText,
  BellRing,
  Wallet,
  BarChart3,
  ShieldCheck,
  ScrollText,
}

export function SidebarNav({
  isAdmin,
  onNavigate,
}: {
  isAdmin: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin)

  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
            {item.adminOnly ? (
              <span className="ml-auto text-[10px] uppercase opacity-60">
                admin
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

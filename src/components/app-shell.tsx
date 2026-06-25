"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, Truck } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SidebarNav } from "./sidebar-nav"
import { UserMenu } from "./user-menu"
import { APP_NAME } from "@/lib/constants"

export type ShellUser = {
  isAdmin: boolean
  name: string
  email: string
  role: string
  branchName: string | null
}

function Brand() {
  return (
    <Link
      href="/"
      className="flex h-14 items-center gap-2 border-b px-5 font-semibold"
    >
      <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg">
        <Truck className="size-4" />
      </span>
      <span className="tracking-tight">{APP_NAME}</span>
    </Link>
  )
}

export function AppShell({
  user,
  children,
}: {
  user: ShellUser
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="bg-background hidden w-64 shrink-0 flex-col border-r md:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto">
          <SidebarNav isAdmin={user.isAdmin} />
        </div>
        <div className="text-muted-foreground border-t p-4 text-xs">
          {user.isAdmin ? "Administrator · All branches" : user.branchName}
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/80 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur">
          {/* Mobile nav */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Brand />
              <SidebarNav
                isAdmin={user.isAdmin}
                onNavigate={() => setOpen(false)}
              />
            </SheetContent>
          </Sheet>

          <div className="flex-1" />

          <Badge variant="outline" className="hidden font-normal sm:inline-flex">
            {user.isAdmin ? "All branches" : (user.branchName ?? "—")}
          </Badge>

          <UserMenu
            name={user.name}
            email={user.email}
            role={user.role}
            branchName={user.branchName}
          />
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}

"use client"

import { LogOut, ChevronsUpDown } from "lucide-react"
import { signOut } from "@/lib/actions/auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function UserMenu({
  name,
  email,
  role,
  branchName,
}: {
  name: string
  email: string
  role: string
  branchName: string | null
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:bg-muted flex items-center gap-2 rounded-lg p-1.5 pr-2 outline-none focus-visible:ring-2">
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="hidden text-left sm:block">
          <p className="text-sm leading-tight font-medium">{name}</p>
          <p className="text-muted-foreground text-xs leading-tight">
            {role === "admin" ? "Administrator" : (branchName ?? "Staff")}
          </p>
        </div>
        <ChevronsUpDown className="text-muted-foreground hidden size-4 sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="font-medium">{name}</p>
          <p className="text-muted-foreground text-xs font-normal">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <button
            type="submit"
            className="hover:bg-accent hover:text-accent-foreground relative flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

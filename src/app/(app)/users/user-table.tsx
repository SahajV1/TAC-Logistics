"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { Pencil, Plus, Power, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ExportButton, type ExportColumn } from "@/components/export-button"
import { formatDate } from "@/lib/format"
import type { Branch, Profile } from "@/lib/types"
import { UserFormDialog } from "./user-form"
import { deleteUser, setUserActive } from "./actions"

function PowerToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      title={active ? "Deactivate" : "Activate"}
      disabled={pending}
      className={active ? "text-amber-600" : "text-emerald-600"}
      onClick={() =>
        startTransition(async () => {
          const res = await setUserActive(id, !active)
          if (res.error) toast.error(res.error)
          else {
            toast.success(active ? "Account deactivated" : "Account activated")
            router.refresh()
          }
        })
      }
    >
      <Power />
      <span className="sr-only">{active ? "Deactivate" : "Activate"}</span>
    </Button>
  )
}

export function UserTable({
  users,
  branches,
}: {
  users: Profile[]
  branches: Pick<Branch, "id" | "name">[]
}) {
  const columns: ColumnDef<Profile>[] = [
    { accessorKey: "full_name", header: "Name" },
    { accessorKey: "email", header: "Email" },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => (
        <Badge variant={row.original.role === "admin" ? "default" : "secondary"}>
          {row.original.role === "admin" ? "Administrator" : "Staff"}
        </Badge>
      ),
    },
    {
      id: "branch",
      header: "Branch",
      accessorFn: (r) => r.branches?.name ?? "All branches",
      cell: ({ row }) =>
        row.original.branches?.name ?? (
          <span className="text-muted-foreground">All branches</span>
        ),
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={row.original.is_active ? "outline" : "secondary"}
          className={
            row.original.is_active
              ? "border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
              : "text-muted-foreground"
          }
        >
          {row.original.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <UserFormDialog
            branches={branches}
            initial={row.original}
            trigger={
              <Button variant="ghost" size="icon-sm">
                <Pencil />
                <span className="sr-only">Edit</span>
              </Button>
            }
          />
          <PowerToggle id={row.original.id} active={row.original.is_active} />
          <ConfirmDialog
            title="Delete account?"
            description="This permanently deletes the login and profile. Records they created remain."
            successMessage="Account deleted"
            onConfirm={() => deleteUser(row.original.id)}
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-destructive"
              >
                <Trash2 />
                <span className="sr-only">Delete</span>
              </Button>
            }
          />
        </div>
      ),
    },
  ]

  const exportColumns: ExportColumn<Profile>[] = [
    { header: "Name", value: (u) => u.full_name },
    { header: "Email", value: (u) => u.email },
    { header: "Role", value: (u) => u.role },
    { header: "Branch", value: (u) => u.branches?.name ?? "All branches" },
    { header: "Active", value: (u) => (u.is_active ? "Yes" : "No") },
    { header: "Phone", value: (u) => u.phone ?? "" },
    { header: "Created", value: (u) => formatDate(u.created_at) },
  ]

  return (
    <DataTable
      columns={columns}
      data={users}
      searchPlaceholder="Search name, email…"
      emptyMessage="No staff accounts yet."
      toolbar={
        <>
          <ExportButton rows={users} columns={exportColumns} filename="staff" />
          <UserFormDialog
            branches={branches}
            trigger={
              <Button>
                <Plus /> Add staff
              </Button>
            }
          />
        </>
      }
    />
  )
}

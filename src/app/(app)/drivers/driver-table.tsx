"use client"

import { type ColumnDef } from "@tanstack/react-table"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ExportButton, type ExportColumn } from "@/components/export-button"
import { StatusBadge, ExpiryBadge } from "@/components/badges"
import { formatCurrency } from "@/lib/format"
import type { Branch, Driver } from "@/lib/types"
import { DriverFormDialog } from "./driver-form"
import { deleteDriver } from "./actions"

export function DriverTable({
  drivers,
  branches,
  isAdmin,
  defaultBranchId,
}: {
  drivers: Driver[]
  branches: Pick<Branch, "id" | "name">[]
  isAdmin: boolean
  defaultBranchId: string | null
}) {
  const lookups = { branches, isAdmin, defaultBranchId }

  const columns: ColumnDef<Driver>[] = [
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => row.original.phone ?? "—",
    },
    {
      accessorKey: "license_number",
      header: "Licence",
      cell: ({ row }) => row.original.license_number ?? "—",
    },
    {
      id: "license_expiry",
      header: "Licence expiry",
      accessorFn: (r) => r.license_expiry ?? "",
      cell: ({ row }) => <ExpiryBadge date={row.original.license_expiry} />,
    },
    {
      accessorKey: "monthly_salary",
      header: "Salary",
      cell: ({ row }) => formatCurrency(Number(row.original.monthly_salary)),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    ...(isAdmin
      ? [
          {
            id: "branch",
            header: "Branch",
            accessorFn: (r: Driver) => r.branches?.name ?? "",
          } as ColumnDef<Driver>,
        ]
      : []),
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <DriverFormDialog
            {...lookups}
            initial={row.original}
            trigger={
              <Button variant="ghost" size="icon-sm">
                <Pencil />
                <span className="sr-only">Edit</span>
              </Button>
            }
          />
          <ConfirmDialog
            title="Delete driver?"
            description="This removes the driver record. Past dispatches keep the driver's name."
            successMessage="Driver deleted"
            onConfirm={() => deleteDriver(row.original.id)}
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

  const exportColumns: ExportColumn<Driver>[] = [
    { header: "Name", value: (d) => d.name },
    { header: "Phone", value: (d) => d.phone ?? "" },
    { header: "Licence No", value: (d) => d.license_number ?? "" },
    { header: "Licence Expiry", value: (d) => d.license_expiry ?? "" },
    { header: "Monthly Salary", value: (d) => Number(d.monthly_salary) },
    { header: "Status", value: (d) => d.status },
    { header: "Address", value: (d) => d.address ?? "" },
    { header: "Branch", value: (d) => d.branches?.name ?? "" },
  ]

  return (
    <DataTable
      columns={columns}
      data={drivers}
      searchPlaceholder="Search drivers…"
      emptyMessage="No drivers yet."
      toolbar={
        <>
          <ExportButton
            rows={drivers}
            columns={exportColumns}
            filename="drivers"
          />
          <DriverFormDialog
            {...lookups}
            trigger={
              <Button>
                <Plus /> Add driver
              </Button>
            }
          />
        </>
      }
    />
  )
}

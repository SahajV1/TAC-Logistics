"use client"

import { type ColumnDef } from "@tanstack/react-table"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ExportButton, type ExportColumn } from "@/components/export-button"
import { StatusBadge } from "@/components/badges"
import type { Branch, Truck } from "@/lib/types"
import { TruckFormDialog } from "./truck-form"
import { deleteTruck } from "./actions"

export function TruckTable({
  trucks,
  branches,
  isAdmin,
  defaultBranchId,
}: {
  trucks: Truck[]
  branches: Pick<Branch, "id" | "name">[]
  isAdmin: boolean
  defaultBranchId: string | null
}) {
  const lookups = { branches, isAdmin, defaultBranchId }

  const columns: ColumnDef<Truck>[] = [
    { accessorKey: "vehicle_number", header: "Vehicle" },
    {
      accessorKey: "truck_type",
      header: "Type",
      cell: ({ row }) => (
        <Badge
          variant={row.original.truck_type === "rented" ? "secondary" : "outline"}
        >
          {row.original.truck_type === "rented" ? "Rented" : "Company"}
        </Badge>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      accessorFn: (r) => r.owner_name ?? "",
      cell: ({ row }) =>
        row.original.truck_type === "rented" ? (
          <div className="leading-tight">
            <div>{row.original.owner_name ?? "—"}</div>
            {row.original.owner_phone ? (
              <div className="text-muted-foreground text-xs">
                {row.original.owner_phone}
              </div>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "make_model",
      header: "Make / Model",
      cell: ({ row }) => row.original.make_model ?? "—",
    },
    {
      accessorKey: "capacity_tons",
      header: "Capacity",
      cell: ({ row }) =>
        row.original.capacity_tons
          ? `${Number(row.original.capacity_tons)} T`
          : "—",
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
            accessorFn: (r: Truck) => r.branches?.name ?? "",
          } as ColumnDef<Truck>,
        ]
      : []),
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <TruckFormDialog
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
            title="Delete truck?"
            description="This also removes the truck's documents. This cannot be undone."
            successMessage="Truck deleted"
            onConfirm={() => deleteTruck(row.original.id)}
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

  const exportColumns: ExportColumn<Truck>[] = [
    { header: "Vehicle", value: (t) => t.vehicle_number },
    { header: "Type", value: (t) => t.truck_type },
    { header: "Owner", value: (t) => t.owner_name ?? "" },
    { header: "Owner Phone", value: (t) => t.owner_phone ?? "" },
    { header: "Make/Model", value: (t) => t.make_model ?? "" },
    { header: "Capacity (T)", value: (t) => Number(t.capacity_tons ?? 0) },
    { header: "Status", value: (t) => t.status },
    { header: "Branch", value: (t) => t.branches?.name ?? "" },
  ]

  return (
    <DataTable
      columns={columns}
      data={trucks}
      searchPlaceholder="Search vehicle, owner…"
      emptyMessage="No trucks yet."
      toolbar={
        <>
          <ExportButton rows={trucks} columns={exportColumns} filename="trucks" />
          <TruckFormDialog
            {...lookups}
            trigger={
              <Button>
                <Plus /> Add truck
              </Button>
            }
          />
        </>
      }
    />
  )
}

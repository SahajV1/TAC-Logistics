"use client"

import { type ColumnDef } from "@tanstack/react-table"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ExportButton, type ExportColumn } from "@/components/export-button"
import { formatCurrency, formatDate } from "@/lib/format"
import { DISPATCH_STATUS_LABELS } from "@/lib/constants"
import type { Dispatch, DispatchStatus } from "@/lib/types"
import {
  DispatchFormDialog,
  type BranchOption,
  type DriverOption,
  type TruckOption,
} from "./dispatch-form"
import { deleteDispatch } from "./actions"

const STATUS_VARIANT: Record<
  DispatchStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "secondary",
  in_transit: "default",
  completed: "outline",
  cancelled: "destructive",
}

function tripCost(d: Dispatch) {
  return (
    Number(d.fuel_cost) +
    Number(d.advance_amount) +
    Number(d.misc_amount) +
    Number(d.toll_amount) +
    Number(d.rent_amount)
  )
}

export function DispatchTable({
  dispatches,
  drivers,
  trucks,
  branches,
  fuelStations,
  isAdmin,
  defaultBranchId,
}: {
  dispatches: Dispatch[]
  drivers: DriverOption[]
  trucks: TruckOption[]
  branches: BranchOption[]
  fuelStations: string[]
  isAdmin: boolean
  defaultBranchId: string | null
}) {
  const lookups = { drivers, trucks, branches, fuelStations, isAdmin, defaultBranchId }

  const columns: ColumnDef<Dispatch>[] = [
    {
      accessorKey: "dispatch_date",
      header: "Date",
      cell: ({ row }) => formatDate(row.original.dispatch_date),
    },
    { accessorKey: "vehicle_number", header: "Vehicle" },
    { accessorKey: "driver_name", header: "Driver" },
    {
      id: "route",
      header: "Route",
      accessorFn: (r) => `${r.from_location} → ${r.to_location}`,
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {row.original.from_location}
          <span className="text-muted-foreground"> → </span>
          {row.original.to_location}
        </span>
      ),
    },
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
      accessorKey: "fuel_cost",
      header: "Fuel",
      cell: ({ row }) => formatCurrency(Number(row.original.fuel_cost)),
    },
    {
      accessorKey: "fuel_station",
      header: "Fuel station",
      cell: ({ row }) =>
        row.original.fuel_station ?? (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "trip_cost",
      header: "Trip cost",
      accessorFn: (r) => tripCost(r),
      cell: ({ row }) => (
        <span className="font-medium">{formatCurrency(tripCost(row.original))}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status]}>
          {DISPATCH_STATUS_LABELS[row.original.status]}
        </Badge>
      ),
    },
    ...(isAdmin
      ? [
          {
            id: "branch",
            header: "Branch",
            accessorFn: (r: Dispatch) => r.branches?.name ?? "",
          } as ColumnDef<Dispatch>,
          {
            id: "created_by",
            header: "Filled by",
            accessorFn: (r: Dispatch) => r.creator?.full_name ?? "",
            cell: ({ row }) => (
              <span className={row.original.creator ? "" : "text-muted-foreground"}>
                {row.original.creator?.full_name ?? "—"}
              </span>
            ),
          } as ColumnDef<Dispatch>,
        ]
      : []),
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <DispatchFormDialog
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
            title="Delete dispatch?"
            description="This permanently removes the dispatch record."
            successMessage="Dispatch deleted"
            onConfirm={() => deleteDispatch(row.original.id)}
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

  const exportColumns: ExportColumn<Dispatch>[] = [
    { header: "Date", value: (d) => d.dispatch_date },
    { header: "Vehicle", value: (d) => d.vehicle_number },
    { header: "Driver", value: (d) => d.driver_name },
    { header: "From", value: (d) => d.from_location },
    { header: "To", value: (d) => d.to_location },
    { header: "Truck Type", value: (d) => d.truck_type },
    { header: "Fuel Litres", value: (d) => Number(d.fuel_litres) },
    { header: "Fuel Cost", value: (d) => Number(d.fuel_cost) },
    { header: "Fuel Station", value: (d) => d.fuel_station ?? "" },
    { header: "Advance", value: (d) => Number(d.advance_amount) },
    { header: "Toll", value: (d) => Number(d.toll_amount) },
    { header: "Misc", value: (d) => Number(d.misc_amount) },
    { header: "Rent", value: (d) => Number(d.rent_amount) },
    { header: "Trip Cost", value: (d) => tripCost(d) },
    { header: "Owner Details", value: (d) => d.owner_details ?? "" },
    { header: "Status", value: (d) => DISPATCH_STATUS_LABELS[d.status] },
    { header: "Branch", value: (d) => d.branches?.name ?? "" },
    { header: "Filled By", value: (d) => d.creator?.full_name ?? "" },
    { header: "Remarks", value: (d) => d.remarks ?? "" },
  ]

  return (
    <DataTable
      columns={columns}
      data={dispatches}
      searchPlaceholder="Search vehicle, driver, route…"
      emptyMessage="No dispatches yet. Create your first dispatch."
      toolbar={
        <>
          <ExportButton
            rows={dispatches}
            columns={exportColumns}
            filename="dispatches"
          />
          <DispatchFormDialog
            {...lookups}
            trigger={
              <Button>
                <Plus /> New dispatch
              </Button>
            }
          />
        </>
      }
    />
  )
}

"use client"

import { type ColumnDef } from "@tanstack/react-table"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ExportButton, type ExportColumn } from "@/components/export-button"
import { StatusBadge } from "@/components/badges"
import type { FuelStation } from "@/lib/types"
import { FuelStationFormDialog } from "./fuel-station-form"
import { deleteFuelStation } from "./actions"

export function FuelStationTable({
  stations,
  isAdmin,
}: {
  stations: FuelStation[]
  isAdmin: boolean
}) {
  const columns: ColumnDef<FuelStation>[] = [
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "location",
      header: "Location",
      cell: ({ row }) => row.original.location ?? "—",
    },
    {
      accessorKey: "contact",
      header: "Contact",
      cell: ({ row }) => row.original.contact ?? "—",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    ...(isAdmin
      ? [
          {
            id: "actions",
            header: "",
            enableSorting: false,
            cell: ({ row }) => (
              <div className="flex justify-end gap-1">
                <FuelStationFormDialog
                  initial={row.original}
                  trigger={
                    <Button variant="ghost" size="icon-sm">
                      <Pencil />
                      <span className="sr-only">Edit</span>
                    </Button>
                  }
                />
                <ConfirmDialog
                  title="Delete fuel station?"
                  description="This removes the station from the list."
                  successMessage="Fuel station deleted"
                  onConfirm={() => deleteFuelStation(row.original.id)}
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
          } as ColumnDef<FuelStation>,
        ]
      : []),
  ]

  const exportColumns: ExportColumn<FuelStation>[] = [
    { header: "Name", value: (s) => s.name },
    { header: "Location", value: (s) => s.location ?? "" },
    { header: "Contact", value: (s) => s.contact ?? "" },
    { header: "Status", value: (s) => s.status },
  ]

  return (
    <DataTable
      columns={columns}
      data={stations}
      searchPlaceholder="Search fuel stations…"
      emptyMessage="No fuel stations yet."
      toolbar={
        <>
          <ExportButton
            rows={stations}
            columns={exportColumns}
            filename="fuel-stations"
          />
          {isAdmin ? (
            <FuelStationFormDialog
              trigger={
                <Button>
                  <Plus /> Add fuel station
                </Button>
              }
            />
          ) : null}
        </>
      }
    />
  )
}

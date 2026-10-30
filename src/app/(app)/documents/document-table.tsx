"use client"

import * as React from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { FolderOpen, Plus } from "lucide-react"
import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { ExportButton, type ExportColumn } from "@/components/export-button"
import { ExpiryBadge } from "@/components/badges"
import { formatDate } from "@/lib/format"
import { daysUntil, expiryStatus } from "@/lib/format"
import { DOC_TYPES, DOC_TYPE_LABELS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { DocType, DocumentRow } from "@/lib/types"
import { DocumentFormDialog, type DocTruckOption } from "./document-form"
import {
  VehicleDocumentsDialog,
  type VehicleDocuments,
} from "./vehicle-documents-dialog"

const CHIP_CLASSES = {
  ok: "border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  warning:
    "border-amber-600/30 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  critical: "border-red-600/30 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  expired: "border-red-600 bg-red-600 text-white dark:border-red-500 dark:bg-red-600",
  missing: "text-muted-foreground border-dashed",
}

/** One document type at a glance: coloured by expiry, dashed if not on file. */
function DocChip({
  label,
  type,
  doc,
}: {
  label: string
  type: DocType
  doc?: DocumentRow
}) {
  const status = doc ? expiryStatus(daysUntil(doc.expiry_date)) : null
  return (
    <span
      title={
        doc && status
          ? `${DOC_TYPE_LABELS[type]}: ${formatDate(doc.expiry_date)} · ${status.label}`
          : `${DOC_TYPE_LABELS[type]}: not added`
      }
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium",
        CHIP_CLASSES[status?.level ?? "missing"]
      )}
    >
      {label}
    </span>
  )
}

// Every active truck gets a row, even with nothing on file, so gaps are visible.
// Documents can also belong to a truck that has since gone inactive.
function groupByVehicle(
  documents: DocumentRow[],
  trucks: DocTruckOption[]
): VehicleDocuments[] {
  const vehicles = new Map<string, VehicleDocuments>()
  const vehicleFor = (truckId: string, vehicle: string, branchName: string) => {
    const existing = vehicles.get(truckId)
    if (existing) return existing
    const created: VehicleDocuments = {
      truckId,
      vehicle,
      branchName,
      docs: {},
      nextExpiry: null,
    }
    vehicles.set(truckId, created)
    return created
  }

  for (const t of trucks) {
    vehicleFor(t.id, t.vehicle_number, t.branches?.name ?? "")
  }
  for (const d of documents) {
    const vehicle = vehicleFor(
      d.truck_id,
      d.trucks?.vehicle_number ?? "—",
      d.branches?.name ?? ""
    )
    vehicle.docs[d.doc_type] = d
    if (!vehicle.nextExpiry || d.expiry_date < vehicle.nextExpiry) {
      vehicle.nextExpiry = d.expiry_date
    }
  }

  // Most urgent first; vehicles with nothing on file at the end.
  return [...vehicles.values()].sort(
    (a, b) => daysUntil(a.nextExpiry) - daysUntil(b.nextExpiry)
  )
}

export function DocumentTable({
  documents,
  trucks,
  isAdmin,
}: {
  documents: DocumentRow[]
  trucks: DocTruckOption[]
  isAdmin: boolean
}) {
  const vehicles = groupByVehicle(documents, trucks)

  // Holds the id, not the row, so the open window picks up fresh data after a
  // document inside it is added, renewed, edited or deleted.
  const [openTruckId, setOpenTruckId] = React.useState<string | null>(null)
  const openVehicle = vehicles.find((v) => v.truckId === openTruckId) ?? null

  const columns: ColumnDef<VehicleDocuments>[] = [
    {
      accessorKey: "vehicle",
      header: "Vehicle",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setOpenTruckId(row.original.truckId)}
          className="text-left font-medium underline-offset-4 hover:underline"
        >
          {row.original.vehicle}
        </button>
      ),
    },
    {
      id: "documents",
      header: "Documents",
      // Also what search looks through, so a policy number finds its vehicle.
      accessorFn: (v) =>
        Object.values(v.docs)
          .map((d) => `${DOC_TYPE_LABELS[d.doc_type]} ${d.doc_number ?? ""}`)
          .join(" "),
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {DOC_TYPES.map(({ value, short }) => (
            <DocChip
              key={value}
              label={short}
              type={value}
              doc={row.original.docs[value]}
            />
          ))}
        </div>
      ),
    },
    {
      id: "expiry",
      header: "Next expiry",
      accessorFn: (v) => daysUntil(v.nextExpiry),
      cell: ({ row }) => <ExpiryBadge date={row.original.nextExpiry} />,
    },
    ...(isAdmin
      ? [
          {
            accessorKey: "branchName",
            header: "Branch",
          } as ColumnDef<VehicleDocuments>,
        ]
      : []),
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpenTruckId(row.original.truckId)}
          >
            <FolderOpen /> View all
          </Button>
        </div>
      ),
    },
  ]

  const exportColumns: ExportColumn<DocumentRow>[] = [
    { header: "Vehicle", value: (d) => d.trucks?.vehicle_number ?? "" },
    { header: "Type", value: (d) => DOC_TYPE_LABELS[d.doc_type] },
    { header: "Number", value: (d) => d.doc_number ?? "" },
    { header: "Issue Date", value: (d) => d.issue_date ?? "" },
    { header: "Expiry Date", value: (d) => d.expiry_date },
    { header: "Days Left", value: (d) => daysUntil(d.expiry_date) },
    { header: "Branch", value: (d) => d.branches?.name ?? "" },
    { header: "Notes", value: (d) => d.notes ?? "" },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={vehicles}
        searchPlaceholder="Search vehicle or document number…"
        emptyMessage="No vehicles yet. Add a truck to start filing its documents."
        toolbar={
          <>
            <ExportButton
              rows={documents}
              columns={exportColumns}
              filename="documents"
            />
            <DocumentFormDialog
              trucks={trucks}
              trigger={
                <Button>
                  <Plus /> Add document
                </Button>
              }
            />
          </>
        }
      />
      <VehicleDocumentsDialog
        vehicle={openVehicle}
        trucks={trucks}
        onClose={() => setOpenTruckId(null)}
      />
    </>
  )
}

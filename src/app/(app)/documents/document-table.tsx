"use client"

import * as React from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Eye, History, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ExportButton, type ExportColumn } from "@/components/export-button"
import { ExpiryBadge } from "@/components/badges"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { formatDate } from "@/lib/format"
import { daysUntil } from "@/lib/format"
import { DOC_TYPE_LABELS } from "@/lib/constants"
import type { DocumentRow } from "@/lib/types"
import { DocumentFormDialog, type DocTruckOption } from "./document-form"
import { deleteDocument, getDocumentHistory, getSignedUrl } from "./actions"

function ViewFileButton({
  path,
  size = "xs",
}: {
  path: string | null
  size?: "xs" | "sm"
}) {
  const [loading, setLoading] = React.useState(false)
  if (!path) return <span className="text-muted-foreground text-sm">—</span>

  async function open() {
    setLoading(true)
    const res = await getSignedUrl(path!)
    setLoading(false)
    if (res.url) window.open(res.url, "_blank", "noopener")
    else toast.error(res.error ?? "Could not open file")
  }

  return (
    <Button variant="outline" size={size} onClick={open} disabled={loading}>
      <Eye /> View
    </Button>
  )
}

function HistoryDialog({
  truckId,
  docType,
  vehicle,
  trigger,
}: {
  truckId: string
  docType: string
  vehicle: string
  trigger: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [rows, setRows] = React.useState<DocumentRow[] | null>(null)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      setRows(null)
      getDocumentHistory(truckId, docType).then(setRows)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {DOC_TYPE_LABELS[docType as keyof typeof DOC_TYPE_LABELS]} history ·{" "}
            {vehicle}
          </DialogTitle>
          <DialogDescription>All recorded versions, newest first.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60dvh] space-y-2 overflow-y-auto">
          {rows === null ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No history.</p>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {r.doc_number || "No number"}
                    </span>
                    {r.is_current ? (
                      <Badge variant="outline" className="text-xs">
                        current
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Expiry {formatDate(r.expiry_date)} · added{" "}
                    {formatDate(r.created_at)}
                  </p>
                </div>
                <ViewFileButton path={r.file_url} />
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
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
  const columns: ColumnDef<DocumentRow>[] = [
    {
      id: "vehicle",
      header: "Vehicle",
      accessorFn: (r) => r.trucks?.vehicle_number ?? "",
      cell: ({ row }) => row.original.trucks?.vehicle_number ?? "—",
    },
    {
      id: "doc_type",
      header: "Type",
      accessorFn: (r) => DOC_TYPE_LABELS[r.doc_type],
      cell: ({ row }) => (
        <Badge variant="secondary">
          {DOC_TYPE_LABELS[row.original.doc_type]}
        </Badge>
      ),
    },
    {
      accessorKey: "doc_number",
      header: "Number",
      cell: ({ row }) => row.original.doc_number ?? "—",
    },
    {
      id: "expiry",
      header: "Expiry",
      accessorFn: (r) => daysUntil(r.expiry_date),
      cell: ({ row }) => <ExpiryBadge date={row.original.expiry_date} />,
    },
    {
      id: "file",
      header: "File",
      enableSorting: false,
      cell: ({ row }) => <ViewFileButton path={row.original.file_url} />,
    },
    ...(isAdmin
      ? [
          {
            id: "branch",
            header: "Branch",
            accessorFn: (r: DocumentRow) => r.branches?.name ?? "",
          } as ColumnDef<DocumentRow>,
        ]
      : []),
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <DocumentFormDialog
            trucks={trucks}
            preset={{
              truckId: row.original.truck_id,
              docType: row.original.doc_type,
            }}
            trigger={
              <Button variant="ghost" size="icon-sm" title="Renew">
                <RefreshCw />
                <span className="sr-only">Renew</span>
              </Button>
            }
          />
          <HistoryDialog
            truckId={row.original.truck_id}
            docType={row.original.doc_type}
            vehicle={row.original.trucks?.vehicle_number ?? ""}
            trigger={
              <Button variant="ghost" size="icon-sm" title="History">
                <History />
                <span className="sr-only">History</span>
              </Button>
            }
          />
          <DocumentFormDialog
            trucks={trucks}
            initial={row.original}
            trigger={
              <Button variant="ghost" size="icon-sm" title="Edit">
                <Pencil />
                <span className="sr-only">Edit</span>
              </Button>
            }
          />
          <ConfirmDialog
            title="Delete document?"
            description="This removes the current version and its file. History versions remain."
            successMessage="Document deleted"
            onConfirm={() => deleteDocument(row.original.id)}
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
    <DataTable
      columns={columns}
      data={documents}
      searchPlaceholder="Search vehicle, type, number…"
      emptyMessage="No documents yet. Add RC, Insurance, Pollution, Fitness or Permit."
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
  )
}

"use client"

import * as React from "react"
import { Eye, History, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/confirm-dialog"
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
import { DOC_TYPES, DOC_TYPE_LABELS } from "@/lib/constants"
import type { DocType, DocumentRow } from "@/lib/types"
import { DocumentFormDialog, type DocTruckOption } from "./document-form"
import { deleteDocument, getDocumentHistory, getSignedUrl } from "./actions"

/** One vehicle with its current documents, keyed by type. */
export type VehicleDocuments = {
  truckId: string
  vehicle: string
  branchName: string
  docs: Partial<Record<DocType, DocumentRow>>
  nextExpiry: string | null
}

function ViewFileButton({ path }: { path: string | null }) {
  const [loading, setLoading] = React.useState(false)
  if (!path) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Eye /> No file
      </Button>
    )
  }

  async function open() {
    // Mobile browsers block a tab opened after an await, so open it first.
    const tab = window.open("", "_blank")
    setLoading(true)
    const res = await getSignedUrl(path!)
    setLoading(false)
    if (res.url && tab) {
      tab.opener = null
      tab.location.href = res.url
    } else {
      tab?.close()
      toast.error(res.error ?? "Could not open file")
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={open} disabled={loading}>
      <Eye /> View
    </Button>
  )
}

function HistoryDialog({
  truckId,
  docType,
  vehicle,
}: {
  truckId: string
  docType: DocType
  vehicle: string
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
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <History /> History
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {DOC_TYPE_LABELS[docType]} history · {vehicle}
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
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium break-words">
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

function DocumentCard({
  type,
  doc,
  vehicle,
  trucks,
}: {
  type: DocType
  doc?: DocumentRow
  vehicle: VehicleDocuments
  trucks: DocTruckOption[]
}) {
  const preset = { truckId: vehicle.truckId, docType: type }

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{DOC_TYPE_LABELS[type]}</p>
          <p className="text-muted-foreground text-xs break-words">
            {doc
              ? [
                  doc.doc_number ? `No. ${doc.doc_number}` : null,
                  doc.issue_date ? `Issued ${formatDate(doc.issue_date)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No number recorded"
              : "Not added yet"}
          </p>
        </div>
        {doc ? (
          <ExpiryBadge date={doc.expiry_date} />
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Missing
          </Badge>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {doc ? (
          <>
            <ViewFileButton path={doc.file_url} />
            <DocumentFormDialog
              trucks={trucks}
              preset={preset}
              trigger={
                <Button variant="ghost" size="sm">
                  <RefreshCw /> Renew
                </Button>
              }
            />
          </>
        ) : (
          <DocumentFormDialog
            trucks={trucks}
            preset={preset}
            trigger={
              <Button variant="outline" size="sm">
                <Plus /> Add
              </Button>
            }
          />
        )}
        {/* Kept for a deleted document too: its older versions remain. */}
        <HistoryDialog
          truckId={vehicle.truckId}
          docType={type}
          vehicle={vehicle.vehicle}
        />
        {doc ? (
          <>
            <DocumentFormDialog
              trucks={trucks}
              initial={doc}
              trigger={
                <Button variant="ghost" size="sm">
                  <Pencil /> Edit
                </Button>
              }
            />
            <ConfirmDialog
              title="Delete document?"
              description="This removes the current version and its file. History versions remain."
              successMessage="Document deleted"
              onConfirm={() => deleteDocument(doc.id)}
              trigger={
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Trash2 /> Delete
                </Button>
              }
            />
          </>
        ) : null}
      </div>
    </div>
  )
}

/** The single window holding everything on file for one vehicle. */
export function VehicleDocumentsDialog({
  vehicle,
  trucks,
  onClose,
}: {
  vehicle: VehicleDocuments | null
  trucks: DocTruckOption[]
  onClose: () => void
}) {
  const filed = vehicle ? Object.keys(vehicle.docs).length : 0

  return (
    <Dialog open={!!vehicle} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        {vehicle ? (
          <>
            <DialogHeader>
              <DialogTitle>{vehicle.vehicle}</DialogTitle>
              <DialogDescription>
                {filed} of {DOC_TYPES.length} documents on file
                {vehicle.branchName ? ` · ${vehicle.branchName}` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="grid min-w-0 gap-2 sm:grid-cols-2">
              {DOC_TYPES.map(({ value }) => (
                <DocumentCard
                  key={value}
                  type={value}
                  doc={vehicle.docs[value]}
                  vehicle={vehicle}
                  trucks={trucks}
                />
              ))}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

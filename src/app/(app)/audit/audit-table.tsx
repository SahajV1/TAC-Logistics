"use client"

import * as React from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { Eye } from "lucide-react"
import { DataTable } from "@/components/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExportButton, type ExportColumn } from "@/components/export-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { formatDateTime } from "@/lib/format"
import type { AuditLog } from "@/lib/types"

const TABLE_LABELS: Record<string, string> = {
  dispatches: "Dispatch",
  drivers: "Driver",
  trucks: "Truck",
  documents: "Document",
  salaries: "Salary",
  profiles: "Staff",
}

const ACTION_VARIANT: Record<
  AuditLog["action"],
  "default" | "secondary" | "destructive"
> = {
  INSERT: "default",
  UPDATE: "secondary",
  DELETE: "destructive",
}

function changedFields(log: AuditLog): string[] {
  const oldD = log.old_data ?? {}
  const newD = log.new_data ?? {}
  const keys = new Set([...Object.keys(oldD), ...Object.keys(newD)])
  const skip = new Set(["updated_at", "created_at"])
  const out: string[] = []
  for (const k of keys) {
    if (skip.has(k)) continue
    const a = JSON.stringify((oldD as Record<string, unknown>)[k] ?? null)
    const b = JSON.stringify((newD as Record<string, unknown>)[k] ?? null)
    if (a !== b) out.push(`${k}: ${a} → ${b}`)
  }
  return out
}

function DetailsDialog({ log }: { log: AuditLog }) {
  const diff = changedFields(log)
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm">
          <Eye />
          <span className="sr-only">Details</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {log.action} · {TABLE_LABELS[log.table_name] ?? log.table_name}
          </DialogTitle>
          <DialogDescription>
            {formatDateTime(log.created_at)} ·{" "}
            {log.changed_by_name ?? "System"}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60dvh] overflow-y-auto">
          {log.action === "UPDATE" ? (
            diff.length ? (
              <ul className="space-y-1 text-sm">
                {diff.map((d, i) => (
                  <li
                    key={i}
                    className="bg-muted/50 rounded px-2 py-1 font-mono text-xs break-all"
                  >
                    {d}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">No field changes.</p>
            )
          ) : (
            <pre className="bg-muted/50 overflow-x-auto rounded p-3 text-xs">
              {JSON.stringify(
                log.action === "DELETE" ? log.old_data : log.new_data,
                null,
                2
              )}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function AuditTable({
  logs,
  branchMap,
}: {
  logs: AuditLog[]
  branchMap: Record<string, string>
}) {
  const columns: ColumnDef<AuditLog>[] = [
    {
      accessorKey: "created_at",
      header: "When",
      cell: ({ row }) => formatDateTime(row.original.created_at),
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => (
        <Badge variant={ACTION_VARIANT[row.original.action]}>
          {row.original.action}
        </Badge>
      ),
    },
    {
      id: "table",
      header: "Record",
      accessorFn: (r) => TABLE_LABELS[r.table_name] ?? r.table_name,
    },
    {
      accessorKey: "changed_by_name",
      header: "By",
      cell: ({ row }) => row.original.changed_by_name ?? "System",
    },
    {
      id: "branch",
      header: "Branch",
      accessorFn: (r) => (r.branch_id ? branchMap[r.branch_id] ?? "—" : "—"),
    },
    {
      id: "details",
      header: "",
      enableSorting: false,
      cell: ({ row }) => <DetailsDialog log={row.original} />,
    },
  ]

  const exportColumns: ExportColumn<AuditLog>[] = [
    { header: "When", value: (l) => l.created_at },
    { header: "Action", value: (l) => l.action },
    { header: "Record", value: (l) => TABLE_LABELS[l.table_name] ?? l.table_name },
    { header: "Record ID", value: (l) => l.record_id ?? "" },
    { header: "By", value: (l) => l.changed_by_name ?? "System" },
    { header: "Branch", value: (l) => (l.branch_id ? branchMap[l.branch_id] ?? "" : "") },
  ]

  return (
    <DataTable
      columns={columns}
      data={logs}
      searchPlaceholder="Search action, record, user…"
      emptyMessage="No audit entries yet."
      pageSize={15}
      toolbar={
        <ExportButton rows={logs} columns={exportColumns} filename="audit-log" />
      }
    />
  )
}

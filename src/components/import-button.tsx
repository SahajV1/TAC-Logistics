"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  FileDown,
  FileUp,
  Loader2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  MAX_IMPORT_ROWS,
  type ImportAction,
  type ImportCell,
  type ImportColumn,
  type ImportResult,
  type ImportRowResult,
  type ImportRowStatus,
} from "@/lib/import"
import {
  downloadTemplate,
  matchingSheets,
  openWorkbook,
  readSheet,
  type ParsedSheet,
  type WorkBook,
} from "@/lib/import-workbook"

// Rendering thousands of rows would freeze a phone; the counts stay exact.
const MAX_LISTED_ROWS = 200

const STATUS_ORDER: ImportRowStatus[] = ["error", "duplicate", "ready"]

const STATUS_STYLES: Record<
  ImportRowStatus,
  { label: string; icon: typeof AlertCircle; badge: string; iconColor: string }
> = {
  ready: {
    label: "ready",
    icon: CheckCircle2,
    badge:
      "border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  duplicate: {
    label: "duplicate",
    icon: Copy,
    badge:
      "border-amber-600/30 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  error: {
    label: "error",
    icon: AlertCircle,
    badge:
      "border-red-600/30 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
    iconColor: "text-red-600 dark:text-red-400",
  },
}

function ResultRow({ row }: { row: ImportRowResult }) {
  const { icon: Icon, iconColor } = STATUS_STYLES[row.status]
  return (
    <div className="flex gap-2 border-b p-2 last:border-0">
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconColor)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm break-words">
          <span className="text-muted-foreground">Row {row.row}</span>
          {row.summary ? ` · ${row.summary}` : ""}
        </p>
        {row.messages.map((message) => (
          <p key={message} className="text-muted-foreground text-xs break-words">
            {message}
          </p>
        ))}
      </div>
    </div>
  )
}

export function ImportButton({
  title,
  description,
  columns,
  templateName,
  action,
  branches,
  defaults,
}: {
  title: string
  description: string
  columns: ImportColumn[]
  templateName: string
  action: ImportAction
  /** Admins pick one for rows that don't say which branch they belong to. */
  branches?: { id: string; name: string }[]
  /** Cell values for rows that leave a column empty, e.g. the pump of a tab. */
  defaults?: Record<string, ImportCell>
}) {
  const router = useRouter()
  const fileInput = React.useRef<HTMLInputElement>(null)
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState<"checking" | "importing" | null>(null)
  const [fileName, setFileName] = React.useState("")
  const [workbook, setWorkbook] = React.useState<WorkBook | null>(null)
  const [sheetNames, setSheetNames] = React.useState<string[]>([])
  const [sheet, setSheet] = React.useState<ParsedSheet | null>(null)
  const [result, setResult] = React.useState<ImportResult | null>(null)
  const [problem, setProblem] = React.useState<string | null>(null)
  const [branchId, setBranchId] = React.useState("")
  const [includeDuplicates, setIncludeDuplicates] = React.useState(false)

  function reset() {
    setFileName("")
    setWorkbook(null)
    setSheetNames([])
    setSheet(null)
    setResult(null)
    setProblem(null)
    setBranchId("")
    setIncludeDuplicates(false)
  }

  function handleOpenChange(next: boolean) {
    if (next) reset()
    setOpen(next)
  }

  // Nothing is saved here: the server validates every row and reports back, so
  // the user sees exactly what will happen before committing.
  async function check(book: WorkBook, sheetName: string, branch: string) {
    setProblem(null)
    setResult(null)
    setIncludeDuplicates(false)

    const parsed = readSheet(book, sheetName, columns, defaults)
    setSheet(parsed)
    if (parsed.missing.length) {
      setProblem(
        `"${sheetName}" is missing ${parsed.missing.length === 1 ? "a column" : "columns"}: ${parsed.missing.join(", ")}.`
      )
      return
    }
    if (parsed.rows.length === 0) {
      setProblem(`No data found under the headers in "${sheetName}".`)
      return
    }
    if (parsed.rows.length > MAX_IMPORT_ROWS) {
      setProblem(
        `"${sheetName}" has ${parsed.rows.length} rows. Please upload up to ${MAX_IMPORT_ROWS} at a time.`
      )
      return
    }

    setBusy("checking")
    try {
      const res = await action(parsed.rows, {
        commit: false,
        includeDuplicates: false,
        branchId: branch || undefined,
      })
      if (res.error) setProblem(res.error)
      else setResult(res)
    } catch {
      setProblem("This file could not be checked. If it is very large, split it and try again.")
    } finally {
      setBusy(null)
    }
  }

  async function handleFile(file: File) {
    reset()
    setFileName(file.name)
    let book: WorkBook
    try {
      book = await openWorkbook(file)
    } catch (e) {
      setProblem(
        e instanceof Error && e.message.includes("10 MB")
          ? e.message
          : "This file could not be opened. Please upload an Excel or CSV file."
      )
      return
    }
    const names = matchingSheets(book, columns)
    setWorkbook(book)
    setSheetNames(names)
    if (names.length === 0) {
      setProblem(
        `No sheet with the expected columns was found. Required: ${columns
          .filter((c) => c.required && !(c.key in (defaults ?? {})))
          .map((c) => c.header)
          .join(", ")}.`
      )
      return
    }
    await check(book, names[0], "")
  }

  async function commit() {
    if (!sheet) return
    setBusy("importing")
    try {
      const res = await action(sheet.rows, {
        commit: true,
        includeDuplicates,
        branchId: branchId || undefined,
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`${res.imported} row${res.imported === 1 ? "" : "s"} uploaded`)
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("Upload failed. Try again: anything already saved will show as a duplicate.")
    } finally {
      setBusy(null)
    }
  }

  const counts = { ready: 0, duplicate: 0, error: 0 }
  for (const r of result?.rows ?? []) counts[r.status]++
  const importCount = counts.ready + (includeDuplicates ? counts.duplicate : 0)

  // Problems first, and rows with notes ahead of plain ready rows.
  const listed = [...(result?.rows ?? [])]
    .sort(
      (a, b) =>
        STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
        b.messages.length - a.messages.length ||
        a.row - b.row
    )
    .slice(0, MAX_LISTED_ROWS)

  const requiredHeaders = columns
    .filter((c) => c.required && !(c.key in (defaults ?? {})))
    .map((c) => c.header)
  const optionalHeaders = columns
    .filter((c) => !requiredHeaders.includes(c.header))
    .map((c) => c.header)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload /> Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xls,.csv"
              aria-label="Excel or CSV file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                // Clearing lets the same file be picked again after fixing it.
                e.target.value = ""
                if (file) handleFile(file)
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => fileInput.current?.click()}
            >
              <FileUp /> {fileName ? "Choose another file" : "Choose Excel or CSV file"}
            </Button>
            {fileName ? (
              <span className="text-muted-foreground min-w-0 text-xs break-all">
                {fileName}
              </span>
            ) : null}
          </div>

          {!workbook ? (
            <div className="bg-muted/40 space-y-2 rounded-lg border p-3 text-xs">
              <p>
                <span className="font-medium">Required columns:</span>{" "}
                {requiredHeaders.join(", ")}
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium">Optional:</span>{" "}
                {optionalHeaders.join(", ")}
              </p>
              <p className="text-muted-foreground">
                Column order doesn&apos;t matter, and a sheet from the Export
                button can be uploaded back.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadTemplate(columns, templateName)}
              >
                <FileDown /> Download template
              </Button>
            </div>
          ) : null}

          {workbook && (sheetNames.length > 1 || branches?.length) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {sheetNames.length > 1 ? (
                <div className="min-w-0 space-y-2">
                  <Label>Sheet</Label>
                  <Select
                    value={sheet?.name ?? ""}
                    disabled={busy !== null}
                    onValueChange={(name) => check(workbook, name, branchId)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a sheet" />
                    </SelectTrigger>
                    <SelectContent>
                      {sheetNames.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {branches?.length ? (
                <div className="min-w-0 space-y-2">
                  <Label>Branch for rows without one</Label>
                  <Select
                    value={branchId}
                    disabled={busy !== null}
                    onValueChange={(id) => {
                      setBranchId(id)
                      if (sheet) check(workbook, sheet.name, id)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}

          {problem ? (
            <p className="text-destructive text-sm" role="alert">
              {problem}
            </p>
          ) : null}

          {busy === "checking" ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> Checking rows…
            </p>
          ) : null}

          {result ? (
            <>
              <div className="flex flex-wrap gap-2">
                {(["ready", "duplicate", "error"] as const).map((status) => (
                  <Badge
                    key={status}
                    variant="outline"
                    className={STATUS_STYLES[status].badge}
                  >
                    {counts[status]} {STATUS_STYLES[status].label}
                    {status !== "ready" && counts[status] !== 1 ? "s" : ""}
                  </Badge>
                ))}
              </div>

              {sheet?.ignored.length ? (
                <p className="text-muted-foreground text-xs break-words">
                  Columns not used: {sheet.ignored.join(", ")}
                </p>
              ) : null}

              {counts.duplicate > 0 ? (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id={`${templateName}-duplicates`}
                    checked={includeDuplicates}
                    onCheckedChange={(v) => setIncludeDuplicates(v === true)}
                  />
                  <Label
                    htmlFor={`${templateName}-duplicates`}
                    className="leading-snug font-normal"
                  >
                    Also upload {counts.duplicate} possible duplicate
                    {counts.duplicate === 1 ? "" : "s"}. Leave this off unless
                    these really are separate entries.
                  </Label>
                </div>
              ) : null}

              <div className="max-h-72 overflow-y-auto rounded-lg border">
                {listed.map((row) => (
                  <ResultRow key={row.row} row={row} />
                ))}
              </div>
              {result.rows.length > listed.length ? (
                <p className="text-muted-foreground text-xs">
                  Showing the first {listed.length} of {result.rows.length} rows.
                </p>
              ) : null}
              {counts.error > 0 ? (
                <p className="text-muted-foreground text-xs">
                  Rows with errors are skipped. Fix them in the sheet and upload
                  it again; rows already saved will show as duplicates.
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        <DialogFooter className="bg-popover sticky -bottom-4 z-10">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={commit}
            disabled={busy !== null || importCount === 0}
          >
            {busy === "importing" ? <Loader2 className="animate-spin" /> : null}
            {importCount > 0
              ? `Upload ${importCount} row${importCount === 1 ? "" : "s"}`
              : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

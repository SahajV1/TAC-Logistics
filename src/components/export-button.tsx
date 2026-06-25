"use client"

import * as XLSX from "xlsx"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"

export type ExportColumn<T> = {
  header: string
  value: (row: T) => string | number
}

export function ExportButton<T>({
  rows,
  columns,
  filename,
  sheetName = "Sheet1",
  label = "Export",
  disabled,
}: {
  rows: T[]
  columns: ExportColumn<T>[]
  filename: string
  sheetName?: string
  label?: string
  disabled?: boolean
}) {
  function handleExport() {
    const records = rows.map((row) => {
      const out: Record<string, string | number> = {}
      for (const col of columns) out[col.header] = col.value(row)
      return out
    })
    const worksheet = XLSX.utils.json_to_sheet(records)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    const stamp = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(workbook, `${filename}-${stamp}.xlsx`)
  }

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={disabled || rows.length === 0}
    >
      <Download /> {label}
    </Button>
  )
}

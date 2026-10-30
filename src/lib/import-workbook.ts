import * as XLSX from "xlsx"
import {
  matchesColumn,
  type ImportCell,
  type ImportColumn,
  type ImportRow,
} from "@/lib/import"

// Browser-only: opens the uploaded file and turns it into plain rows. Only
// those rows reach the server, so a workbook is never parsed server-side.

const HEADER_SCAN_ROWS = 20
const MAX_FILE_BYTES = 10 * 1024 * 1024

export type { WorkBook } from "xlsx"

export type ParsedSheet = {
  name: string
  matched: string[]
  ignored: string[]
  missing: string[]
  rows: ImportRow[]
}

export async function openWorkbook(file: File): Promise<XLSX.WorkBook> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("This file is over 10 MB. Please split it into smaller sheets.")
  }
  // raw: stops CSV dates being read month-first; our parser reads them day-first.
  return XLSX.read(await file.arrayBuffer(), { type: "array", raw: true })
}

function sheetGrid(sheet: XLSX.WorkSheet) {
  const ref = sheet["!ref"]
  if (!ref) return { grid: [] as unknown[][], firstRow: 0 }
  return {
    grid: XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
    }),
    firstRow: XLSX.utils.decode_range(ref).s.r,
  }
}

/** Maps sheet column index → our column; the first of any repeated header wins. */
function matchHeaders(cells: unknown[], columns: ImportColumn[]) {
  const mapped = new Map<number, ImportColumn>()
  cells.forEach((cell, index) => {
    const column = columns.find(
      (c) => matchesColumn(cell, c) && ![...mapped.values()].includes(c)
    )
    if (column) mapped.set(index, column)
  })
  return mapped
}

// Sheets often have a title or blank rows above the headers, so look for the
// row that matches the most columns instead of assuming it's the first.
function findHeaderRow(grid: unknown[][], columns: ImportColumn[]) {
  let best = { index: -1, count: 0 }
  grid.slice(0, HEADER_SCAN_ROWS).forEach((cells, index) => {
    const count = matchHeaders(cells, columns).size
    if (count > best.count) best = { index, count }
  })
  return best
}

/** Sheets that look like this upload, best match first. */
export function matchingSheets(workbook: XLSX.WorkBook, columns: ImportColumn[]) {
  return workbook.SheetNames.map((name) => ({
    name,
    count: findHeaderRow(sheetGrid(workbook.Sheets[name]).grid, columns).count,
  }))
    .filter((s) => s.count >= 2)
    .sort((a, b) => b.count - a.count)
    .map((s) => s.name)
}

const pad = (n: number) => String(n).padStart(2, "0")

function toCell(value: unknown, column: ImportColumn, date1904: boolean): ImportCell {
  if (value === null || value === undefined) return null
  if (typeof value === "number" && column.kind === "date") {
    const d = XLSX.SSF.parse_date_code(value, { date1904 })
    if (d?.y) return `${d.y}-${pad(d.m)}-${pad(d.d)}`
  }
  if (typeof value === "number" || typeof value === "boolean") return value
  return String(value).trim() || null
}

export function readSheet(
  workbook: XLSX.WorkBook,
  name: string,
  columns: ImportColumn[],
  defaults: Record<string, ImportCell> = {}
): ParsedSheet {
  const { grid, firstRow } = sheetGrid(workbook.Sheets[name])
  const { index: headerIndex } = findHeaderRow(grid, columns)
  const headerCells = headerIndex >= 0 ? grid[headerIndex] : []
  const mapped = matchHeaders(headerCells, columns)
  const date1904 = !!workbook.Workbook?.WBProps?.date1904

  const rows: ImportRow[] = []
  grid.slice(headerIndex + 1).forEach((cells, offset) => {
    const row: ImportRow["cells"] = {}
    for (const [index, column] of mapped) {
      const cell = toCell(cells[index], column, date1904)
      if (cell !== null) row[column.key] = cell
    }
    if (Object.keys(row).length === 0) return
    rows.push({
      row: firstRow + headerIndex + offset + 2,
      cells: { ...defaults, ...row },
    })
  })

  const found = [...mapped.values()]
  return {
    name,
    matched: found.map((c) => c.header),
    ignored: headerCells
      .filter((cell, index) => !mapped.has(index) && cell !== null && cell !== "")
      .map(String),
    missing: columns
      .filter((c) => c.required && !found.includes(c) && !(c.key in defaults))
      .map((c) => c.header),
    rows,
  }
}

export function downloadTemplate(columns: ImportColumn[], filename: string) {
  const worksheet = XLSX.utils.aoa_to_sheet([columns.map((c) => c.header)])
  worksheet["!cols"] = columns.map((c) => ({
    wch: Math.max(c.header.length + 2, 14),
  }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Upload")
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

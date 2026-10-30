// Shared Excel-upload plumbing: the columns each sheet type understands and the
// cell parsers the server actions validate with. There is deliberately no xlsx
// here — workbooks are only ever opened in the browser (lib/import-workbook.ts);
// the server receives plain rows and re-validates all of them.

import type { DealerTxnType, DispatchStatus, PersonType, TruckType } from "@/lib/types"

export const MAX_IMPORT_ROWS = 5000

export type ImportCell = string | number | boolean | null

export type ImportColumn = {
  key: string
  /** Shown in the template. Matched against sheet headers along with aliases. */
  header: string
  aliases?: string[]
  required?: boolean
  /** Excel stores dates as serial numbers, so these need converting. */
  kind?: "date"
}

/** `row` is the Excel row number, so problems can be found in the sheet. */
export type ImportRow = { row: number; cells: Record<string, ImportCell> }

export type ImportOptions = {
  /** false = check only, nothing is written. */
  commit: boolean
  includeDuplicates: boolean
  /** Admin's choice for rows that don't say which branch they belong to. */
  branchId?: string
}

export type ImportRowStatus = "ready" | "duplicate" | "error"

export type ImportRowResult = {
  row: number
  summary: string
  status: ImportRowStatus
  /** Errors, or notes about what will happen to a row that is otherwise fine. */
  messages: string[]
}

export type ImportResult = {
  error?: string
  rows: ImportRowResult[]
  imported: number
}

export type ImportAction = (
  rows: ImportRow[],
  options: ImportOptions
) => Promise<ImportResult>

export const importFailure = (error: string): ImportResult => ({
  error,
  rows: [],
  imported: 0,
})

export function rowResult(
  row: number,
  summary: string,
  errors: string[],
  duplicate: string | null,
  notes: string[]
): ImportRowResult {
  const unique = (messages: string[]) => [...new Set(messages)]
  if (errors.length)
    return { row, summary, status: "error", messages: unique(errors) }
  if (duplicate)
    return { row, summary, status: "duplicate", messages: unique([duplicate, ...notes]) }
  return { row, summary, status: "ready", messages: unique(notes) }
}

export const shouldImport = (r: ImportRowResult, options: ImportOptions) =>
  r.status === "ready" || (r.status === "duplicate" && options.includeDuplicates)

// ---- Columns ---------------------------------------------------------------
// Headers match what the Export buttons write, so an exported sheet can be
// edited and uploaded back. Calculated export columns (Trip Cost, Net, Filled
// By…) are simply ignored.

export const DISPATCH_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "date", header: "Date", aliases: ["Dispatch Date", "Trip Date"], required: true, kind: "date" },
  { key: "vehicle", header: "Vehicle", aliases: ["Vehicle No", "Vehicle Number", "Truck", "Truck No", "Truck Number"], required: true },
  { key: "driver", header: "Driver", aliases: ["Driver Name"], required: true },
  { key: "from", header: "From", aliases: ["Origin", "From Location", "Source"], required: true },
  { key: "to", header: "To", aliases: ["Destination", "To Location"], required: true },
  { key: "truck_type", header: "Truck Type", aliases: ["Type"] },
  // No bare "Fuel" / "Diesel" alias: those headers may mean litres or rupees.
  { key: "fuel_litres", header: "Fuel Litres", aliases: ["Litres", "Diesel Litres"] },
  { key: "fuel_cost", header: "Fuel Cost", aliases: ["Fuel Amount", "Diesel Cost", "Diesel Amount"] },
  { key: "fuel_station", header: "Fuel Station", aliases: ["Station", "Pump", "Petrol Pump"] },
  { key: "advance", header: "Advance", aliases: ["Advance Amount"] },
  { key: "toll", header: "Toll", aliases: ["Toll Amount"] },
  { key: "misc", header: "Misc", aliases: ["Miscellaneous", "Misc Amount", "Other"] },
  { key: "rent", header: "Rent", aliases: ["Rent Amount", "Hire", "Hire Amount"] },
  { key: "rented_advance", header: "Rented Advance", aliases: ["Dealer Advance", "Advance To Dealer"] },
  { key: "rented_fuel_litres", header: "Rented Fuel Litres", aliases: ["Dealer Fuel Litres"] },
  { key: "rented_fuel_cost", header: "Rented Fuel Cost", aliases: ["Dealer Fuel Cost"] },
  { key: "rented_fuel_station", header: "Rented Fuel Station", aliases: ["Dealer Fuel Station"] },
  { key: "dealer", header: "Dealer", aliases: ["Dealer Name", "Rented From"] },
  { key: "owner_details", header: "Owner Details", aliases: ["Owner", "Owner Name"] },
  { key: "status", header: "Status" },
  { key: "branch", header: "Branch" },
  { key: "remarks", header: "Remarks", aliases: ["Notes"] },
]

const RENTED_KEYS = [
  "date",
  "vehicle",
  "dealer",
  "owner_details",
  "driver",
  "from",
  "to",
  "rent",
  "rented_advance",
  "rented_fuel_litres",
  "rented_fuel_cost",
  "rented_fuel_station",
  "fuel_litres",
  "fuel_cost",
  "fuel_station",
  "advance",
  "toll",
  "misc",
  "status",
  "branch",
  "remarks",
]

export const RENTED_IMPORT_COLUMNS: ImportColumn[] = RENTED_KEYS.map((key) => {
  const column = DISPATCH_IMPORT_COLUMNS.find((c) => c.key === key)!
  if (key === "dealer") return { ...column, required: true }
  if (key === "rent") return { ...column, header: "Rent Amount", aliases: ["Rent", "Hire", "Hire Amount"] }
  return column
})

export const SALARY_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "month", header: "Month", aliases: ["Salary Month"], required: true, kind: "date" },
  { key: "person", header: "Person", aliases: ["Name", "Person Name", "Driver", "Staff", "Employee", "Employee Name"], required: true },
  { key: "type", header: "Type", aliases: ["Person Type"] },
  { key: "base", header: "Base", aliases: ["Base Salary", "Basic", "Salary"], required: true },
  { key: "bonus", header: "Bonus" },
  { key: "deductions", header: "Deductions", aliases: ["Deduction"] },
  { key: "advance", header: "Advance" },
  { key: "paid", header: "Paid", aliases: ["Status", "Payment Status"] },
  { key: "paid_date", header: "Paid Date", aliases: ["Paid On"], kind: "date" },
  { key: "branch", header: "Branch" },
  { key: "notes", header: "Notes", aliases: ["Remarks"] },
]

export const DEALER_TXN_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "date", header: "Date", aliases: ["Txn Date", "Entry Date"], required: true, kind: "date" },
  { key: "dealer", header: "Dealer", aliases: ["Dealer Name"], required: true },
  { key: "type", header: "Type", aliases: ["Entry Type", "Txn Type"], required: true },
  { key: "amount", header: "Amount", required: true },
  { key: "fuel_station", header: "Fuel Station", aliases: ["Station", "Pump", "Petrol Pump"] },
  { key: "fuel_litres", header: "Fuel Litres", aliases: ["Litres"] },
  { key: "reference", header: "Reference", aliases: ["Ref", "Reference No", "Vehicle", "Vehicle No"] },
  { key: "notes", header: "Notes", aliases: ["Remarks"] },
]

export const PUMP_PAYMENT_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "pump", header: "Pump", aliases: ["Petrol Pump", "Fuel Station", "Station"], required: true },
  { key: "date", header: "Date", aliases: ["Pay Date", "Payment Date"], required: true, kind: "date" },
  { key: "amount", header: "Amount", aliases: ["Paid", "Amount Paid"], required: true },
  { key: "type", header: "Type" },
  { key: "reference", header: "Reference", aliases: ["Ref", "Reference No", "UPI", "Cheque No"] },
  { key: "notes", header: "Notes", aliases: ["Remarks"] },
]

// ---- Cell parsing ----------------------------------------------------------

/** Compares names ignoring case, spacing and punctuation: "UP 65 dt-2821". */
export const normKey = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")

export const matchesColumn = (header: unknown, column: ImportColumn) => {
  const key = normKey(header)
  return (
    !!key && [column.header, ...(column.aliases ?? [])].some((h) => normKey(h) === key)
  )
}

const isBlank = (cell: ImportCell | undefined) =>
  cell === null || cell === undefined || String(cell).trim() === ""

export const cleanText = (cell: ImportCell | undefined) =>
  isBlank(cell) ? "" : String(cell).trim().replace(/\s+/g, " ")

/** Accepts sheet styles like "₹ 1,25,000.50", "Rs. 500" and "5000/-". */
export function parseAmount(cell: ImportCell | undefined): number | null {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null
  const cleaned = cleanText(cell)
    .replace(/^(₹|rs\.?|inr)\s*/i, "")
    .replace(/\/-$/, "")
    .replace(/,/g, "")
    .trim()
  if (!cleaned || !/^-?\d*\.?\d+$/.test(cleaned)) return null
  return Number(cleaned)
}

const pad = (n: number) => String(n).padStart(2, "0")

function isoDate(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2100) return null
  const d = new Date(Date.UTC(year, month - 1, day))
  const real = d.getUTCMonth() === month - 1 && d.getUTCDate() === day
  return real ? `${year}-${pad(month)}-${pad(day)}` : null
}

const MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ")

const monthNumber = (name: string) => MONTHS.indexOf(name.toLowerCase().slice(0, 3)) + 1

const fullYear = (y: string) => Number(y.length === 2 ? `20${y}` : y)

/**
 * Parses a date cell to yyyy-mm-dd. Typed dates are read day-first (the Indian
 * convention); a date that only works month-first, like 10/25/2026, is refused
 * rather than guessed at, since a wrong date would land in the wrong month.
 */
export function parseDate(cell: ImportCell | undefined): string | null {
  const value = cleanText(cell)
  let m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/)
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]))
  m = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})$/)
  if (m) return isoDate(fullYear(m[3]), Number(m[2]), Number(m[1]))
  m = value.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s/.-]*([a-z]{3,9})[\s/.,'-]*(\d{4}|\d{2})$/i)
  if (m && monthNumber(m[2])) return isoDate(fullYear(m[3]), monthNumber(m[2]), Number(m[1]))
  m = value.match(/^([a-z]{3,9})[\s.]*(\d{1,2}),?\s*(\d{4})$/i)
  if (m && monthNumber(m[1])) return isoDate(Number(m[3]), monthNumber(m[1]), Number(m[2]))
  return null
}

/** Parses a salary month ("Oct 2026", "10/2026", a full date…) to its 1st. */
export function parseMonth(cell: ImportCell | undefined): string | null {
  const value = cleanText(cell)
  let m = value.match(/^(\d{4})-(\d{1,2})$/)
  if (m) return isoDate(Number(m[1]), Number(m[2]), 1)
  m = value.match(/^(\d{1,2})[/.-](\d{4})$/)
  if (m) return isoDate(Number(m[2]), Number(m[1]), 1)
  m = value.match(/^([a-z]{3,9})[\s/.,'-]*(\d{4}|\d{2})$/i)
  if (m && monthNumber(m[1])) return isoDate(fullYear(m[2]), monthNumber(m[1]), 1)
  const date = parseDate(value)
  return date ? `${date.slice(0, 7)}-01` : null
}

const fromTable =
  <T>(table: Record<string, T>) =>
  (cell: ImportCell | undefined): T | null =>
    table[normKey(cell)] ?? null

export const parseTruckType = fromTable<TruckType>({
  company: "company",
  companyowned: "company",
  own: "company",
  owned: "company",
  rented: "rented",
  rent: "rented",
  hired: "rented",
  hire: "rented",
})

export const parseDispatchStatus = fromTable<DispatchStatus>({
  pending: "pending",
  intransit: "in_transit",
  transit: "in_transit",
  completed: "completed",
  complete: "completed",
  delivered: "completed",
  done: "completed",
  cancelled: "cancelled",
  canceled: "cancelled",
})

export const parsePersonType = fromTable<PersonType>({
  driver: "driver",
  staff: "staff",
  employee: "staff",
})

export const parseTxnType = fromTable<DealerTxnType>({
  due: "due",
  dues: "due",
  dueadded: "due",
  rent: "due",
  fuel: "fuel_offset",
  fueloffset: "fuel_offset",
  fueltaken: "fuel_offset",
  diesel: "fuel_offset",
  payment: "payment",
  paid: "payment",
  cash: "payment",
  cashpaid: "payment",
  bank: "payment",
  upi: "payment",
  cheque: "payment",
})

export const parseYesNo = fromTable<boolean>({
  yes: true,
  y: true,
  true: true,
  paid: true,
  no: false,
  n: false,
  false: false,
  pending: false,
  unpaid: false,
})

/** Reads one row's cells, collecting problems instead of stopping at the first. */
export function readRow(cells: ImportRow["cells"]) {
  const errors: string[] = []
  return {
    errors,
    text: (key: string) => cleanText(cells[key]),
    has: (key: string) => !isBlank(cells[key]),
    num(key: string, label: string, { allowNegative = false } = {}) {
      if (isBlank(cells[key])) return 0
      const value = parseAmount(cells[key])
      if (value === null) {
        errors.push(`${label}: "${cleanText(cells[key])}" is not a number`)
        return 0
      }
      if (value < 0 && !allowNegative) {
        errors.push(`${label} can't be negative`)
        return 0
      }
      return value
    },
    /** A bad date is kept as typed so the row still reports other problems. */
    date(key: string, label: string) {
      if (isBlank(cells[key])) return ""
      const value = parseDate(cells[key])
      if (!value)
        errors.push(`${label}: "${cleanText(cells[key])}" is not a valid date (use dd/mm/yyyy)`)
      return value ?? cleanText(cells[key])
    },
  }
}

/** Flags a row that matches an existing record, or an earlier row of the sheet. */
export function duplicateTracker(existing: Iterable<string>) {
  const inPortal = new Set(existing)
  const inSheet = new Map<string, number>()
  return (key: string, row: number): string | null => {
    if (inPortal.has(key)) return "Already in the portal"
    const first = inSheet.get(key)
    if (first !== undefined) return `Same as row ${first} of this sheet`
    inSheet.set(key, row)
    return null
  }
}

export function resolveBranch(
  cell: string,
  ctx: {
    isAdmin: boolean
    userBranchId: string | null
    branches: { id: string; name: string }[]
    /** Branch implied by the row itself, e.g. the only truck with that number. */
    inferred?: string | null
    fallback?: string
  }
): { id: string; error?: undefined } | { id?: undefined; error: string } {
  const named = cell
    ? ctx.branches.find((b) => normKey(b.name) === normKey(cell))
    : null
  if (cell && !named) return { error: `Unknown branch "${cell}"` }

  if (!ctx.isAdmin) {
    if (!ctx.userBranchId) return { error: "Your account has no branch" }
    if (named && named.id !== ctx.userBranchId)
      return { error: `You can only upload for your own branch, not ${named.name}` }
    return { id: ctx.userBranchId }
  }

  const id = named?.id ?? ctx.inferred ?? ctx.fallback
  return id
    ? { id }
    : { error: "Branch is missing: fill the Branch column or pick one above" }
}

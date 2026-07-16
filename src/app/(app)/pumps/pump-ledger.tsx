"use client"

import { type ColumnDef } from "@tanstack/react-table"
import {
  Banknote,
  Fuel,
  Handshake,
  IndianRupee,
  Pencil,
  Plus,
  Trash2,
  Truck,
} from "lucide-react"
import { DataTable } from "@/components/data-table"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { ExportButton, type ExportColumn } from "@/components/export-button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { formatCurrency, formatDate, formatNumber } from "@/lib/format"
import type {
  DealerTransaction,
  Dispatch,
  FuelStation,
  FuelStationPayment,
} from "@/lib/types"
import { PumpPaymentDialog } from "./payment-form"
import { deletePumpPayment } from "./actions"

/** The dispatch fields the pumps page needs for a fill-up row. */
export type PumpFillUp = Pick<
  Dispatch,
  | "id"
  | "dispatch_date"
  | "vehicle_number"
  | "driver_name"
  | "from_location"
  | "to_location"
  | "fuel_litres"
  | "fuel_cost"
  | "fuel_station"
>

type EntryKind = "truck" | "dealer" | "payment"

/** One row in a pump's ledger: a fill-up, dealer fuel, or a payment. */
type PumpEntry = {
  key: string
  date: string
  kind: EntryKind
  detail: string
  sub: string | null
  litres: number | null
  amount: number
  payment: FuelStationPayment | null
}

const ENTRY_LABELS: Record<EntryKind, string> = {
  truck: "Truck fill-up",
  dealer: "Dealer fuel",
  payment: "Payment",
}

const ENTRY_BADGE_CLASSES: Record<EntryKind, string> = {
  truck:
    "border-sky-600/30 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  dealer:
    "border-amber-600/30 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  payment:
    "border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
}

type PumpTotals = {
  truckAmount: number
  dealerAmount: number
  paid: number
  litres: number
  toPay: number
}

export function PumpLedger({
  stations,
  fillUps,
  dealerFuel,
  payments,
}: {
  stations: FuelStation[]
  fillUps: PumpFillUp[]
  dealerFuel: DealerTransaction[]
  payments: FuelStationPayment[]
}) {
  // Pump sections: active pumps from the master list, plus any station name
  // that appears in the data but is missing from the list (so nothing hides).
  const masterNames = stations
    .filter((s) => s.status === "active")
    .map((s) => s.name)
  const dataNames = new Set(
    [
      ...fillUps.map((f) => f.fuel_station),
      ...dealerFuel.map((t) => t.fuel_station),
      ...payments.map((p) => p.fuel_station),
    ].filter((n): n is string => !!n)
  )
  const extraNames = [...dataNames]
    .filter((n) => !masterNames.includes(n))
    .sort()
  const pumpNames = [...masterNames, ...extraNames]

  // Per-pump ledger entries, newest first.
  const entriesByPump = new Map<string, PumpEntry[]>()
  const push = (station: string | null, entry: PumpEntry) => {
    if (!station) return
    const list = entriesByPump.get(station) ?? []
    list.push(entry)
    entriesByPump.set(station, list)
  }

  for (const f of fillUps) {
    push(f.fuel_station, {
      key: `t-${f.id}`,
      date: f.dispatch_date,
      kind: "truck",
      detail: f.vehicle_number,
      sub: `${f.from_location} → ${f.to_location}`,
      litres: Number(f.fuel_litres) || null,
      amount: Number(f.fuel_cost),
      payment: null,
    })
  }
  for (const t of dealerFuel) {
    push(t.fuel_station, {
      key: `d-${t.id}`,
      date: t.txn_date,
      kind: "dealer",
      detail: t.dealers?.name ?? "Dealer",
      sub: t.reference,
      litres: t.fuel_litres ? Number(t.fuel_litres) : null,
      amount: Number(t.amount),
      payment: null,
    })
  }
  for (const p of payments) {
    push(p.fuel_station, {
      key: `p-${p.id}`,
      date: p.pay_date,
      kind: "payment",
      detail: p.reference || "Cash / bank payment",
      sub: p.notes,
      litres: null,
      amount: Number(p.amount),
      payment: p,
    })
  }
  for (const list of entriesByPump.values()) {
    list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }

  const totalsFor = (name: string): PumpTotals => {
    const entries = entriesByPump.get(name) ?? []
    const totals = entries.reduce(
      (agg, e) => {
        if (e.kind === "payment") agg.paid += e.amount
        else {
          if (e.kind === "truck") agg.truckAmount += e.amount
          else agg.dealerAmount += e.amount
          agg.litres += e.litres ?? 0
        }
        return agg
      },
      { truckAmount: 0, dealerAmount: 0, paid: 0, litres: 0, toPay: 0 }
    )
    totals.toPay = totals.truckAmount + totals.dealerAmount - totals.paid
    return totals
  }

  const pumpTotals = new Map(pumpNames.map((n) => [n, totalsFor(n)]))
  const overall = [...pumpTotals.values()].reduce(
    (agg, t) => ({
      truckAmount: agg.truckAmount + t.truckAmount,
      dealerAmount: agg.dealerAmount + t.dealerAmount,
      paid: agg.paid + t.paid,
      litres: agg.litres + t.litres,
      toPay: agg.toPay + (t.toPay > 0 ? t.toPay : 0),
    }),
    { truckAmount: 0, dealerAmount: 0, paid: 0, litres: 0, toPay: 0 }
  )

  const columns: ColumnDef<PumpEntry>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      accessorKey: "kind",
      header: "Type",
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={ENTRY_BADGE_CLASSES[row.original.kind]}
        >
          {ENTRY_LABELS[row.original.kind]}
        </Badge>
      ),
    },
    {
      id: "detail",
      header: "Details",
      accessorFn: (e) => [e.detail, e.sub].filter(Boolean).join(" "),
      cell: ({ row }) => (
        <div className="leading-tight">
          <div className="font-medium">{row.original.detail}</div>
          {row.original.sub ? (
            <div className="text-muted-foreground text-xs">
              {row.original.sub}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "litres",
      header: "Fuel",
      cell: ({ row }) =>
        row.original.litres
          ? `${formatNumber(row.original.litres)} L`
          : "—",
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => {
        const e = row.original
        const isPayment = e.kind === "payment"
        return (
          <span
            className={
              isPayment
                ? "font-semibold text-emerald-600 dark:text-emerald-400"
                : "font-semibold"
            }
          >
            {isPayment ? "−" : "+"} {formatCurrency(e.amount)}
          </span>
        )
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original.payment
        // Fill-ups and dealer fuel are edited on their own pages.
        if (!p) return null
        return (
          <div className="flex justify-end gap-1">
            <PumpPaymentDialog
              fuelStations={pumpNames}
              initial={p}
              trigger={
                <Button variant="ghost" size="icon-sm">
                  <Pencil />
                  <span className="sr-only">Edit</span>
                </Button>
              }
            />
            <ConfirmDialog
              title="Delete pump payment?"
              successMessage="Payment deleted"
              onConfirm={() => deletePumpPayment(p.id)}
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
        )
      },
    },
  ]

  const exportColumns: ExportColumn<PumpEntry>[] = [
    { header: "Date", value: (e) => e.date },
    { header: "Type", value: (e) => ENTRY_LABELS[e.kind] },
    { header: "Details", value: (e) => e.detail },
    { header: "Reference / Route", value: (e) => e.sub ?? "" },
    { header: "Fuel Litres", value: (e) => e.litres ?? 0 },
    {
      header: "Amount",
      value: (e) => (e.kind === "payment" ? -e.amount : e.amount),
    },
  ]

  if (pumpNames.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No fuel stations yet. Add your affiliated pumps from the Fuel Stations
        master list first.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="To pay (all pumps)"
          value={formatCurrency(overall.toPay)}
          icon={IndianRupee}
          hint={`${pumpNames.length} pump${pumpNames.length === 1 ? "" : "s"}`}
          accent="bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
        />
        <StatCard
          title="Truck fill-ups"
          value={formatCurrency(overall.truckAmount)}
          icon={Truck}
          hint={`${formatNumber(overall.litres)} L taken in total`}
          accent="bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
        />
        <StatCard
          title="Dealer fuel at pumps"
          value={formatCurrency(overall.dealerAmount)}
          icon={Handshake}
          hint="Billed to us, offsets dealer dues"
          accent="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
        />
        <StatCard
          title="Paid to pumps"
          value={formatCurrency(overall.paid)}
          icon={Banknote}
          accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
        />
      </div>

      <Tabs defaultValue={pumpNames[0]}>
        <TabsList>
          {pumpNames.map((name) => (
            <TabsTrigger key={name} value={name}>
              {name}
            </TabsTrigger>
          ))}
        </TabsList>

        {pumpNames.map((name) => {
          const totals = pumpTotals.get(name)!
          const entries = entriesByPump.get(name) ?? []
          return (
            <TabsContent key={name} value={name} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Fuel taken"
                  value={`${formatNumber(totals.litres)} L`}
                  icon={Fuel}
                  accent="bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
                />
                <StatCard
                  title="Fuel bill"
                  value={formatCurrency(totals.truckAmount + totals.dealerAmount)}
                  icon={IndianRupee}
                  hint={`Trucks ${formatCurrency(totals.truckAmount)} · Dealers ${formatCurrency(totals.dealerAmount)}`}
                  accent="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                />
                <StatCard
                  title="Paid"
                  value={formatCurrency(totals.paid)}
                  icon={Banknote}
                  accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                />
                <StatCard
                  title="To pay"
                  value={
                    totals.toPay < 0
                      ? `Advance ${formatCurrency(-totals.toPay)}`
                      : formatCurrency(totals.toPay)
                  }
                  icon={IndianRupee}
                  accent={
                    totals.toPay > 0
                      ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                      : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                  }
                />
              </div>

              <DataTable
                columns={columns}
                data={entries}
                searchPlaceholder="Search vehicle, dealer, reference…"
                emptyMessage="No fuel taken or payments recorded at this pump yet."
                toolbar={
                  <>
                    <ExportButton
                      rows={entries}
                      columns={exportColumns}
                      filename={`pump-${name.toLowerCase().replace(/\s+/g, "-")}`}
                    />
                    <PumpPaymentDialog
                      fuelStations={pumpNames}
                      defaultStation={name}
                      trigger={
                        <Button>
                          <Plus /> Record payment
                        </Button>
                      }
                    />
                  </>
                }
              />
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}

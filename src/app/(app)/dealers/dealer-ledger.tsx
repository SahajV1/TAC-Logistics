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
import { DEALER_TXN_TYPE_LABELS } from "@/lib/constants"
import type { Dealer, DealerTransaction, DealerTxnType } from "@/lib/types"
import { DealerFormDialog } from "./dealer-form"
import { TransactionFormDialog } from "./transaction-form"
import { deleteDealer, deleteDealerTransaction } from "./actions"

const TXN_BADGE_CLASSES: Record<DealerTxnType, string> = {
  due: "border-amber-600/30 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  fuel_offset:
    "border-sky-600/30 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  payment:
    "border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
}

type DealerRow = Dealer & {
  due: number
  fuel: number
  paid: number
  balance: number
}

export function DealerLedger({
  dealers,
  transactions,
  fuelStations,
}: {
  dealers: Dealer[]
  transactions: DealerTransaction[]
  fuelStations: string[]
}) {
  // Per-dealer aggregates from the ledger.
  const totals = new Map<string, { due: number; fuel: number; paid: number }>()
  for (const t of transactions) {
    const agg = totals.get(t.dealer_id) ?? { due: 0, fuel: 0, paid: 0 }
    const amount = Number(t.amount)
    if (t.txn_type === "due") agg.due += amount
    else if (t.txn_type === "fuel_offset") agg.fuel += amount
    else agg.paid += amount
    totals.set(t.dealer_id, agg)
  }

  const rows: DealerRow[] = dealers.map((d) => {
    const agg = totals.get(d.id) ?? { due: 0, fuel: 0, paid: 0 }
    return { ...d, ...agg, balance: agg.due - agg.fuel - agg.paid }
  })

  const totalDue = rows.reduce((sum, r) => sum + r.due, 0)
  const totalFuel = rows.reduce((sum, r) => sum + r.fuel, 0)
  const totalPaid = rows.reduce((sum, r) => sum + r.paid, 0)
  const outstanding = rows.reduce(
    (sum, r) => sum + (r.balance > 0 ? r.balance : 0),
    0
  )
  const dealersWithDues = rows.filter((r) => r.balance > 0).length

  const dealerPicks = dealers.map(({ id, name, status }) => ({
    id,
    name,
    status,
  }))

  const txnFormProps = { dealers: dealerPicks, fuelStations }

  const dealerColumns: ColumnDef<DealerRow>[] = [
    {
      accessorKey: "name",
      header: "Dealer",
      cell: ({ row }) => (
        <div className="leading-tight">
          <div className="font-medium">{row.original.name}</div>
          <div className="text-muted-foreground text-xs">
            {row.original.phone ?? "—"}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "due",
      header: "Dues added",
      cell: ({ row }) => formatCurrency(row.original.due),
    },
    {
      accessorKey: "fuel",
      header: "Fuel offset",
      cell: ({ row }) => formatCurrency(row.original.fuel),
    },
    {
      accessorKey: "paid",
      header: "Cash paid",
      cell: ({ row }) => formatCurrency(row.original.paid),
    },
    {
      accessorKey: "balance",
      header: "Outstanding",
      cell: ({ row }) => {
        const b = row.original.balance
        if (b > 0)
          return (
            <span className="text-destructive font-semibold">
              {formatCurrency(b)}
            </span>
          )
        if (b < 0)
          return (
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              Advance {formatCurrency(-b)}
            </span>
          )
        return <Badge variant="outline">Settled</Badge>
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={row.original.status === "active" ? "outline" : "secondary"}
          className="capitalize"
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <TransactionFormDialog
            {...txnFormProps}
            defaultDealerId={row.original.id}
            trigger={
              <Button variant="outline" size="sm">
                <Plus /> Entry
              </Button>
            }
          />
          <DealerFormDialog
            initial={row.original}
            trigger={
              <Button variant="ghost" size="icon-sm">
                <Pencil />
                <span className="sr-only">Edit</span>
              </Button>
            }
          />
          <ConfirmDialog
            title="Delete dealer?"
            description="All ledger entries of this dealer will be deleted too."
            successMessage="Dealer deleted"
            onConfirm={() => deleteDealer(row.original.id)}
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

  const txnColumns: ColumnDef<DealerTransaction>[] = [
    {
      accessorKey: "txn_date",
      header: "Date",
      cell: ({ row }) => formatDate(row.original.txn_date),
    },
    {
      id: "dealer",
      header: "Dealer",
      accessorFn: (t) => t.dealers?.name ?? "",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.dealers?.name ?? "—"}</span>
      ),
    },
    {
      accessorKey: "txn_type",
      header: "Type",
      cell: ({ row }) => (
        <div className="space-y-1">
          <Badge
            variant="outline"
            className={TXN_BADGE_CLASSES[row.original.txn_type]}
          >
            {DEALER_TXN_TYPE_LABELS[row.original.txn_type]}
          </Badge>
          {row.original.dispatch_id ? (
            <div className="text-muted-foreground text-xs">From dispatch</div>
          ) : null}
        </div>
      ),
    },
    {
      id: "details",
      header: "Details",
      accessorFn: (t) =>
        [t.fuel_station, t.reference].filter(Boolean).join(" "),
      cell: ({ row }) => {
        const t = row.original
        if (t.txn_type === "fuel_offset")
          return (
            <div className="leading-tight">
              <div>{t.fuel_station ?? "—"}</div>
              {t.fuel_litres ? (
                <div className="text-muted-foreground text-xs">
                  {formatNumber(Number(t.fuel_litres))} L
                </div>
              ) : null}
            </div>
          )
        return t.reference ?? "—"
      },
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => {
        const t = row.original
        const isDue = t.txn_type === "due"
        return (
          <span
            className={
              isDue
                ? "font-semibold"
                : "font-semibold text-emerald-600 dark:text-emerald-400"
            }
          >
            {isDue ? "+" : "−"} {formatCurrency(Number(t.amount))}
          </span>
        )
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.dispatch_id ? (
          <p className="text-muted-foreground text-right text-xs">
            Edit the dispatch to change this
          </p>
        ) : (
          <div className="flex justify-end gap-1">
            <TransactionFormDialog
              {...txnFormProps}
              initial={row.original}
              trigger={
                <Button variant="ghost" size="icon-sm">
                  <Pencil />
                  <span className="sr-only">Edit</span>
                </Button>
              }
            />
            <ConfirmDialog
              title="Delete ledger entry?"
              successMessage="Entry deleted"
              onConfirm={() => deleteDealerTransaction(row.original.id)}
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

  const dealerExportColumns: ExportColumn<DealerRow>[] = [
    { header: "Dealer", value: (r) => r.name },
    { header: "Phone", value: (r) => r.phone ?? "" },
    { header: "Dues Added", value: (r) => r.due },
    { header: "Fuel Offset", value: (r) => r.fuel },
    { header: "Cash Paid", value: (r) => r.paid },
    { header: "Outstanding", value: (r) => r.balance },
    { header: "Status", value: (r) => r.status },
    { header: "Notes", value: (r) => r.notes ?? "" },
  ]

  const txnExportColumns: ExportColumn<DealerTransaction>[] = [
    { header: "Date", value: (t) => t.txn_date },
    { header: "Dealer", value: (t) => t.dealers?.name ?? "" },
    { header: "Type", value: (t) => DEALER_TXN_TYPE_LABELS[t.txn_type] },
    { header: "Amount", value: (t) => Number(t.amount) },
    { header: "Fuel Station", value: (t) => t.fuel_station ?? "" },
    { header: "Fuel Litres", value: (t) => Number(t.fuel_litres ?? 0) },
    { header: "Reference", value: (t) => t.reference ?? "" },
    { header: "Notes", value: (t) => t.notes ?? "" },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Outstanding to dealers"
          value={formatCurrency(outstanding)}
          icon={IndianRupee}
          hint={`${dealersWithDues} dealer${dealersWithDues === 1 ? "" : "s"} with dues`}
          accent="bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
        />
        <StatCard
          title="Total dues added"
          value={formatCurrency(totalDue)}
          icon={Handshake}
          accent="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
        />
        <StatCard
          title="Settled via fuel"
          value={formatCurrency(totalFuel)}
          icon={Fuel}
          hint="Fuel taken at our pumps"
          accent="bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
        />
        <StatCard
          title="Paid in cash / bank"
          value={formatCurrency(totalPaid)}
          icon={Banknote}
          accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
        />
      </div>

      <Tabs defaultValue="balances">
        <TabsList>
          <TabsTrigger value="balances">
            Dealer Balances ({dealers.length})
          </TabsTrigger>
          <TabsTrigger value="ledger">
            Ledger Entries ({transactions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="balances">
          <DataTable
            columns={dealerColumns}
            data={rows}
            searchPlaceholder="Search dealer…"
            emptyMessage="No dealers yet. Add the dealers you rent trucks from."
            toolbar={
              <>
                <ExportButton
                  rows={rows}
                  columns={dealerExportColumns}
                  filename="dealer-balances"
                />
                <DealerFormDialog
                  trigger={
                    <Button>
                      <Plus /> Add dealer
                    </Button>
                  }
                />
              </>
            }
          />
        </TabsContent>

        <TabsContent value="ledger">
          <DataTable
            columns={txnColumns}
            data={transactions}
            searchPlaceholder="Search dealer, station…"
            emptyMessage="No ledger entries yet."
            toolbar={
              <>
                <ExportButton
                  rows={transactions}
                  columns={txnExportColumns}
                  filename="dealer-ledger"
                />
                <TransactionFormDialog
                  {...txnFormProps}
                  trigger={
                    <Button>
                      <Plus /> Record entry
                    </Button>
                  }
                />
              </>
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

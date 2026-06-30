"use client"

import { type ColumnDef } from "@tanstack/react-table"
import { Fuel, HandCoins, Route, Wallet } from "lucide-react"
import { DataTable } from "@/components/data-table"
import { StatCard } from "@/components/stat-card"
import { ExportButton, type ExportColumn } from "@/components/export-button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatCurrency, formatMonth } from "@/lib/format"

export type MonthRow = {
  month: string
  trips: number
  fuel: number
  rent: number
  advance: number
  toll: number
  misc: number
  total: number
}

export type BranchRow = {
  branch: string
  trips: number
  fuel: number
  rent: number
  total: number
}

export function ReportView({
  monthly,
  branchly,
  totals,
  isAdmin,
}: {
  monthly: MonthRow[]
  branchly: BranchRow[]
  totals: { trips: number; fuel: number; rent: number; advance: number; misc: number }
  isAdmin: boolean
}) {
  const monthColumns: ColumnDef<MonthRow>[] = [
    {
      accessorKey: "month",
      header: "Month",
      cell: ({ row }) => formatMonth(`${row.original.month}-01`),
    },
    { accessorKey: "trips", header: "Trips" },
    {
      accessorKey: "fuel",
      header: "Fuel",
      cell: ({ row }) => formatCurrency(row.original.fuel),
    },
    {
      accessorKey: "rent",
      header: "Rent",
      cell: ({ row }) => formatCurrency(row.original.rent),
    },
    {
      accessorKey: "advance",
      header: "Advance",
      cell: ({ row }) => formatCurrency(row.original.advance),
    },
    {
      accessorKey: "toll",
      header: "Toll",
      cell: ({ row }) => formatCurrency(row.original.toll),
    },
    {
      accessorKey: "misc",
      header: "Misc",
      cell: ({ row }) => formatCurrency(row.original.misc),
    },
    {
      accessorKey: "total",
      header: "Total",
      cell: ({ row }) => (
        <span className="font-semibold">{formatCurrency(row.original.total)}</span>
      ),
    },
  ]

  const monthExport: ExportColumn<MonthRow>[] = [
    { header: "Month", value: (m) => m.month },
    { header: "Trips", value: (m) => m.trips },
    { header: "Fuel", value: (m) => m.fuel },
    { header: "Rent", value: (m) => m.rent },
    { header: "Advance", value: (m) => m.advance },
    { header: "Toll", value: (m) => m.toll },
    { header: "Misc", value: (m) => m.misc },
    { header: "Total", value: (m) => m.total },
  ]

  const branchColumns: ColumnDef<BranchRow>[] = [
    { accessorKey: "branch", header: "Branch" },
    { accessorKey: "trips", header: "Trips" },
    {
      accessorKey: "fuel",
      header: "Fuel",
      cell: ({ row }) => formatCurrency(row.original.fuel),
    },
    {
      accessorKey: "rent",
      header: "Rent",
      cell: ({ row }) => formatCurrency(row.original.rent),
    },
    {
      accessorKey: "total",
      header: "Total",
      cell: ({ row }) => (
        <span className="font-semibold">{formatCurrency(row.original.total)}</span>
      ),
    },
  ]

  const branchExport: ExportColumn<BranchRow>[] = [
    { header: "Branch", value: (b) => b.branch },
    { header: "Trips", value: (b) => b.trips },
    { header: "Fuel", value: (b) => b.fuel },
    { header: "Rent", value: (b) => b.rent },
    { header: "Total", value: (b) => b.total },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total trips" value={totals.trips} icon={Route} />
        <StatCard
          title="Total fuel"
          value={formatCurrency(totals.fuel)}
          icon={Fuel}
          accent="bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
        />
        <StatCard
          title="Total rent"
          value={formatCurrency(totals.rent)}
          icon={HandCoins}
          accent="bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400"
        />
        <StatCard
          title="Advance + misc"
          value={formatCurrency(totals.advance + totals.misc)}
          icon={Wallet}
        />
      </div>

      {isAdmin ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Branch-wise summary</CardTitle>
              <CardDescription>All-time totals per branch</CardDescription>
            </div>
            <ExportButton
              rows={branchly}
              columns={branchExport}
              filename="branch-report"
            />
          </CardHeader>
          <CardContent>
            <DataTable
              columns={branchColumns}
              data={branchly}
              searchPlaceholder="Search branch…"
              emptyMessage="No data."
              pageSize={5}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Monthly summary</CardTitle>
            <CardDescription>Trips and expenses by month</CardDescription>
          </div>
          <ExportButton
            rows={monthly}
            columns={monthExport}
            filename="monthly-report"
          />
        </CardHeader>
        <CardContent>
          <DataTable
            columns={monthColumns}
            data={monthly}
            searchPlaceholder="Search month…"
            emptyMessage="No dispatches recorded yet."
          />
        </CardContent>
      </Card>
    </div>
  )
}

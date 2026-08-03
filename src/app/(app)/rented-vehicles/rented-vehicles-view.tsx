"use client"

import { type ColumnDef } from "@tanstack/react-table"
import { Handshake, IndianRupee, Route, Truck } from "lucide-react"
import { DataTable } from "@/components/data-table"
import { StatCard } from "@/components/stat-card"
import { Badge } from "@/components/ui/badge"
import { ExportButton, type ExportColumn } from "@/components/export-button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { formatCurrency, formatDate } from "@/lib/format"
import { DISPATCH_STATUS_LABELS } from "@/lib/constants"
import type { Dispatch, DispatchStatus } from "@/lib/types"

export type RentedTrip = Pick<
  Dispatch,
  | "id"
  | "dispatch_date"
  | "vehicle_number"
  | "driver_name"
  | "from_location"
  | "to_location"
  | "rent_amount"
  | "owner_details"
  | "dealer_id"
  | "status"
  | "dealers"
>

export type DealerOption = { id: string; name: string }

const STATUS_VARIANT: Record<
  DispatchStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "secondary",
  in_transit: "default",
  completed: "outline",
  cancelled: "destructive",
}

const UNLINKED_KEY = "__unlinked__"

type SummaryRow = {
  key: string
  name: string
  linked: boolean
  trucks: number
  trips: number
  totalCost: number
  avgCost: number
}

function summarize(key: string, name: string, linked: boolean, trips: RentedTrip[]): SummaryRow {
  const trucks = new Set(trips.map((t) => t.vehicle_number)).size
  const totalCost = trips.reduce((sum, t) => sum + Number(t.rent_amount), 0)
  return {
    key,
    name,
    linked,
    trucks,
    trips: trips.length,
    totalCost,
    avgCost: trips.length ? totalCost / trips.length : 0,
  }
}

export function RentedVehiclesView({
  dealers,
  trips,
}: {
  dealers: DealerOption[]
  trips: RentedTrip[]
}) {
  const tripsByDealer = new Map<string, RentedTrip[]>()
  const unlinked: RentedTrip[] = []
  for (const t of trips) {
    if (t.dealer_id) {
      const list = tripsByDealer.get(t.dealer_id) ?? []
      list.push(t)
      tripsByDealer.set(t.dealer_id, list)
    } else {
      unlinked.push(t)
    }
  }

  // Dealer list: active dealers from the master list, plus any dealer that
  // shows up in the data but isn't active any more (so nothing hides).
  const dataDealerIds = new Set(tripsByDealer.keys())
  const extraDealers = [...dataDealerIds]
    .filter((id) => !dealers.some((d) => d.id === id))
    .map((id) => ({
      id,
      name: tripsByDealer.get(id)?.[0]?.dealers?.name ?? "Dealer",
    }))
  const dealerList = [...dealers, ...extraDealers]

  const tripsFor = (key: string) =>
    key === UNLINKED_KEY ? unlinked : (tripsByDealer.get(key) ?? [])

  const summaryRows: SummaryRow[] = dealerList
    .map((d) => summarize(d.id, d.name, true, tripsByDealer.get(d.id) ?? []))
    .sort((a, b) => b.totalCost - a.totalCost)
  if (unlinked.length > 0) {
    summaryRows.push(
      summarize(UNLINKED_KEY, "Not linked to a dealer", false, unlinked)
    )
  }

  const totalTrips = trips.length
  const totalCost = trips.reduce((sum, t) => sum + Number(t.rent_amount), 0)
  const totalTrucks = new Set(trips.map((t) => t.vehicle_number)).size
  const dealersUsed = dataDealerIds.size

  const summaryColumns: ColumnDef<SummaryRow>[] = [
    {
      accessorKey: "name",
      header: "Dealer",
      cell: ({ row }) =>
        row.original.linked ? (
          <span className="font-medium">{row.original.name}</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.name}</span>
            <Badge variant="outline" className="text-muted-foreground">
              Legacy
            </Badge>
          </div>
        ),
    },
    {
      accessorKey: "trucks",
      header: "Trucks rented",
      cell: ({ row }) => row.original.trucks,
    },
    {
      accessorKey: "trips",
      header: "Trips",
      cell: ({ row }) => row.original.trips,
    },
    {
      accessorKey: "totalCost",
      header: "Total rent cost",
      cell: ({ row }) => (
        <span className="font-semibold">
          {formatCurrency(row.original.totalCost)}
        </span>
      ),
    },
    {
      accessorKey: "avgCost",
      header: "Avg. / trip",
      cell: ({ row }) => formatCurrency(row.original.avgCost),
    },
  ]

  const summaryExportColumns: ExportColumn<SummaryRow>[] = [
    { header: "Dealer", value: (r) => r.name },
    { header: "Trucks Rented", value: (r) => r.trucks },
    { header: "Trips", value: (r) => r.trips },
    { header: "Total Rent Cost", value: (r) => r.totalCost },
    { header: "Avg Per Trip", value: (r) => r.avgCost },
  ]

  const tripColumns: ColumnDef<RentedTrip>[] = [
    {
      accessorKey: "dispatch_date",
      header: "Date",
      cell: ({ row }) => formatDate(row.original.dispatch_date),
    },
    {
      id: "vehicle",
      header: "Vehicle",
      accessorFn: (t) => t.vehicle_number,
      cell: ({ row }) => (
        <div className="leading-tight">
          <div className="font-medium">{row.original.vehicle_number}</div>
          {row.original.owner_details ? (
            <div className="text-muted-foreground text-xs">
              {row.original.owner_details}
            </div>
          ) : null}
        </div>
      ),
    },
    { accessorKey: "driver_name", header: "Driver" },
    {
      id: "route",
      header: "Route",
      accessorFn: (t) => `${t.from_location} → ${t.to_location}`,
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {row.original.from_location}
          <span className="text-muted-foreground"> → </span>
          {row.original.to_location}
        </span>
      ),
    },
    {
      accessorKey: "rent_amount",
      header: "Rent amount",
      cell: ({ row }) => (
        <span className="font-semibold">
          {formatCurrency(Number(row.original.rent_amount))}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status]}>
          {DISPATCH_STATUS_LABELS[row.original.status]}
        </Badge>
      ),
    },
  ]

  const tripExportColumns: ExportColumn<RentedTrip>[] = [
    { header: "Date", value: (t) => t.dispatch_date },
    { header: "Vehicle", value: (t) => t.vehicle_number },
    { header: "Owner Details", value: (t) => t.owner_details ?? "" },
    { header: "Driver", value: (t) => t.driver_name },
    { header: "From", value: (t) => t.from_location },
    { header: "To", value: (t) => t.to_location },
    { header: "Rent Amount", value: (t) => Number(t.rent_amount) },
    { header: "Status", value: (t) => DISPATCH_STATUS_LABELS[t.status] },
  ]

  if (dealerList.length === 0 && unlinked.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No dealers yet. Add the dealers you rent trucks from on the Dealer
        Ledger page, then pick one whenever a dispatch is marked &quot;Rented&quot;.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Rental trips"
          value={totalTrips}
          icon={Route}
          accent="bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
        />
        <StatCard
          title="Trucks rented"
          value={totalTrucks}
          icon={Truck}
          accent="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
        />
        <StatCard
          title="Total rent cost"
          value={formatCurrency(totalCost)}
          icon={IndianRupee}
          accent="bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
        />
        <StatCard
          title="Dealers with rentals"
          value={dealersUsed}
          icon={Handshake}
          hint={`${dealerList.length} dealer${dealerList.length === 1 ? "" : "s"} total`}
          accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
        />
      </div>

      <Tabs defaultValue="summary">
        <TabsList className="flex-wrap">
          <TabsTrigger value="summary">By Dealer</TabsTrigger>
          {summaryRows.map((r) => (
            <TabsTrigger key={r.key} value={r.key}>
              {r.name} ({r.trips})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="summary">
          <DataTable
            columns={summaryColumns}
            data={summaryRows}
            searchPlaceholder="Search dealer…"
            emptyMessage="No dealers yet."
            toolbar={
              <ExportButton
                rows={summaryRows}
                columns={summaryExportColumns}
                filename="rented-vehicles-by-dealer"
              />
            }
          />
        </TabsContent>

        {summaryRows.map((r) => {
          const dealerTrips = tripsFor(r.key)
          return (
            <TabsContent key={r.key} value={r.key} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                  title="Trucks rented"
                  value={r.trucks}
                  icon={Truck}
                  hint={`${r.trips} trip${r.trips === 1 ? "" : "s"}`}
                  accent="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                />
                <StatCard
                  title="Total rent cost"
                  value={formatCurrency(r.totalCost)}
                  icon={IndianRupee}
                  accent="bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                />
                <StatCard
                  title="Avg. cost / trip"
                  value={formatCurrency(r.avgCost)}
                  icon={Route}
                  accent="bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
                />
              </div>

              {!r.linked ? (
                <p className="text-muted-foreground text-xs">
                  These dispatches were saved before a dealer was linked, or
                  without picking one. Edit each on the Dispatch page and
                  choose a dealer to move it into that dealer&apos;s totals.
                </p>
              ) : null}

              <DataTable
                columns={tripColumns}
                data={dealerTrips}
                searchPlaceholder="Search vehicle, driver, route…"
                emptyMessage="No rented trips for this dealer yet."
                toolbar={
                  <ExportButton
                    rows={dealerTrips}
                    columns={tripExportColumns}
                    filename={`rented-${r.name.toLowerCase().replace(/\s+/g, "-")}`}
                  />
                }
              />
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}

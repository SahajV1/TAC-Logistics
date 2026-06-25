import Link from "next/link"
import { format, startOfMonth } from "date-fns"
import {
  ArrowRight,
  BellRing,
  Bus,
  Fuel,
  HandCoins,
  Truck,
  Users,
} from "lucide-react"
import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/format"
import { expiringWithin } from "@/lib/expiry"
import { EXPIRY_WINDOW_DAYS } from "@/lib/constants"
import type { Dispatch, DocumentRow } from "@/lib/types"

export const metadata = { title: "Dashboard" }

const sum = <T,>(rows: T[], pick: (r: T) => number) =>
  rows.reduce((acc, r) => acc + Number(pick(r) || 0), 0)

export default async function DashboardPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd")

  const [dispatchRes, docRes, driverCount, truckCount] = await Promise.all([
    supabase
      .from("dispatches")
      .select("*, branches(id, name)")
      .order("dispatch_date", { ascending: false }),
    supabase
      .from("documents")
      .select("*, trucks(id, vehicle_number)")
      .eq("is_current", true),
    supabase
      .from("drivers")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("trucks")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
  ])

  const dispatches = (dispatchRes.data ?? []) as Dispatch[]
  const monthDispatches = dispatches.filter(
    (d) => d.dispatch_date >= monthStart
  )

  const fuelThisMonth = sum(monthDispatches, (d) => d.fuel_cost)
  const rentThisMonth = sum(monthDispatches, (d) => d.rent_amount)
  const expiring = expiringWithin(
    (docRes.data ?? []) as DocumentRow[],
    EXPIRY_WINDOW_DAYS
  )
  const expiredCount = expiring.filter((d) => d.daysLeft < 0).length

  // Admin branch-wise breakdown for the current month
  const byBranch = new Map<
    string,
    { trips: number; fuel: number; rent: number }
  >()
  for (const d of monthDispatches) {
    const name = d.branches?.name ?? "Unassigned"
    const row = byBranch.get(name) ?? { trips: 0, fuel: 0, rent: 0 }
    row.trips += 1
    row.fuel += Number(d.fuel_cost || 0)
    row.rent += Number(d.rent_amount || 0)
    byBranch.set(name, row)
  }

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.full_name.split(" ")[0]}`}
        description={
          user.isAdmin
            ? "Organisation-wide overview across all branches."
            : `${user.branchName} branch · ${format(new Date(), "MMMM yyyy")}`
        }
      >
        <Button asChild>
          <Link href="/dispatch">
            <Truck /> New dispatch
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Dispatches this month"
          value={monthDispatches.length}
          icon={Truck}
          hint={`${dispatches.length} total`}
          accent="bg-primary/10 text-primary"
        />
        <StatCard
          title="Fuel expense (month)"
          value={formatCurrency(fuelThisMonth)}
          icon={Fuel}
          accent="bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
        />
        <StatCard
          title="Rent expense (month)"
          value={formatCurrency(rentThisMonth)}
          icon={HandCoins}
          accent="bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400"
        />
        <StatCard
          title="Expiring documents"
          value={expiring.length}
          icon={BellRing}
          hint={expiredCount > 0 ? `${expiredCount} already expired` : "next 30 days"}
          accent="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active drivers"
          value={driverCount.count ?? 0}
          icon={Users}
        />
        <StatCard
          title="Active trucks"
          value={truckCount.count ?? 0}
          icon={Bus}
        />
        <StatCard
          title="Advance + misc (month)"
          value={formatCurrency(
            sum(monthDispatches, (d) => Number(d.advance_amount) + Number(d.misc_amount))
          )}
          icon={HandCoins}
        />
        <StatCard
          title="Total trip cost (month)"
          value={formatCurrency(
            sum(
              monthDispatches,
              (d) =>
                Number(d.fuel_cost) +
                Number(d.advance_amount) +
                Number(d.misc_amount) +
                Number(d.rent_amount)
            )
          )}
          icon={Fuel}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent dispatches</CardTitle>
              <CardDescription>Latest trips across your scope</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dispatch">
                View all <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {dispatches.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No dispatches yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead className="text-right">Fuel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dispatches.slice(0, 6).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{formatDate(d.dispatch_date)}</TableCell>
                      <TableCell className="font-medium">
                        {d.vehicle_number}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {d.from_location} → {d.to_location}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(d.fuel_cost))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {user.isAdmin ? "Branch-wise (month)" : "Expiring soon"}
            </CardTitle>
            <CardDescription>
              {user.isAdmin
                ? "Trips & fuel per branch"
                : "Documents needing attention"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {user.isAdmin ? (
              byBranch.size === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No dispatches this month.
                </p>
              ) : (
                [...byBranch.entries()].map(([name, row]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{name}</p>
                      <p className="text-muted-foreground text-xs">
                        {row.trips} trips
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p>{formatCurrency(row.fuel)} fuel</p>
                      <p className="text-muted-foreground text-xs">
                        {formatCurrency(row.rent)} rent
                      </p>
                    </div>
                  </div>
                ))
              )
            ) : expiring.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nothing expiring soon. 🎉
              </p>
            ) : (
              expiring.slice(0, 6).map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">
                    {d.trucks?.vehicle_number ?? "—"}
                  </span>
                  <Badge
                    variant={d.daysLeft < 0 ? "destructive" : "secondary"}
                    className="whitespace-nowrap"
                  >
                    {d.daysLeft < 0 ? "Expired" : `${d.daysLeft}d`}
                  </Badge>
                </div>
              ))
            )}
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/alerts">Open alerts</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

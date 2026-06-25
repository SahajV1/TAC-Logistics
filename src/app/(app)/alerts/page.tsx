import Link from "next/link"
import { AlertTriangle, CalendarClock, CircleAlert } from "lucide-react"
import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { ExpiryBadge } from "@/components/badges"
import { Button } from "@/components/ui/button"
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
import { EXPIRY_WINDOW_DAYS, DOC_TYPE_LABELS } from "@/lib/constants"
import { expiringWithin } from "@/lib/expiry"
import { daysUntil } from "@/lib/format"
import type { Driver, DocumentRow } from "@/lib/types"

export const metadata = { title: "Alerts" }

export default async function AlertsPage() {
  await requireUser()
  const supabase = await createClient()

  const [docRes, driverRes] = await Promise.all([
    supabase
      .from("documents")
      .select("*, trucks(id, vehicle_number), branches(id, name)")
      .eq("is_current", true),
    supabase
      .from("drivers")
      .select("*, branches(id, name)")
      .not("license_expiry", "is", null),
  ])

  const docs = expiringWithin(
    (docRes.data ?? []) as DocumentRow[],
    EXPIRY_WINDOW_DAYS
  )
  const drivers = ((driverRes.data ?? []) as Driver[])
    .map((d) => ({ ...d, daysLeft: daysUntil(d.license_expiry) }))
    .filter((d) => d.daysLeft <= EXPIRY_WINDOW_DAYS)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  const expired = docs.filter((d) => d.daysLeft < 0).length
  const due7 = docs.filter((d) => d.daysLeft >= 0 && d.daysLeft <= 7).length
  const due15 = docs.filter((d) => d.daysLeft > 7 && d.daysLeft <= 15).length
  const due30 = docs.filter((d) => d.daysLeft > 15 && d.daysLeft <= 30).length

  return (
    <>
      <PageHeader
        title="Expiry Alerts"
        description={`Documents and licences expiring within ${EXPIRY_WINDOW_DAYS} days. Daily email reminders fire at 30, 15, 7 and 1 day.`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Expired"
          value={expired}
          icon={CircleAlert}
          accent="bg-destructive/10 text-destructive"
        />
        <StatCard
          title="Due in ≤7 days"
          value={due7}
          icon={AlertTriangle}
          accent="bg-destructive/10 text-destructive"
        />
        <StatCard
          title="Due in 8–15 days"
          value={due15}
          icon={CalendarClock}
          accent="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
        />
        <StatCard
          title="Due in 16–30 days"
          value={due30}
          icon={CalendarClock}
          accent="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Vehicle documents</CardTitle>
              <CardDescription>RC, Insurance, PUC, Fitness, Permit</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/documents">Manage</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {docs.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nothing expiring in the next {EXPIRY_WINDOW_DAYS} days. 🎉
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Expiry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">
                        {d.trucks?.vehicle_number ?? "—"}
                      </TableCell>
                      <TableCell>{DOC_TYPE_LABELS[d.doc_type]}</TableCell>
                      <TableCell>
                        <ExpiryBadge date={d.expiry_date} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Driver licences</CardTitle>
              <CardDescription>Licences nearing expiry</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/drivers">Manage</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {drivers.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No licences expiring soon.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead>Licence</TableHead>
                    <TableHead>Expiry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell>{d.license_number ?? "—"}</TableCell>
                      <TableCell>
                        <ExpiryBadge date={d.license_expiry} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

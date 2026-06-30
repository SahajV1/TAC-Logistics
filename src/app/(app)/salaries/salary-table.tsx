"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { DataTable } from "@/components/data-table"
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
import { formatCurrency, formatMonth } from "@/lib/format"
import type { Branch, PersonType, Salary } from "@/lib/types"
import {
  SalaryFormDialog,
  type DriverPick,
  type StaffPick,
} from "./salary-form"
import { deleteSalary, toggleSalaryPaid } from "./actions"

function PaidToggle({ id, paid }: { id: string; paid: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleSalaryPaid(id, !paid)
          router.refresh()
        })
      }
      className="disabled:opacity-50"
      title="Toggle paid status"
    >
      <Badge
        variant={paid ? "outline" : "secondary"}
        className={
          paid
            ? "border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
            : ""
        }
      >
        {paid ? "Paid" : "Pending"}
      </Badge>
    </button>
  )
}

export function SalaryTable({
  salaries,
  drivers,
  staff,
  branches,
  isAdmin,
  defaultBranchId,
}: {
  salaries: Salary[]
  drivers: DriverPick[]
  staff: StaffPick[]
  branches: Pick<Branch, "id" | "name">[]
  isAdmin: boolean
  defaultBranchId: string | null
}) {
  const lookups = { drivers, staff, branches, isAdmin, defaultBranchId }

  const columns: ColumnDef<Salary>[] = [
    {
      accessorKey: "month",
      header: "Month",
      cell: ({ row }) => formatMonth(row.original.month),
    },
    {
      accessorKey: "person_name",
      header: "Person",
      cell: ({ row }) => (
        <div className="leading-tight">
          <div className="font-medium">{row.original.person_name}</div>
          <div className="text-muted-foreground text-xs capitalize">
            {row.original.person_type}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "base_salary",
      header: "Base",
      cell: ({ row }) => formatCurrency(Number(row.original.base_salary)),
    },
    {
      accessorKey: "bonus",
      header: "Bonus",
      cell: ({ row }) => formatCurrency(Number(row.original.bonus)),
    },
    {
      accessorKey: "deductions",
      header: "Deductions",
      cell: ({ row }) => formatCurrency(Number(row.original.deductions)),
    },
    {
      accessorKey: "advance",
      header: "Advance",
      cell: ({ row }) => formatCurrency(Number(row.original.advance)),
    },
    {
      accessorKey: "net_salary",
      header: "Net",
      cell: ({ row }) => (
        <span className="font-semibold">
          {formatCurrency(Number(row.original.net_salary))}
        </span>
      ),
    },
    {
      accessorKey: "paid",
      header: "Status",
      cell: ({ row }) => (
        <PaidToggle id={row.original.id} paid={row.original.paid} />
      ),
    },
    ...(isAdmin
      ? [
          {
            id: "branch",
            header: "Branch",
            accessorFn: (r: Salary) => r.branches?.name ?? "",
          } as ColumnDef<Salary>,
        ]
      : []),
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <SalaryFormDialog
            {...lookups}
            initial={row.original}
            trigger={
              <Button variant="ghost" size="icon-sm">
                <Pencil />
                <span className="sr-only">Edit</span>
              </Button>
            }
          />
          <ConfirmDialog
            title="Delete salary record?"
            successMessage="Salary deleted"
            onConfirm={() => deleteSalary(row.original.id)}
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

  const exportColumns: ExportColumn<Salary>[] = [
    { header: "Month", value: (s) => s.month },
    { header: "Person", value: (s) => s.person_name },
    { header: "Type", value: (s) => s.person_type },
    { header: "Base", value: (s) => Number(s.base_salary) },
    { header: "Bonus", value: (s) => Number(s.bonus) },
    { header: "Deductions", value: (s) => Number(s.deductions) },
    { header: "Advance", value: (s) => Number(s.advance) },
    { header: "Net", value: (s) => Number(s.net_salary) },
    { header: "Paid", value: (s) => (s.paid ? "Yes" : "No") },
    { header: "Paid Date", value: (s) => s.paid_date ?? "" },
    { header: "Branch", value: (s) => s.branches?.name ?? "" },
    { header: "Notes", value: (s) => s.notes ?? "" },
  ]

  // Split records so Drivers and Staff salaries can be viewed separately.
  const driverSalaries = salaries.filter((s) => s.person_type === "driver")
  const staffSalaries = salaries.filter((s) => s.person_type === "staff")

  const renderTable = (
    rows: Salary[],
    filename: string,
    defaultPersonType?: PersonType
  ) => (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Search person, month…"
      emptyMessage="No salary records yet."
      toolbar={
        <>
          <ExportButton rows={rows} columns={exportColumns} filename={filename} />
          <SalaryFormDialog
            {...lookups}
            defaultPersonType={defaultPersonType}
            trigger={
              <Button>
                <Plus /> Record salary
              </Button>
            }
          />
        </>
      }
    />
  )

  return (
    <Tabs defaultValue="all">
      <TabsList>
        <TabsTrigger value="all">All ({salaries.length})</TabsTrigger>
        <TabsTrigger value="driver">
          Drivers ({driverSalaries.length})
        </TabsTrigger>
        <TabsTrigger value="staff">Staff ({staffSalaries.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="all">{renderTable(salaries, "salaries")}</TabsContent>
      <TabsContent value="driver">
        {renderTable(driverSalaries, "salaries-drivers", "driver")}
      </TabsContent>
      <TabsContent value="staff">
        {renderTable(staffSalaries, "salaries-staff", "staff")}
      </TabsContent>
    </Tabs>
  )
}

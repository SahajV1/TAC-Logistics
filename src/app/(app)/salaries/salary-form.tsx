"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { salarySchema, type SalaryFormValues } from "@/lib/schemas"
import { saveSalary } from "./actions"
import { Form } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  CheckboxField,
  NumberField,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/form-fields"
import type { Branch, Salary } from "@/lib/types"

export type DriverPick = { id: string; name: string; branch_id: string }
export type StaffPick = { id: string; full_name: string; branch_id: string | null }

function thisMonth() {
  return new Date().toISOString().slice(0, 7)
}

function toDefaults(
  initial: Salary | null,
  defaultBranchId: string | null
): SalaryFormValues {
  return {
    person_type: initial?.person_type ?? "driver",
    driver_id: initial?.driver_id ?? "",
    staff_id: initial?.staff_id ?? "",
    person_name: initial?.person_name ?? "",
    month: initial?.month ? initial.month.slice(0, 7) : thisMonth(),
    base_salary: Number(initial?.base_salary ?? 0),
    bonus: Number(initial?.bonus ?? 0),
    deductions: Number(initial?.deductions ?? 0),
    paid: initial?.paid ?? false,
    paid_date: initial?.paid_date ?? "",
    notes: initial?.notes ?? "",
    branch_id: initial?.branch_id ?? defaultBranchId ?? "",
  }
}

export function SalaryFormDialog({
  trigger,
  initial = null,
  drivers,
  staff,
  branches,
  isAdmin,
  defaultBranchId,
}: {
  trigger: React.ReactNode
  initial?: Salary | null
  drivers: DriverPick[]
  staff: StaffPick[]
  branches: Pick<Branch, "id" | "name">[]
  isAdmin: boolean
  defaultBranchId: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const form = useForm<SalaryFormValues>({
    resolver: zodResolver(salarySchema),
    defaultValues: toDefaults(initial, defaultBranchId),
  })

  React.useEffect(() => {
    if (open) form.reset(toDefaults(initial, defaultBranchId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const personType = form.watch("person_type")
  const paid = form.watch("paid")
  const selectedBranch = form.watch("branch_id")
  const branchScope = isAdmin ? selectedBranch : defaultBranchId

  const driverOptions = drivers
    .filter((d) => !branchScope || d.branch_id === branchScope)
    .map((d) => ({ value: d.id, label: d.name }))
  const staffOptions = staff
    .filter((s) => !branchScope || s.branch_id === branchScope)
    .map((s) => ({ value: s.id, label: s.full_name }))

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await saveSalary(initial?.id ?? null, values)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(initial ? "Salary updated" : "Salary recorded")
      setOpen(false)
      router.refresh()
    })
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit salary" : "Record salary"}
          </DialogTitle>
          <DialogDescription>
            Net salary is calculated as base + bonus − deductions.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            {isAdmin ? (
              <SelectField
                control={form.control}
                name="branch_id"
                label="Branch"
                placeholder="Select branch"
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
              />
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="person_type"
                label="Person type"
                options={[
                  { value: "driver", label: "Driver" },
                  { value: "staff", label: "Staff" },
                ]}
              />
              {personType === "driver" ? (
                <SelectField
                  control={form.control}
                  name="driver_id"
                  label="Driver (optional)"
                  placeholder="Pick driver"
                  options={driverOptions}
                  onValueChange={(id) => {
                    const d = drivers.find((x) => x.id === id)
                    if (d)
                      form.setValue("person_name", d.name, {
                        shouldValidate: true,
                      })
                  }}
                />
              ) : (
                <SelectField
                  control={form.control}
                  name="staff_id"
                  label="Staff (optional)"
                  placeholder="Pick staff"
                  options={staffOptions}
                  onValueChange={(id) => {
                    const s = staff.find((x) => x.id === id)
                    if (s)
                      form.setValue("person_name", s.full_name, {
                        shouldValidate: true,
                      })
                  }}
                />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="person_name"
                label="Name"
                placeholder="Person's name"
              />
              <TextField
                control={form.control}
                name="month"
                label="Month"
                type="month"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                control={form.control}
                name="base_salary"
                label="Base (₹)"
              />
              <NumberField
                control={form.control}
                name="bonus"
                label="Bonus (₹)"
              />
              <NumberField
                control={form.control}
                name="deductions"
                label="Deductions (₹)"
              />
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <CheckboxField
                control={form.control}
                name="paid"
                label="Marked as paid"
              />
              {paid ? (
                <TextField
                  control={form.control}
                  name="paid_date"
                  label="Paid on"
                  type="date"
                  className="flex-1"
                />
              ) : null}
            </div>

            <TextareaField
              control={form.control}
              name="notes"
              label="Notes"
              placeholder="Optional"
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : null}
                {initial ? "Save changes" : "Record salary"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { driverSchema, type DriverFormValues } from "@/lib/schemas"
import { saveDriver } from "./actions"
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
  NumberField,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/form-fields"
import { ENTITY_STATUSES } from "@/lib/constants"
import type { Branch, Driver } from "@/lib/types"

function toDefaults(
  initial: Driver | null,
  defaultBranchId: string | null
): DriverFormValues {
  return {
    name: initial?.name ?? "",
    phone: initial?.phone ?? "",
    license_number: initial?.license_number ?? "",
    license_expiry: initial?.license_expiry ?? "",
    address: initial?.address ?? "",
    monthly_salary: Number(initial?.monthly_salary ?? 0),
    status: initial?.status ?? "active",
    branch_id: initial?.branch_id ?? defaultBranchId ?? "",
  }
}

export function DriverFormDialog({
  trigger,
  initial = null,
  branches,
  isAdmin,
  defaultBranchId,
}: {
  trigger: React.ReactNode
  initial?: Driver | null
  branches: Pick<Branch, "id" | "name">[]
  isAdmin: boolean
  defaultBranchId: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const form = useForm<DriverFormValues>({
    resolver: zodResolver(driverSchema),
    defaultValues: toDefaults(initial, defaultBranchId),
  })

  React.useEffect(() => {
    if (open) form.reset(toDefaults(initial, defaultBranchId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await saveDriver(initial?.id ?? null, values)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(initial ? "Driver updated" : "Driver added")
      setOpen(false)
      router.refresh()
    })
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit driver" : "Add driver"}</DialogTitle>
          <DialogDescription>
            Driver details and licence information.
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
              <TextField
                control={form.control}
                name="name"
                label="Full name"
                placeholder="Driver name"
              />
              <TextField
                control={form.control}
                name="phone"
                label="Phone"
                placeholder="Mobile number"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="license_number"
                label="Licence number"
              />
              <TextField
                control={form.control}
                name="license_expiry"
                label="Licence expiry"
                type="date"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                control={form.control}
                name="monthly_salary"
                label="Monthly salary (₹)"
              />
              <SelectField
                control={form.control}
                name="status"
                label="Status"
                options={ENTITY_STATUSES.map((s) => ({
                  value: s.value,
                  label: s.label,
                }))}
              />
            </div>

            <TextareaField
              control={form.control}
              name="address"
              label="Address"
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
                {initial ? "Save changes" : "Add driver"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

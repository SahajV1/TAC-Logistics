"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { truckSchema, type TruckFormValues } from "@/lib/schemas"
import { saveTruck } from "./actions"
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
import { NumberField, SelectField, TextField } from "@/components/form-fields"
import { ENTITY_STATUSES, TRUCK_TYPES } from "@/lib/constants"
import type { Branch, Truck } from "@/lib/types"

function toDefaults(
  initial: Truck | null,
  defaultBranchId: string | null
): TruckFormValues {
  return {
    vehicle_number: initial?.vehicle_number ?? "",
    truck_type: initial?.truck_type ?? "company",
    owner_name: initial?.owner_name ?? "",
    owner_phone: initial?.owner_phone ?? "",
    make_model: initial?.make_model ?? "",
    capacity_tons: Number(initial?.capacity_tons ?? 0),
    status: initial?.status ?? "active",
    branch_id: initial?.branch_id ?? defaultBranchId ?? "",
  }
}

export function TruckFormDialog({
  trigger,
  initial = null,
  branches,
  isAdmin,
  defaultBranchId,
}: {
  trigger: React.ReactNode
  initial?: Truck | null
  branches: Pick<Branch, "id" | "name">[]
  isAdmin: boolean
  defaultBranchId: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const form = useForm<TruckFormValues>({
    resolver: zodResolver(truckSchema),
    defaultValues: toDefaults(initial, defaultBranchId),
  })

  React.useEffect(() => {
    if (open) form.reset(toDefaults(initial, defaultBranchId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const truckType = form.watch("truck_type")

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await saveTruck(initial?.id ?? null, values)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(initial ? "Truck updated" : "Truck added")
      setOpen(false)
      router.refresh()
    })
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit truck" : "Add truck"}</DialogTitle>
          <DialogDescription>
            Vehicle details. Rented trucks capture owner information.
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
                name="vehicle_number"
                label="Vehicle number"
                placeholder="UP32 AB 1234"
              />
              <SelectField
                control={form.control}
                name="truck_type"
                label="Truck type"
                options={TRUCK_TYPES.map((t) => ({
                  value: t.value,
                  label: t.label,
                }))}
              />
            </div>

            {truckType === "rented" ? (
              <div className="bg-muted/40 grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                <TextField
                  control={form.control}
                  name="owner_name"
                  label="Owner name"
                />
                <TextField
                  control={form.control}
                  name="owner_phone"
                  label="Owner phone"
                />
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="make_model"
                label="Make / model"
                placeholder="e.g. Tata 1109"
              />
              <NumberField
                control={form.control}
                name="capacity_tons"
                label="Capacity (tons)"
              />
            </div>

            <SelectField
              control={form.control}
              name="status"
              label="Status"
              options={ENTITY_STATUSES.map((s) => ({
                value: s.value,
                label: s.label,
              }))}
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
                {initial ? "Save changes" : "Add truck"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { fuelStationSchema, type FuelStationFormValues } from "@/lib/schemas"
import { saveFuelStation } from "./actions"
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
import { SelectField, TextField } from "@/components/form-fields"
import { ENTITY_STATUSES } from "@/lib/constants"
import type { FuelStation } from "@/lib/types"

function toDefaults(initial: FuelStation | null): FuelStationFormValues {
  return {
    name: initial?.name ?? "",
    location: initial?.location ?? "",
    contact: initial?.contact ?? "",
    status: initial?.status ?? "active",
  }
}

export function FuelStationFormDialog({
  trigger,
  initial = null,
}: {
  trigger: React.ReactNode
  initial?: FuelStation | null
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const form = useForm<FuelStationFormValues>({
    resolver: zodResolver(fuelStationSchema),
    defaultValues: toDefaults(initial),
  })

  React.useEffect(() => {
    if (open) form.reset(toDefaults(initial))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await saveFuelStation(initial?.id ?? null, values)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(initial ? "Fuel station updated" : "Fuel station added")
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
            {initial ? "Edit fuel station" : "Add fuel station"}
          </DialogTitle>
          <DialogDescription>
            Filling station name and contact details.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <TextField
              control={form.control}
              name="name"
              label="Station name"
              placeholder="e.g. S.S Fillings"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="location"
                label="Location"
                placeholder="Optional"
              />
              <TextField
                control={form.control}
                name="contact"
                label="Contact"
                placeholder="Phone or person"
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
                {initial ? "Save changes" : "Add fuel station"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

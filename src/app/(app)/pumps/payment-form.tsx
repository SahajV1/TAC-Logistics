"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  pumpPaymentSchema,
  type PumpPaymentFormValues,
} from "@/lib/schemas"
import { savePumpPayment } from "./actions"
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
import type { FuelStationPayment } from "@/lib/types"

function today() {
  return new Date().toISOString().slice(0, 10)
}

function toDefaults(
  initial: FuelStationPayment | null,
  defaultStation?: string
): PumpPaymentFormValues {
  return {
    fuel_station: initial?.fuel_station ?? defaultStation ?? "",
    pay_date: initial?.pay_date ?? today(),
    amount: Number(initial?.amount ?? 0),
    reference: initial?.reference ?? "",
    notes: initial?.notes ?? "",
  }
}

export function PumpPaymentDialog({
  trigger,
  initial = null,
  fuelStations,
  defaultStation,
}: {
  trigger: React.ReactNode
  initial?: FuelStationPayment | null
  fuelStations: string[]
  defaultStation?: string
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const form = useForm<PumpPaymentFormValues>({
    resolver: zodResolver(pumpPaymentSchema),
    defaultValues: toDefaults(initial, defaultStation),
  })

  React.useEffect(() => {
    if (open) form.reset(toDefaults(initial, defaultStation))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const stationValue = form.watch("fuel_station")

  // Keep an existing station visible even if it's not in the master list.
  const stationOptions = Array.from(
    new Set(fuelStations.concat(stationValue ? [stationValue] : []))
  )
    .filter(Boolean)
    .map((s) => ({ value: s, label: s }))

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await savePumpPayment(initial?.id ?? null, values)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(initial ? "Payment updated" : "Payment recorded")
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
            {initial ? "Edit pump payment" : "Record pump payment"}
          </DialogTitle>
          <DialogDescription>
            Cash / bank payment to the fuel station. Reduces what we owe the
            pump.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="fuel_station"
                label="Fuel station"
                placeholder="Select pump"
                options={stationOptions}
              />
              <TextField
                control={form.control}
                name="pay_date"
                label="Date"
                type="date"
              />
            </div>

            <NumberField
              control={form.control}
              name="amount"
              label="Amount (₹)"
            />

            <TextField
              control={form.control}
              name="reference"
              label="Reference"
              placeholder="e.g. UPI / cheque / receipt no."
            />

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
                {initial ? "Save changes" : "Record payment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

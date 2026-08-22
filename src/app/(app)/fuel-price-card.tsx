"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Fuel, Loader2, Pencil } from "lucide-react"
import { toast } from "sonner"
import { fuelPriceSchema, type FuelPriceFormValues } from "@/lib/schemas"
import { updateFuelPrice } from "@/lib/actions/settings"
import { Form } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { NumberField } from "@/components/form-fields"

// Admin-only card on the dashboard: sets the fuel price per litre that the
// dispatch form uses to auto-calculate fuel cost, so staff never type a rate.
export function FuelPriceCard({
  fuelPricePerLitre,
}: {
  fuelPricePerLitre: number
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const form = useForm<FuelPriceFormValues>({
    resolver: zodResolver(fuelPriceSchema),
    defaultValues: { fuel_price_per_litre: fuelPricePerLitre },
  })

  React.useEffect(() => {
    if (open) form.reset({ fuel_price_per_litre: fuelPricePerLitre })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await updateFuelPrice(values)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Fuel price updated")
      setOpen(false)
      router.refresh()
    })
  })

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
          <Fuel className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground truncate text-sm">
            Fuel price / litre
          </p>
          <p className="text-2xl font-semibold tracking-tight">
            {fuelPricePerLitre > 0
              ? `₹${fuelPricePerLitre.toFixed(2)}`
              : "Not set"}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            Auto-fills fuel cost on the dispatch form
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Pencil /> Update
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Update fuel price</DialogTitle>
              <DialogDescription>
                Staff won&apos;t need to enter this on dispatches — the form
                will calculate fuel cost from litres × this rate.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={onSubmit} className="space-y-4">
                <NumberField
                  control={form.control}
                  name="fuel_price_per_litre"
                  label="Price per litre (₹)"
                  step="0.01"
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
                    Save
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

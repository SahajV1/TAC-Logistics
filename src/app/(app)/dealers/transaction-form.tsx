"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  dealerTransactionSchema,
  type DealerTransactionFormValues,
} from "@/lib/schemas"
import { DEALER_TXN_TYPES } from "@/lib/constants"
import { saveDealerTransaction } from "./actions"
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
import type { Dealer, DealerTransaction, DealerTxnType } from "@/lib/types"

export type DealerPick = Pick<Dealer, "id" | "name" | "status">

function today() {
  return new Date().toISOString().slice(0, 10)
}

function toDefaults(
  initial: DealerTransaction | null,
  defaultDealerId?: string,
  defaultType: DealerTxnType = "due"
): DealerTransactionFormValues {
  return {
    dealer_id: initial?.dealer_id ?? defaultDealerId ?? "",
    txn_type: initial?.txn_type ?? defaultType,
    txn_date: initial?.txn_date ?? today(),
    amount: Number(initial?.amount ?? 0),
    fuel_station: initial?.fuel_station ?? "",
    fuel_litres: Number(initial?.fuel_litres ?? 0),
    reference: initial?.reference ?? "",
    notes: initial?.notes ?? "",
  }
}

export function TransactionFormDialog({
  trigger,
  initial = null,
  dealers,
  fuelStations,
  defaultDealerId,
  defaultType,
}: {
  trigger: React.ReactNode
  initial?: DealerTransaction | null
  dealers: DealerPick[]
  fuelStations: string[]
  defaultDealerId?: string
  defaultType?: DealerTxnType
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const form = useForm<DealerTransactionFormValues>({
    resolver: zodResolver(dealerTransactionSchema),
    defaultValues: toDefaults(initial, defaultDealerId, defaultType),
  })

  React.useEffect(() => {
    if (open) form.reset(toDefaults(initial, defaultDealerId, defaultType))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const txnType = form.watch("txn_type")
  const stationValue = form.watch("fuel_station")

  // Active dealers only, but keep the entry's existing dealer selectable.
  const dealerOptions = dealers
    .filter((d) => d.status === "active" || d.id === initial?.dealer_id)
    .map((d) => ({ value: d.id, label: d.name }))

  // Keep an existing station visible even if it's not in the master list.
  const stationOptions = Array.from(
    new Set(fuelStations.concat(stationValue ? [stationValue] : []))
  )
    .filter(Boolean)
    .map((s) => ({ value: s, label: s }))

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await saveDealerTransaction(initial?.id ?? null, values)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(initial ? "Entry updated" : "Entry recorded")
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
            {initial ? "Edit ledger entry" : "Record ledger entry"}
          </DialogTitle>
          <DialogDescription>
            Outstanding to a dealer = dues − fuel taken at our pumps − cash
            payments.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="dealer_id"
                label="Dealer"
                placeholder="Select dealer"
                options={dealerOptions}
              />
              <SelectField
                control={form.control}
                name="txn_type"
                label="Entry type"
                options={DEALER_TXN_TYPES}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="txn_date"
                label="Date"
                type="date"
              />
              <NumberField
                control={form.control}
                name="amount"
                label="Amount (₹)"
              />
            </div>

            {txnType === "fuel_offset" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  control={form.control}
                  name="fuel_station"
                  label="Fuel station"
                  placeholder="Select pump"
                  options={stationOptions}
                />
                <NumberField
                  control={form.control}
                  name="fuel_litres"
                  label="Fuel (litres)"
                />
              </div>
            ) : null}

            <TextField
              control={form.control}
              name="reference"
              label="Reference"
              placeholder={
                txnType === "due"
                  ? "e.g. vehicle no. / rent month"
                  : txnType === "payment"
                    ? "e.g. UPI / cheque / receipt no."
                    : "Optional"
              }
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
                {initial ? "Save changes" : "Record entry"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

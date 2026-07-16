"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { dealerSchema, type DealerFormValues } from "@/lib/schemas"
import { ENTITY_STATUSES } from "@/lib/constants"
import { saveDealer } from "./actions"
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
  SelectField,
  TextField,
  TextareaField,
} from "@/components/form-fields"
import type { Dealer } from "@/lib/types"

function toDefaults(initial: Dealer | null): DealerFormValues {
  return {
    name: initial?.name ?? "",
    phone: initial?.phone ?? "",
    address: initial?.address ?? "",
    notes: initial?.notes ?? "",
    status: initial?.status ?? "active",
  }
}

export function DealerFormDialog({
  trigger,
  initial = null,
}: {
  trigger: React.ReactNode
  initial?: Dealer | null
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const form = useForm<DealerFormValues>({
    resolver: zodResolver(dealerSchema),
    defaultValues: toDefaults(initial),
  })

  React.useEffect(() => {
    if (open) form.reset(toDefaults(initial))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await saveDealer(initial?.id ?? null, values)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(initial ? "Dealer updated" : "Dealer added")
      setOpen(false)
      router.refresh()
    })
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit dealer" : "Add dealer"}</DialogTitle>
          <DialogDescription>
            A dealer is the owner you rent trucks from. Their dues are tracked
            in the ledger.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="name"
                label="Name"
                placeholder="Dealer / owner name"
              />
              <TextField
                control={form.control}
                name="phone"
                label="Phone"
                placeholder="Optional"
              />
            </div>

            <TextField
              control={form.control}
              name="address"
              label="Address"
              placeholder="Optional"
            />

            <SelectField
              control={form.control}
              name="status"
              label="Status"
              options={ENTITY_STATUSES}
            />

            <TextareaField
              control={form.control}
              name="notes"
              label="Notes"
              placeholder="Optional — e.g. trucks rented from this dealer"
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
                {initial ? "Save changes" : "Add dealer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

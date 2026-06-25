"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Loader2, Paperclip } from "lucide-react"
import { toast } from "sonner"
import { documentSchema, type DocumentFormValues } from "@/lib/schemas"
import { saveDocument } from "./actions"
import { createClient } from "@/lib/supabase/client"
import { Form } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { DOC_TYPES } from "@/lib/constants"
import type { DocType, DocumentRow } from "@/lib/types"

export type DocTruckOption = {
  id: string
  vehicle_number: string
  branch_id: string
}

function toDefaults(
  initial: DocumentRow | null,
  preset?: { truckId?: string; docType?: DocType }
): DocumentFormValues {
  return {
    truck_id: initial?.truck_id ?? preset?.truckId ?? "",
    doc_type: initial?.doc_type ?? preset?.docType ?? "insurance",
    doc_number: initial?.doc_number ?? "",
    issue_date: initial?.issue_date ?? "",
    expiry_date: initial?.expiry_date ?? "",
    notes: initial?.notes ?? "",
  }
}

function sanitize(name: string) {
  return name.replace(/[^\w.\-]+/g, "_")
}

export function DocumentFormDialog({
  trigger,
  initial = null,
  preset,
  trucks,
}: {
  trigger: React.ReactNode
  initial?: DocumentRow | null
  preset?: { truckId?: string; docType?: DocType }
  trucks: DocTruckOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [file, setFile] = React.useState<File | null>(null)

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: toDefaults(initial, preset),
  })

  function handleOpenChange(next: boolean) {
    if (next) {
      form.reset(toDefaults(initial, preset))
      setFile(null)
    }
    setOpen(next)
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true)
    try {
      let filePayload = {
        file_url: initial?.file_url ?? null,
        file_name: initial?.file_name ?? null,
      }

      if (file) {
        const truck = trucks.find((t) => t.id === values.truck_id)
        if (!truck) {
          toast.error("Please select a valid truck.")
          return
        }
        const supabase = createClient()
        const path = `${truck.branch_id}/${values.truck_id}/${Date.now()}-${sanitize(
          file.name
        )}`
        const { error } = await supabase.storage
          .from("documents")
          .upload(path, file, { upsert: false })
        if (error) {
          toast.error(`Upload failed: ${error.message}`)
          return
        }
        filePayload = { file_url: path, file_name: file.name }
      }

      const res = await saveDocument(initial?.id ?? null, values, filePayload)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(initial ? "Document updated" : "Document saved")
      setOpen(false)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit document" : "Add / renew document"}
          </DialogTitle>
          <DialogDescription>
            RC, Insurance, Pollution, Fitness or Permit. Renewing keeps the old
            version in history.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="truck_id"
                label="Truck"
                placeholder="Select truck"
                options={trucks.map((t) => ({
                  value: t.id,
                  label: t.vehicle_number,
                }))}
              />
              <SelectField
                control={form.control}
                name="doc_type"
                label="Document type"
                options={DOC_TYPES.map((d) => ({
                  value: d.value,
                  label: d.label,
                }))}
              />
            </div>

            <TextField
              control={form.control}
              name="doc_number"
              label="Document number"
              placeholder="Policy / certificate no."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="issue_date"
                label="Issue date"
                type="date"
              />
              <TextField
                control={form.control}
                name="expiry_date"
                label="Expiry date"
                type="date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-file" className="flex items-center gap-2">
                <Paperclip className="size-4" /> Scan / photo (optional)
              </Label>
              <Input
                id="doc-file"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {initial?.file_name && !file ? (
                <p className="text-muted-foreground text-xs">
                  Current file: {initial.file_name}
                </p>
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
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : null}
                {initial ? "Save changes" : "Save document"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

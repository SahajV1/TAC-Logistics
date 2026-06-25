"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { userSchema, type UserFormValues } from "@/lib/schemas"
import { createUser, updateUser } from "./actions"
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
import type { Branch, Profile } from "@/lib/types"

function toDefaults(initial: Profile | null): UserFormValues {
  return {
    full_name: initial?.full_name ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    role: initial?.role ?? "staff",
    branch_id: initial?.branch_id ?? "",
    password: "",
  }
}

export function UserFormDialog({
  trigger,
  initial = null,
  branches,
}: {
  trigger: React.ReactNode
  initial?: Profile | null
  branches: Pick<Branch, "id" | "name">[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const isEdit = Boolean(initial)

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: toDefaults(initial),
  })

  React.useEffect(() => {
    if (open) form.reset(toDefaults(initial))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const role = form.watch("role")

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = isEdit
        ? await updateUser(initial!.id, values)
        : await createUser(values)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(isEdit ? "Account updated" : "Account created")
      setOpen(false)
      router.refresh()
    })
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit staff" : "Add staff"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update details. Leave password blank to keep it unchanged."
              : "Creates a login. Share the password with the staff member."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="full_name"
                label="Full name"
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
              name="email"
              label="Email"
              type="email"
              disabled={isEdit}
              description={isEdit ? "Email cannot be changed." : undefined}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="role"
                label="Role"
                options={[
                  { value: "staff", label: "Staff" },
                  { value: "admin", label: "Administrator" },
                ]}
              />
              <SelectField
                control={form.control}
                name="branch_id"
                label="Branch"
                placeholder={role === "admin" ? "All branches" : "Select branch"}
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
                description={
                  role === "admin" ? "Admins access all branches." : undefined
                }
              />
            </div>

            <TextField
              control={form.control}
              name="password"
              label={isEdit ? "New password (optional)" : "Password"}
              type="password"
              placeholder="At least 8 characters"
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
                {isEdit ? "Save changes" : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

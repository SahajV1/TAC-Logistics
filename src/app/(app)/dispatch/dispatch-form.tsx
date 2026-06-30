"use client"

import * as React from "react"
import { useForm, type Control } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { dispatchSchema, type DispatchFormValues } from "@/lib/schemas"
import { saveDispatch } from "./actions"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { DISPATCH_STATUSES, TRUCK_TYPES } from "@/lib/constants"
import type { Dispatch } from "@/lib/types"

export type DriverOption = { id: string; name: string; branch_id: string }
export type TruckOption = {
  id: string
  vehicle_number: string
  truck_type: "company" | "rented"
  owner_name: string | null
  owner_phone: string | null
  branch_id: string
}
export type BranchOption = { id: string; name: string }

function today() {
  return new Date().toISOString().slice(0, 10)
}

function toDefaults(
  initial: Dispatch | null,
  defaultBranchId: string | null
): DispatchFormValues {
  if (initial) {
    return {
      dispatch_date: initial.dispatch_date,
      driver_id: initial.driver_id ?? "",
      driver_name: initial.driver_name,
      truck_id: initial.truck_id ?? "",
      vehicle_number: initial.vehicle_number,
      from_location: initial.from_location,
      to_location: initial.to_location,
      fuel_litres: Number(initial.fuel_litres),
      fuel_cost: Number(initial.fuel_cost),
      advance_amount: Number(initial.advance_amount),
      misc_amount: Number(initial.misc_amount),
      toll_amount: Number(initial.toll_amount),
      remarks: initial.remarks ?? "",
      truck_type: initial.truck_type,
      owner_details: initial.owner_details ?? "",
      rent_amount: Number(initial.rent_amount),
      fuel_station: initial.fuel_station ?? "",
      status: initial.status,
      branch_id: initial.branch_id,
    }
  }
  return {
    dispatch_date: today(),
    driver_id: "",
    driver_name: "",
    truck_id: "",
    vehicle_number: "",
    from_location: "",
    to_location: "",
    fuel_litres: 0,
    fuel_cost: 0,
    advance_amount: 0,
    misc_amount: 0,
    toll_amount: 0,
    remarks: "",
    truck_type: "company",
    owner_details: "",
    rent_amount: 0,
    fuel_station: "",
    status: "completed",
    branch_id: defaultBranchId ?? "",
  }
}

const NEW_STATION = "__new__"

// Dropdown of saved fuel stations with an inline "add new" mode. A typed-in
// station is saved to the master list on submit, so it's available next time.
function FuelStationField({
  control,
  stations,
}: {
  control: Control<DispatchFormValues>
  stations: string[]
}) {
  const [adding, setAdding] = React.useState(false)

  return (
    <FormField
      control={control}
      name="fuel_station"
      render={({ field }) => {
        const value = (field.value as string | undefined) ?? ""
        // Keep an existing value visible even if it's not in the master list.
        const options = Array.from(
          new Set(
            stations.concat(value && !adding ? [value] : []).filter(Boolean)
          )
        )
        return (
          <FormItem>
            <FormLabel>Fuel station</FormLabel>
            {adding ? (
              <div className="flex gap-2">
                <FormControl>
                  <Input
                    autoFocus
                    placeholder="New fuel station name"
                    value={value}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    field.onChange("")
                    setAdding(false)
                  }}
                >
                  Pick from list
                </Button>
              </div>
            ) : (
              <Select
                value={value}
                onValueChange={(v) => {
                  if (v === NEW_STATION) {
                    field.onChange("")
                    setAdding(true)
                  } else {
                    field.onChange(v)
                  }
                }}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a fuel station" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {options.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_STATION}>
                    ➕ Add new station…
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

export function DispatchFormDialog({
  trigger,
  initial = null,
  drivers,
  trucks,
  branches,
  fuelStations,
  isAdmin,
  defaultBranchId,
}: {
  trigger: React.ReactNode
  initial?: Dispatch | null
  drivers: DriverOption[]
  trucks: TruckOption[]
  branches: BranchOption[]
  fuelStations: string[]
  isAdmin: boolean
  defaultBranchId: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const form = useForm<DispatchFormValues>({
    resolver: zodResolver(dispatchSchema),
    defaultValues: toDefaults(initial, defaultBranchId),
  })

  // Reset when (re)opening so edit dialogs show fresh data.
  React.useEffect(() => {
    if (open) form.reset(toDefaults(initial, defaultBranchId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const truckType = form.watch("truck_type")
  const selectedBranch = form.watch("branch_id")

  // Scope pickers to the chosen branch (admin) or the user's branch.
  const branchScope = isAdmin ? selectedBranch : defaultBranchId
  const driverOptions = drivers
    .filter((d) => !branchScope || d.branch_id === branchScope)
    .map((d) => ({ value: d.id, label: d.name }))
  const truckOptions = trucks
    .filter((t) => !branchScope || t.branch_id === branchScope)
    .map((t) => ({
      value: t.id,
      label: `${t.vehicle_number} · ${t.truck_type === "rented" ? "Rented" : "Company"}`,
    }))

  function onPickDriver(id: string) {
    const d = drivers.find((x) => x.id === id)
    if (d) form.setValue("driver_name", d.name, { shouldValidate: true })
  }
  function onPickTruck(id: string) {
    const t = trucks.find((x) => x.id === id)
    if (!t) return
    form.setValue("vehicle_number", t.vehicle_number, { shouldValidate: true })
    form.setValue("truck_type", t.truck_type)
    if (t.truck_type === "rented") {
      form.setValue(
        "owner_details",
        [t.owner_name, t.owner_phone].filter(Boolean).join(" · ")
      )
    }
  }

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await saveDispatch(initial?.id ?? null, values)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(initial ? "Dispatch updated" : "Dispatch created")
      setOpen(false)
      router.refresh()
    })
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit dispatch" : "New truck dispatch"}
          </DialogTitle>
          <DialogDescription>
            Record a trip with fuel, advance, toll and miscellaneous costs.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4 py-2">
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
                name="dispatch_date"
                label="Dispatch date"
                type="date"
              />
              <SelectField
                control={form.control}
                name="status"
                label="Status"
                options={DISPATCH_STATUSES.map((s) => ({
                  value: s.value,
                  label: s.label,
                }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="truck_id"
                label="Pick truck (optional)"
                placeholder="Select a truck"
                options={truckOptions}
                onValueChange={onPickTruck}
              />
              <TextField
                control={form.control}
                name="vehicle_number"
                label="Vehicle number"
                placeholder="UP32 AB 1234"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                control={form.control}
                name="driver_id"
                label="Pick driver (optional)"
                placeholder="Select a driver"
                options={driverOptions}
                onValueChange={onPickDriver}
              />
              <TextField
                control={form.control}
                name="driver_name"
                label="Driver name"
                placeholder="Full name"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="from_location"
                label="From"
                placeholder="Origin city"
              />
              <TextField
                control={form.control}
                name="to_location"
                label="To"
                placeholder="Destination city"
              />
            </div>

            <SelectField
              control={form.control}
              name="truck_type"
              label="Truck type"
              options={TRUCK_TYPES.map((t) => ({
                value: t.value,
                label: t.label,
              }))}
            />

            {truckType === "rented" ? (
              <div className="bg-muted/40 space-y-4 rounded-lg border p-4">
                <div>
                  <h3 className="text-sm font-semibold">
                    Rented vehicle details
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    Owner and rent information for this hired truck.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    control={form.control}
                    name="owner_details"
                    label="Owner details"
                    placeholder="Owner name · phone"
                    className="sm:col-span-2"
                  />
                  <NumberField
                    control={form.control}
                    name="rent_amount"
                    label="Rent amount (₹)"
                  />
                </div>
              </div>
            ) : null}

            <FuelStationField control={form.control} stations={fuelStations} />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <NumberField
                control={form.control}
                name="fuel_litres"
                label="Fuel (litres)"
              />
              <NumberField
                control={form.control}
                name="fuel_cost"
                label="Fuel cost (₹)"
              />
              <NumberField
                control={form.control}
                name="advance_amount"
                label="Advance (₹)"
              />
              <NumberField
                control={form.control}
                name="toll_amount"
                label="Toll (₹)"
              />
              <NumberField
                control={form.control}
                name="misc_amount"
                label="Misc. (₹)"
              />
            </div>

            <TextareaField
              control={form.control}
              name="remarks"
              label="Remarks"
              placeholder="Optional notes"
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : null}
                {initial ? "Save changes" : "Create dispatch"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

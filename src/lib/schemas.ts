import { z } from "zod"

// Numbers come from <NumberField>, which always emits a number (empty → 0),
// so we validate plain numbers (no coercion) to keep form types clean.

export const dispatchSchema = z
  .object({
    dispatch_date: z.string().min(1, "Date is required"),
    driver_id: z.string().optional(),
    driver_name: z.string().trim().min(1, "Driver name is required"),
    truck_id: z.string().optional(),
    vehicle_number: z.string().trim().min(1, "Vehicle number is required"),
    from_location: z.string().trim().min(1, "Origin is required"),
    to_location: z.string().trim().min(1, "Destination is required"),
    fuel_litres: z.number().min(0, "Must be 0 or more"),
    fuel_cost: z.number().min(0, "Must be 0 or more"),
    advance_amount: z.number().min(0, "Must be 0 or more"),
    misc_amount: z.number().min(0, "Must be 0 or more"),
    remarks: z.string().optional(),
    truck_type: z.enum(["company", "rented"]),
    owner_details: z.string().optional(),
    rent_amount: z.number().min(0, "Must be 0 or more"),
    fuel_station: z.string().optional(),
    status: z.enum(["pending", "in_transit", "completed", "cancelled"]),
    branch_id: z.string().optional(),
  })
  .refine((d) => d.truck_type !== "rented" || !!d.owner_details?.trim(), {
    message: "Owner details are required for rented trucks",
    path: ["owner_details"],
  })

export const driverSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  phone: z.string().optional(),
  license_number: z.string().optional(),
  license_expiry: z.string().optional(),
  address: z.string().optional(),
  monthly_salary: z.number().min(0, "Must be 0 or more"),
  status: z.enum(["active", "inactive"]),
  branch_id: z.string().optional(),
})

export const truckSchema = z
  .object({
    vehicle_number: z.string().trim().min(1, "Vehicle number is required"),
    truck_type: z.enum(["company", "rented"]),
    owner_name: z.string().optional(),
    owner_phone: z.string().optional(),
    make_model: z.string().optional(),
    capacity_tons: z.number().min(0, "Must be 0 or more"),
    status: z.enum(["active", "inactive"]),
    branch_id: z.string().optional(),
  })
  .refine((d) => d.truck_type !== "rented" || !!d.owner_name?.trim(), {
    message: "Owner name is required for rented trucks",
    path: ["owner_name"],
  })

export const documentSchema = z.object({
  truck_id: z.string().min(1, "Select a truck"),
  doc_type: z.enum(["rc", "insurance", "pollution", "fitness", "permit"]),
  doc_number: z.string().optional(),
  issue_date: z.string().optional(),
  expiry_date: z.string().min(1, "Expiry date is required"),
  notes: z.string().optional(),
})

export const salarySchema = z.object({
  person_type: z.enum(["driver", "staff"]),
  driver_id: z.string().optional(),
  staff_id: z.string().optional(),
  person_name: z.string().trim().min(1, "Name is required"),
  month: z.string().min(1, "Month is required"),
  base_salary: z.number().min(0, "Must be 0 or more"),
  bonus: z.number().min(0, "Must be 0 or more"),
  deductions: z.number().min(0, "Must be 0 or more"),
  paid: z.boolean(),
  paid_date: z.string().optional(),
  notes: z.string().optional(),
  branch_id: z.string().optional(),
})

export const fuelStationSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  location: z.string().optional(),
  contact: z.string().optional(),
  status: z.enum(["active", "inactive"]),
})

export const userSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required"),
  email: z.email("Enter a valid email"),
  phone: z.string().optional(),
  role: z.enum(["admin", "staff"]),
  branch_id: z.string().optional(),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .optional()
    .or(z.literal("")),
})

export type DispatchFormValues = z.infer<typeof dispatchSchema>
export type DriverFormValues = z.infer<typeof driverSchema>
export type TruckFormValues = z.infer<typeof truckSchema>
export type DocumentFormValues = z.infer<typeof documentSchema>
export type SalaryFormValues = z.infer<typeof salarySchema>
export type FuelStationFormValues = z.infer<typeof fuelStationSchema>
export type UserFormValues = z.infer<typeof userSchema>

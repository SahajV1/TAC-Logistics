// Domain types mirroring the Postgres schema (supabase/schema.sql).

export type Role = "admin" | "staff"
export type TruckType = "company" | "rented"
export type EntityStatus = "active" | "inactive"
export type DocType = "rc" | "insurance" | "pollution" | "fitness" | "permit"
export type DispatchStatus =
  | "pending"
  | "in_transit"
  | "completed"
  | "cancelled"
export type PersonType = "driver" | "staff"

export interface Branch {
  id: string
  name: string
  created_at: string
}

export interface Profile {
  id: string
  full_name: string
  email: string
  role: Role
  branch_id: string | null
  phone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // joined
  branches?: Pick<Branch, "id" | "name"> | null
}

export interface Driver {
  id: string
  branch_id: string
  name: string
  phone: string | null
  license_number: string | null
  license_expiry: string | null
  address: string | null
  monthly_salary: number
  status: EntityStatus
  created_by: string | null
  created_at: string
  updated_at: string
  branches?: Pick<Branch, "id" | "name"> | null
}

export interface Truck {
  id: string
  branch_id: string
  vehicle_number: string
  truck_type: TruckType
  owner_name: string | null
  owner_phone: string | null
  make_model: string | null
  capacity_tons: number | null
  status: EntityStatus
  created_by: string | null
  created_at: string
  updated_at: string
  branches?: Pick<Branch, "id" | "name"> | null
}

export interface DocumentRow {
  id: string
  truck_id: string
  branch_id: string
  doc_type: DocType
  doc_number: string | null
  issue_date: string | null
  expiry_date: string
  file_url: string | null
  file_name: string | null
  notes: string | null
  is_current: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  trucks?: Pick<Truck, "id" | "vehicle_number"> | null
  branches?: Pick<Branch, "id" | "name"> | null
}

export interface Dispatch {
  id: string
  branch_id: string
  dispatch_date: string
  driver_id: string | null
  driver_name: string
  truck_id: string | null
  vehicle_number: string
  from_location: string
  to_location: string
  fuel_litres: number
  fuel_cost: number
  advance_amount: number
  misc_amount: number
  remarks: string | null
  truck_type: TruckType
  owner_details: string | null
  rent_amount: number
  status: DispatchStatus
  created_by: string | null
  created_at: string
  updated_at: string
  branches?: Pick<Branch, "id" | "name"> | null
}

export interface Salary {
  id: string
  branch_id: string
  person_type: PersonType
  driver_id: string | null
  staff_id: string | null
  person_name: string
  month: string
  base_salary: number
  bonus: number
  deductions: number
  net_salary: number
  paid: boolean
  paid_date: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  branches?: Pick<Branch, "id" | "name"> | null
}

export interface AuditLog {
  id: number
  table_name: string
  record_id: string | null
  action: "INSERT" | "UPDATE" | "DELETE"
  branch_id: string | null
  changed_by: string | null
  changed_by_name: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
}

/** Profile + branch joined, the shape returned by getCurrentUser(). */
export interface SessionUser extends Profile {
  isAdmin: boolean
  branchName: string | null
}

// Seeds the admin + branch staff accounts.
//
// Prerequisites:
//   1. Fill NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
//   2. Run supabase/schema.sql in the Supabase SQL editor (creates branches)
//
// Run:  npm run seed
//
// Re-running is safe: accounts that already exist are skipped.

import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const password = process.env.SEED_DEFAULT_PASSWORD || "Tms@12345"

if (!url || !serviceKey) {
  console.error(
    "✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Fill in .env.local first."
  )
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ============================================================================
// Staff roster + monthly salaries (from the TAC Logistics handover sheet).
// `salary` seeds a row in the salaries table for SALARY_MONTH.
// ============================================================================
const ADMIN = { full_name: "Shivansh", email: "shivansh@tms.local", phone: "" }

const LUCKNOW_STAFF = [
  { full_name: "Anuj Pandey", email: "anuj.pandey@taclogistics.local", salary: 25000 },
  { full_name: "Uttakarsh", email: "uttakarsh@taclogistics.local", salary: 15000 },
  { full_name: "Shivprakash", email: "shivprakash@taclogistics.local", salary: 20000 },
  { full_name: "Aditya", email: "aditya@taclogistics.local", salary: 15000 },
]

const GHAZIABAD_STAFF = [
  { full_name: "Uday Yadav", email: "uday.yadav@taclogistics.local", salary: 30000 },
]

// First day of the salary month these figures apply to.
const SALARY_MONTH = "2026-06-01"
// ============================================================================

async function getBranchId(name) {
  const { data, error } = await supabase
    .from("branches")
    .select("id")
    .eq("name", name)
    .single()
  if (error || !data) {
    throw new Error(
      `Branch "${name}" not found. Did you run supabase/schema.sql? (${error?.message ?? ""})`
    )
  }
  return data.id
}

async function createAccount(person, role, branchId) {
  const { error } = await supabase.auth.admin.createUser({
    email: person.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: person.full_name,
      role,
      branch_id: branchId,
      phone: person.phone ?? "",
    },
  })
  if (error) {
    if (/already|exists|registered/i.test(error.message)) {
      console.log(`•  exists, skipped: ${person.email}`)
    } else {
      console.error(`✗  ${person.email}: ${error.message}`)
    }
    return
  }
  console.log(`✓  created ${role.padEnd(5)} ${person.email}`)
}

// Insert a salary row for a staff member (idempotent per staff + month).
async function seedSalary(person, branchId) {
  if (person.salary == null) return

  const { data: prof } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", person.email)
    .maybeSingle()
  if (!prof) {
    console.log(`   ! no profile for ${person.email} — salary skipped`)
    return
  }

  const { data: existing } = await supabase
    .from("salaries")
    .select("id")
    .eq("staff_id", prof.id)
    .eq("month", SALARY_MONTH)
    .maybeSingle()
  if (existing) {
    console.log(`   •  salary exists: ${person.full_name}`)
    return
  }

  const { error } = await supabase.from("salaries").insert({
    branch_id: branchId,
    person_type: "staff",
    staff_id: prof.id,
    person_name: person.full_name,
    month: SALARY_MONTH,
    base_salary: person.salary,
    bonus: 0,
    deductions: 0,
    paid: false,
  })
  if (error) console.error(`   ✗  salary ${person.full_name}: ${error.message}`)
  else console.log(`   ✓  salary ${person.full_name}: ₹${person.salary}`)
}

async function main() {
  console.log("Seeding accounts…\n")
  const lucknow = await getBranchId("Lucknow")
  const ghaziabad = await getBranchId("Ghaziabad")

  await createAccount(ADMIN, "admin", null)
  for (const s of LUCKNOW_STAFF) await createAccount(s, "staff", lucknow)
  for (const s of GHAZIABAD_STAFF) await createAccount(s, "staff", ghaziabad)

  console.log("\nSeeding salaries…")
  for (const s of LUCKNOW_STAFF) await seedSalary(s, lucknow)
  for (const s of GHAZIABAD_STAFF) await seedSalary(s, ghaziabad)

  console.log(`\nDone. Default password for all accounts: ${password}`)
  console.log("Tell staff to sign in and change it.")
}

main().catch((e) => {
  console.error("\nSeed failed:", e.message)
  process.exit(1)
})

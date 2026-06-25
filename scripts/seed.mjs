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
// EDIT THESE — replace with the real names & emails for the 9 staff + admin.
// (If you only have names, keep the @tms.local emails or change the domain.)
// ============================================================================
const ADMIN = { full_name: "Shivansh", email: "shivansh@tms.local", phone: "" }

const LUCKNOW_STAFF = [
  { full_name: "Sahaj", email: "sahaj@tms.local" },
]

const GHAZIABAD_STAFF = [
  { full_name: "Parth", email: "parth@tms.local" },
]
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

async function main() {
  console.log("Seeding accounts…\n")
  const lucknow = await getBranchId("Lucknow")
  const ghaziabad = await getBranchId("Ghaziabad")

  await createAccount(ADMIN, "admin", null)
  for (const s of LUCKNOW_STAFF) await createAccount(s, "staff", lucknow)
  for (const s of GHAZIABAD_STAFF) await createAccount(s, "staff", ghaziabad)

  console.log(`\nDone. Default password for all accounts: ${password}`)
  console.log("Tell staff to sign in and change it.")
}

main().catch((e) => {
  console.error("\nSeed failed:", e.message)
  process.exit(1)
})

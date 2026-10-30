import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"

// Add fuel stations to the master list so they appear in dropdowns next time.
// Best-effort: a failure here must never block saving the record itself.
// Uses the service-role client so any staff member (not just admins) can grow
// the list from a dispatch or an upload.
export async function rememberFuelStations(names: string[], createdBy: string) {
  if (names.length === 0) return
  try {
    await createAdminClient()
      .from("fuel_stations")
      .upsert(
        names.map((name) => ({ name, created_by: createdBy })),
        { onConflict: "name", ignoreDuplicates: true }
      )
  } catch {
    // table missing / network — ignore, the record still saves
  }
}

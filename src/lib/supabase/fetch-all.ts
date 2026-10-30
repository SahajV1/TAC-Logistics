const PAGE_SIZE = 1000

type Page<T> = { data: T[] | null; error: { message: string } | null }

/**
 * Supabase caps a response at 1000 rows without saying so, which would quietly
 * under-count any total worked out from the fetched rows. Pages through
 * everything instead. `query` must apply `.range(from, to)` and a stable order
 * (finish with `.order("id")`). Returns the same shape as a Supabase query.
 */
export async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<Page<T>>
): Promise<Page<T>> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    rows.push(...(data ?? []))
    if ((data ?? []).length < PAGE_SIZE) return { data: rows, error: null }
  }
}

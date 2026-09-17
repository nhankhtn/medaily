/**
 * A short-lived cache held by the process that serves the request.
 *
 * `React.cache` already dedupes a read *within* one request. This is for the
 * few rows read at the top of every request of every page, where the cost is
 * distance rather than work: the same statement takes about a millisecond of
 * database time and 250ms of flight time from a laptop, 14ms from the deploy.
 *
 * Each instance holds its own copy, so a write on one leaves another stale
 * until the entry expires. Only put things here that can be a few seconds out
 * of date without being wrong, and never anything an ownership check reads —
 * a stale row there would refuse a save the user is entitled to make.
 */

type Entry = { value: unknown; expiresAt: number }

const entries = new Map<string, Entry>()
const loading = new Map<string, Promise<unknown>>()

/**
 * Discarded loads are tracked by a counter rather than a clock: a `forget()`
 * that lands while a read is still in flight has to beat that read to the map,
 * and two events in the same millisecond are common enough to matter.
 */
let tick = 0
const forgottenAt = new Map<string, number>()

export async function remember<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = entries.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.value as T

  // Concurrent callers on a cold key share one read instead of racing.
  const already = loading.get(key)
  if (already) return already as Promise<T>

  const startedAt = ++tick
  const read = load()
    .then((value) => {
      if ((forgottenAt.get(key) ?? 0) < startedAt) {
        entries.set(key, { value, expiresAt: Date.now() + ttlMs })
      }
      return value
    })
    .finally(() => {
      loading.delete(key)
    })

  loading.set(key, read)
  return read
}

/** Called by the write that makes the entry wrong, next to that write. */
export function forget(key: string): void {
  forgottenAt.set(key, ++tick)
  entries.delete(key)
  loading.delete(key)
}

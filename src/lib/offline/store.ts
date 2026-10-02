/**
 * Where work the network would not carry waits. Generic because a daily log is
 * keyed by its date (a second save supersedes) and a transaction by a
 * browser-made id (two coffees are two rows).
 *
 * An interface so the drain can be tested against an array — the only way to
 * assert what happens when the third of five fails.
 */
export type Queued = { queuedAt: number }

export interface PendingStore<T extends Queued> {
  /** Oldest first, which is the order a drain must send them in. */
  list(): Promise<T[]>

  /**
   * Replaces any earlier entry with the same key. **Throws when it cannot
   * store** — the caller has just promised the work is safe on this device.
   */
  put(entry: T): Promise<void>

  remove(key: string): Promise<void>

  /** Drops the oldest beyond `max`, and answers how many went. */
  trim(max: number): Promise<number>

  /** Everything, for sign-out. */
  clear(): Promise<void>
}

/** For the drain's tests, so their assertions are about the drain. */
export function memoryStore<T extends Queued>(
  keyOf: (entry: T) => string,
  initial: T[] = [],
): PendingStore<T> & {
  /** Made to fail, so "the disk is full" is a case the tests can reach. */
  failNextPut: (reason?: string) => void
} {
  let entries = [...initial].sort((a, b) => a.queuedAt - b.queuedAt)
  let failure: string | null = null

  return {
    failNextPut(reason = 'quota exceeded') {
      failure = reason
    },
    async list() {
      return [...entries]
    },
    async put(entry) {
      if (failure !== null) {
        const reason = failure
        failure = null
        throw new Error(reason)
      }
      // Same rule the keyed object store follows: one row per key, newest
      // wins, and the queue stays in the order a drain must walk.
      entries = [...entries.filter((other) => keyOf(other) !== keyOf(entry)), entry].sort(
        (a, b) => a.queuedAt - b.queuedAt,
      )
    },
    async remove(key) {
      entries = entries.filter((entry) => keyOf(entry) !== key)
    },
    async trim(max) {
      if (entries.length <= max) return 0
      const dropped = entries.length - max
      entries = entries.slice(dropped)
      return dropped
    },
    async clear() {
      entries = []
    },
  }
}

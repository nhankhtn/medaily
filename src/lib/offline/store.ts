/**
 * Where work the network would not carry is kept until it can be sent.
 *
 * Generic over what is queued, because the two things worth queueing are not
 * addressed the same way. A daily log is keyed by its date — a second save of
 * a day supersedes the first. A transaction is keyed by an id the browser
 * generated — two coffees on one afternoon are two rows, and the id is what
 * stops a replay turning them into four.
 *
 * An interface rather than a module of functions for two reasons. The drain
 * can be tested against a store that lives in an array, which is the only way
 * to assert what happens when the third of five fails — and the storage
 * underneath can change without the queue's rules moving with it.
 */
export type Queued = { queuedAt: number }

export interface PendingStore<T extends Queued> {
  /** Oldest first, which is the order a drain must send them in. */
  list(): Promise<T[]>

  /**
   * Adds an entry, replacing any earlier one with the same key.
   *
   * **Throws when it cannot store.** The caller has just told someone their
   * work is safe on this device; swallowing a full disk here turns that into
   * a lie they only discover by the work being gone.
   */
  put(entry: T): Promise<void>

  remove(key: string): Promise<void>

  /** Drops the oldest beyond `max`, and answers how many went. */
  trim(max: number): Promise<number>

  /** Everything, for sign-out. */
  clear(): Promise<void>
}

/**
 * A store in an array. Not a fallback — it is what the drain's tests run
 * against, so their assertions are about the drain and not about a browser.
 */
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

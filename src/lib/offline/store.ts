import type { ISODate } from '@/lib/dates'
import { enqueue, type PendingSave } from './pending'

/**
 * Where days logged with no signal are kept until they can be sent.
 *
 * An interface rather than a module of functions for two reasons. The drain
 * can then be tested against a store that lives in an array, which is the only
 * way to assert what happens when the third day of five fails — and the
 * storage underneath can change without the queue's rules moving with it.
 *
 * Addressed by date, because that is the queue's own rule: `saveDay` writes
 * the whole form for a date, so a second save of the same day supersedes the
 * first rather than joining it.
 */
export interface PendingStore {
  /** Oldest first, which is the order a drain must send them in. */
  list(): Promise<PendingSave[]>

  /**
   * Adds a day, replacing any earlier save of it.
   *
   * **Throws when it cannot store.** The caller has just told someone their
   * day is safe on this device; swallowing a full disk here turns that into a
   * lie the user only discovers by the day being gone.
   */
  put(entry: PendingSave): Promise<void>

  remove(date: ISODate): Promise<void>

  /** Drops the oldest beyond `max`, and answers how many went. */
  trim(max: number): Promise<number>

  /** Everything, for sign-out. */
  clear(): Promise<void>
}

/**
 * A store in an array. Not a fallback — it is what the drain's tests run
 * against, so their assertions are about the drain and not about a browser.
 */
export function memoryStore(initial: PendingSave[] = []): PendingStore & {
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
      entries = enqueue(entries, entry)
    },
    async remove(date) {
      entries = entries.filter((pending) => pending.date !== date)
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

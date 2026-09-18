import type { ISODate } from '@/lib/dates'
import type { PendingSave } from './pending'
import type { PendingStore } from './store'

/**
 * The real store: one record per day in IndexedDB.
 *
 * Keyed by date, so adding and removing a day touch one record. The
 * `localStorage` version this replaces read and rewrote the whole queue on
 * every step of a drain — synchronously, on the main thread — which is
 * quadratic work in the number of unsent days and exactly the wrong place for
 * it on a phone.
 *
 * Written against the bare API rather than a wrapper: four operations, no
 * build step, and nothing to keep up to date.
 */
const DB_NAME = 'medaily-offline'
const DB_VERSION = 1
const STORE = 'pending-daily'
const BY_QUEUED_AT = 'queuedAt'

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('indexeddb request failed'))
  })
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexeddb is unavailable'))
      return
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'date' })
        // Ordering and trimming are both by age, so it gets an index rather
        // than a sort over every record.
        store.createIndex(BY_QUEUED_AT, 'queuedAt')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('indexeddb open failed'))
    // A second tab holding an older version open. Rejecting is right: the
    // caller reports that the day could not be kept rather than hanging.
    req.onblocked = () => reject(new Error('indexeddb open blocked'))
  })
}

/**
 * Runs one transaction and resolves when it *commits*.
 *
 * Waiting for the transaction rather than the request is the point: a write
 * over quota fails at commit, and a `put` that resolved on request success
 * would report a day as kept that was then thrown away.
 */
async function run<T>(
  mode: IDBTransactionMode,
  body: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await open()

  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      let result: T

      tx.oncomplete = () => resolve(result)
      tx.onerror = () => reject(tx.error ?? new Error('indexeddb transaction failed'))
      tx.onabort = () => reject(tx.error ?? new Error('indexeddb transaction aborted'))

      Promise.resolve(body(tx.objectStore(STORE)))
        .then((value) => {
          result = value
        })
        .catch((error: unknown) => {
          tx.abort()
          reject(error)
        })
    })
  } finally {
    db.close()
  }
}

export function indexedDbStore(): PendingStore {
  return {
    async list(): Promise<PendingSave[]> {
      return run('readonly', (store) =>
        request(store.index(BY_QUEUED_AT).getAll() as IDBRequest<PendingSave[]>),
      )
    },

    async put(entry: PendingSave): Promise<void> {
      await run('readwrite', async (store) => {
        // `put` on a keyPath store replaces the record for that date, which is
        // the queue's rule — a newer save of a day supersedes the older one.
        await request(store.put(entry))
      })
    },

    async remove(date: ISODate): Promise<void> {
      await run('readwrite', async (store) => {
        await request(store.delete(date))
      })
    },

    async trim(max: number): Promise<number> {
      return run('readwrite', async (store) => {
        const count = await request(store.count())
        const excess = count - max
        if (excess <= 0) return 0

        // Oldest first through the index, deleting until the queue fits.
        let dropped = 0
        await new Promise<void>((resolve, reject) => {
          const cursorReq = store.index(BY_QUEUED_AT).openCursor()
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result
            if (!cursor || dropped >= excess) {
              resolve()
              return
            }
            cursor.delete()
            dropped += 1
            cursor.continue()
          }
          cursorReq.onerror = () => reject(cursorReq.error ?? new Error('indexeddb cursor failed'))
        })

        return dropped
      })
    },

    async clear(): Promise<void> {
      await run('readwrite', async (store) => {
        await request(store.clear())
      })
    },
  }
}

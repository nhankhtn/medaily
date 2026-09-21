import type { PendingStore, Queued } from './store'

/**
 * The real store: one record per queued item in IndexedDB.
 *
 * Keyed, so adding and removing touch one record. A `localStorage` version
 * would read and rewrite the whole queue on every step of a drain —
 * synchronously, on the main thread — which is quadratic work in the number
 * of unsent items and exactly the wrong place for it on a phone.
 *
 * Written against the bare API rather than a wrapper: four operations, no
 * build step, and nothing to keep up to date.
 */
const DB_NAME = 'medaily-offline'

/**
 * Bumped when an object store is added. `onupgradeneeded` creates whichever
 * are missing, so an install that already has the daily queue gains the
 * transactions one without losing what is in it.
 */
const DB_VERSION = 2

export const DAILY_STORE = 'pending-daily'
export const TRANSACTION_STORE = 'pending-transactions'

/** Every store this database holds, and what each one is keyed by. */
const STORES: Record<string, string> = {
  [DAILY_STORE]: 'date',
  [TRANSACTION_STORE]: 'id',
}

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
      for (const [name, keyPath] of Object.entries(STORES)) {
        if (db.objectStoreNames.contains(name)) continue
        const store = db.createObjectStore(name, { keyPath })
        // Ordering and trimming are both by age, so it gets an index rather
        // than a sort over every record.
        store.createIndex(BY_QUEUED_AT, BY_QUEUED_AT)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('indexeddb open failed'))
    // A second tab holding an older version open. Rejecting is right: the
    // caller reports that the work could not be kept rather than hanging.
    req.onblocked = () => reject(new Error('indexeddb open blocked'))
  })
}

/**
 * Runs one transaction and resolves when it *commits*.
 *
 * Waiting for the transaction rather than the request is the point: a write
 * over quota fails at commit, and a `put` that resolved on request success
 * would report work as kept that was then thrown away.
 */
async function run<T>(
  name: string,
  mode: IDBTransactionMode,
  body: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await open()

  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(name, mode)
      let result: T

      tx.oncomplete = () => resolve(result)
      tx.onerror = () => reject(tx.error ?? new Error('indexeddb transaction failed'))
      tx.onabort = () => reject(tx.error ?? new Error('indexeddb transaction aborted'))

      Promise.resolve(body(tx.objectStore(name)))
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

export function indexedDbStore<T extends Queued>(name: string): PendingStore<T> {
  return {
    async list(): Promise<T[]> {
      return run(name, 'readonly', (store) =>
        request(store.index(BY_QUEUED_AT).getAll() as IDBRequest<T[]>),
      )
    },

    async put(entry: T): Promise<void> {
      await run(name, 'readwrite', async (store) => {
        // `put` on a keyPath store replaces the record with that key, which
        // is the rule either queue wants: a newer save of a day supersedes
        // the older one, and a retried transaction lands on itself.
        await request(store.put(entry))
      })
    },

    async remove(key: string): Promise<void> {
      await run(name, 'readwrite', async (store) => {
        await request(store.delete(key))
      })
    },

    async trim(max: number): Promise<number> {
      return run(name, 'readwrite', async (store) => {
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
      await run(name, 'readwrite', async (store) => {
        await request(store.clear())
      })
    },
  }
}

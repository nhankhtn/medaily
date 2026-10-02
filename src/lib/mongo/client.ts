import { MongoClient, type Collection, type Document, type IndexDescription } from 'mongodb'
import { log } from '@/lib/log'

declare global {
  var __medailyMongo: MongoClient | undefined
  var __medailyMongoIndexes: Map<string, Promise<void>> | undefined
}

/**
 * One MongoDB connection for the whole app, and one index bootstrap per
 * collection.
 *
 * The client is cached on `globalThis` for the same reason the Postgres one
 * is: a serverless instance is reused between invocations, and a driver that
 * reconnects per call spends longer on handshakes than on writes.
 *
 * **The memo is keyed by collection, and that is the whole point of this file.**
 * It used to be a single global promise keyed by nothing, which was correct
 * while one collection existed and silently wrong the moment a second one
 * arrived: whichever got there first installed its indexes and every other
 * collection skipped its own entirely. Not slow — wrong, and invisibly so,
 * because a collection small enough to scan in development is a collection
 * that scans in production too.
 */
export function mongoClient(uri: string): MongoClient {
  const existing = globalThis.__medailyMongo
  if (existing) return existing

  const created = new MongoClient(uri, {
    // A stalled connection must not hold a serverless instance open behind it.
    // The trail's writes are already off the response via `after()`; chat reads
    // are not, which is why the pool is larger than one feature would need.
    serverSelectionTimeoutMS: 3_000,
    connectTimeoutMS: 3_000,
    maxPoolSize: 10,
  })

  globalThis.__medailyMongo = created
  return created
}

/**
 * A collection with its indexes in place.
 *
 * `createIndexes` is idempotent and runs once per process per collection —
 * awaited rather than fired and forgotten, so the first write of a cold
 * instance cannot land before the rule that expires it.
 *
 * A failure is logged and the memo cleared, so the next call retries: a
 * missing index makes a query slow, not wrong, and refusing to serve would
 * turn a performance problem into an outage.
 */
export async function readyCollection<T extends Document>(
  uri: string,
  name: string,
  indexes: IndexDescription[],
): Promise<Collection<T>> {
  try {
    return await collectionWithIndexes<T>(uri, name, indexes)
  } catch (error) {
    if (!isTopologyClosed(error)) throw error

    // A client that has been closed stays closed, and this one is cached on
    // `globalThis` — so without this it would be handed out for the life of
    // the instance and every request after the first failure would fail too.
    // Nothing in this app calls `close()`; the driver does, and the only way
    // back is a new client.
    await log.error('mongo', `the connection was closed; reconnecting for ${name}`, error)
    discardClient()
    return collectionWithIndexes<T>(uri, name, indexes)
  }
}

async function collectionWithIndexes<T extends Document>(
  uri: string,
  name: string,
  indexes: IndexDescription[],
): Promise<Collection<T>> {
  const collection = mongoClient(uri).db().collection<T>(name)

  const memo = indexMemo()
  if (!memo.has(name)) {
    memo.set(
      name,
      collection
        .createIndexes(indexes)
        .then(() => undefined)
        .catch(async (error) => {
          memo.delete(name)
          // A dead connection is not an index problem and must not be
          // swallowed as one: it is the one failure the caller can fix, by
          // throwing the client away and starting again.
          if (isTopologyClosed(error)) throw error
          await log.error('mongo', `could not create indexes on ${name}`, error)
        }),
    )
  }

  await memo.get(name)
  return collection
}

/** The driver's own name for it; there is no public way to ask a client. */
function isTopologyClosed(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'MongoTopologyClosedError'
  )
}

/**
 * Throws the cached client away, indexes and all.
 *
 * The index memo goes with it: those promises resolved against a connection
 * that no longer exists, so keeping them would mean the replacement client
 * never builds its indexes and quietly scans instead.
 */
function discardClient(): void {
  const dead = globalThis.__medailyMongo
  globalThis.__medailyMongo = undefined
  globalThis.__medailyMongoIndexes = undefined
  // Best effort, and it must never be the thing that fails: the point of this
  // function is to get back to a working client, not to tidy up the old one.
  try {
    void dead?.close()?.catch?.(() => {})
  } catch {
    /* already gone */
  }
}

/**
 * The memo, whatever was left on the global before it.
 *
 * It is deliberately a different name from the single promise this replaced,
 * because a value of the old shape must never be mistaken for one of the new.
 * A dev server keeps globals across a hot reload, so the first build after the
 * change found a `Promise` where it expected a `Map` and fell over on
 * `memo.has`. The type check is the belt to that braces: a global is shared
 * with whatever else is in the process, and being wrong about its shape is
 * cheaper to survive than to debug.
 */
function indexMemo(): Map<string, Promise<void>> {
  const held = globalThis.__medailyMongoIndexes
  if (held instanceof Map) return held

  const fresh = new Map<string, Promise<void>>()
  globalThis.__medailyMongoIndexes = fresh
  return fresh
}

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
          await log.error('mongo', `could not create indexes on ${name}`, error)
        }),
    )
  }

  await memo.get(name)
  return collection
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

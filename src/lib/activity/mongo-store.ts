import { ObjectId, type Collection } from 'mongodb'
import { env } from '@/lib/env'
import { readyCollection } from '@/lib/mongo/client'
import type { ActivityStore } from './store'
import { isActivityAction, type ActivityPage, type ActivityRecord, type Snapshot } from './types'

const COLLECTION = 'activity'

/**
 * The MongoDB adapter. Everything Mongo-shaped stops here: the driver, the
 * TTL index, `ObjectId`, and the cursor's encoding. A service that swaps this
 * for a Postgres one changes a line in `provider.ts` and nothing else.
 *
 * The connection and the index bootstrap are shared — see `lib/mongo/client`.
 * This file owns only what is true of the trail: its two indexes, including
 * the TTL that no other collection here wants.
 */
export function mongoActivityStore(uri: string): ActivityStore {
  return {
    id: 'mongo',

    append: async (record) => {
      const collection = await ready(uri)
      await collection.insertOne(record)
    },

    list: async (userId, { cursor, limit }) => {
      const collection = await ready(uri)
      const after = decodeCursor(cursor)

      // Keyset on `_id`, which for an ObjectId is monotonic in creation time
      // and unique — so it orders and breaks ties in one field. Asking for one
      // more row than requested is how the page knows whether another exists
      // without a second count query.
      const rows = await collection
        .find(
          { userId, ...(after ? { _id: { $lt: after } } : {}) },
          { sort: { _id: -1 }, limit: limit + 1 },
        )
        .toArray()

      const page = rows.slice(0, limit)
      const items = page.flatMap((row) =>
        // A row written by an older deploy may name an action this build has
        // no label for. Skipping beats printing a raw key at a reader.
        isActivityAction(row.action)
          ? [
              {
                id: String(row._id),
                at: row.at.toISOString(),
                action: row.action,
                entityId: row.entityId ?? null,
                label: row.label ?? null,
                current: readSnapshot(row.current),
                request: readSnapshot(row.request),
              },
            ]
          : [],
      )

      return {
        items,
        // The cursor is the last row *read*, not the last one shown: a page
        // made entirely of skipped rows must still move forward, or paging
        // stalls on a deploy that renamed an action.
        nextCursor: rows.length > limit ? encodeCursor(page.at(-1)?._id) : null,
      } satisfies ActivityPage
    },

    deleteAllFor: async (userId) => {
      const collection = await ready(uri)
      await collection.deleteMany({ userId })
    },
  }
}

/**
 * A stored document is whatever an older deploy wrote, so a snapshot is
 * checked rather than cast. These two arrived after the first rows did: those
 * hold no such key, and reading them has to give nothing, not a crash in
 * Settings. Values are strings by the time they are stored, so anything else
 * in there was written by something that is not this app.
 */
function readSnapshot(stored: unknown): Snapshot | null {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return null
  const out: Snapshot = {}
  for (const [field, value] of Object.entries(stored as Record<string, unknown>)) {
    if (typeof value === 'string') out[field] = value
    else if (value === null) out[field] = null
  }
  return Object.keys(out).length > 0 ? out : null
}

/** Opaque to callers, so the port never leaks that this one is an ObjectId. */
function encodeCursor(id: ObjectId | undefined): string | null {
  return id ? Buffer.from(id.toHexString(), 'utf8').toString('base64url') : null
}

/**
 * A cursor that does not decode restarts paging, which costs one page. Guessing
 * at it would silently skip rows — the same call the ledger's cursor makes.
 */
function decodeCursor(raw: string | null | undefined): ObjectId | null {
  if (!raw) return null
  try {
    const hex = Buffer.from(raw, 'base64url').toString('utf8')
    return ObjectId.isValid(hex) ? new ObjectId(hex) : null
  } catch {
    return null
  }
}

/**
 * The collection with its indexes in place. The TTL lives here and nowhere
 * else: it is right for a trail that must not grow forever, and wrong for
 * everything else this database holds.
 */
async function ready(uri: string): Promise<Collection<ActivityRecord>> {
  return readyCollection<ActivityRecord>(uri, COLLECTION, [
    // The only read there is: one person's trail, newest first.
    { key: { userId: 1, _id: -1 }, name: 'user_id_desc' },
    // A log that grows forever is a liability rather than an asset, so the
    // database expires it rather than trusting anyone to remember.
    { key: { at: 1 }, name: 'ttl', expireAfterSeconds: env.ACTIVITY_LOG_DAYS * 86_400 },
  ])
}

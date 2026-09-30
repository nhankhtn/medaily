import { MongoClient } from 'mongodb'
import { afterAll, beforeEach, describe, it } from 'vitest'
import { mongoChatStore } from '@/lib/chat/mongo-store'
import { describeChatStore } from '../shared/chat-store-contract'

const uri = process.env.MONGODB_TEST_URI

/**
 * The same contract the in-memory fake answers, put to the real database.
 *
 * Skipped without `MONGODB_TEST_URI`, so `pnpm test` works on a machine with
 * no mongod — the fake still covers the shape, this covers the driver, the
 * unique indexes and the atomic invite spend.
 */
if (!uri) {
  describe.skip('chat on mongodb (set MONGODB_TEST_URI to run)', () => {
    it('is skipped', () => {})
  })
} else {
  const client = new MongoClient(uri)
  const connected = client.connect()

  const COLLECTIONS = ['chat_rooms', 'chat_members', 'chat_messages', 'chat_invites']

  beforeEach(async () => {
    await connected
    // Only this feature's collections, never the whole database: the activity
    // trail's suite points at the same `MONGODB_TEST_URI`, and dropping out
    // from under it fails 45 of its tests for reasons that look like its own.
    for (const name of COLLECTIONS) await client.db().collection(name).deleteMany({})
    // The memo remembers indexes on collections that may now be empty; clearing
    // it makes each test start from the same place.
    globalThis.__medailyMongoIndexes = undefined
  })

  afterAll(async () => {
    for (const name of COLLECTIONS)
      await client
        .db()
        .collection(name)
        .drop()
        .catch(() => {})
    await client.close()
    await globalThis.__medailyMongo?.close()
  })

  describeChatStore('mongodb', async () => mongoChatStore(uri))
}

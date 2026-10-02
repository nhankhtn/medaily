import { MongoClient } from 'mongodb'
import { randomBytes } from 'node:crypto'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
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

  describe('mongodb: what a room stores', () => {
    const saved = process.env.CHAT_MESSAGE_KEY
    afterEach(() => {
      if (saved === undefined) delete process.env.CHAT_MESSAGE_KEY
      else process.env.CHAT_MESSAGE_KEY = saved
    })

    const room = (id: string, encryption: 'locked' | 'plain') => ({
      id,
      kind: 'group' as const,
      title: 'Phòng',
      createdBy: 'u1',
      doorbellKey: `door-${id}`,
      directKey: null,
      encryption,
    })
    const say = (roomId: string, body: string) => ({
      roomId,
      userId: 'u1',
      body,
      clientId: `c-${roomId}-${body}`,
      kind: 'text' as const,
    })
    const raw = (roomId: string) => client.db().collection('chat_messages').findOne({ roomId })

    it('writes a plain room in the clear with its folded copy, even with a key set', async () => {
      process.env.CHAT_MESSAGE_KEY = randomBytes(32).toString('base64')
      const store = mongoChatStore(uri)
      await store.createRoom(room('p1', 'plain'))
      await store.appendMessage(say('p1', 'Đi họp'))

      const doc = await raw('p1')
      expect(doc).toMatchObject({ body: 'Đi họp', bodyFold: 'di hop' })
      expect(doc).not.toHaveProperty('bodyEnc')
    })

    it('locks a locked room, and keeps no folded copy', async () => {
      process.env.CHAT_MESSAGE_KEY = randomBytes(32).toString('base64')
      const store = mongoChatStore(uri)
      await store.createRoom(room('l1', 'locked'))
      const sent = await store.appendMessage(say('l1', 'bí mật'))

      const doc = await raw('l1')
      expect(doc).toHaveProperty('bodyEnc')
      expect(doc).not.toHaveProperty('body')
      expect(doc).not.toHaveProperty('bodyFold')
      expect(sent.body).toBe('bí mật')
    })

    it('refuses to write a locked room in the clear when the key is gone', async () => {
      delete process.env.CHAT_MESSAGE_KEY
      const store = mongoChatStore(uri)
      await store.createRoom(room('l2', 'locked'))

      await expect(store.appendMessage(say('l2', 'lộ'))).rejects.toThrow(/CHAT_MESSAGE_KEY/)
      expect(await raw('l2')).toBeNull()
    })

    it('reads a room from before the choice as legacy', async () => {
      await client
        .db()
        .collection('chat_rooms')
        .insertOne({
          _id: 'old' as never,
          kind: 'group',
          title: 'Cũ',
          createdBy: 'u1',
          doorbellKey: 'door-old',
          lastMessageAt: null,
          createdAt: new Date(),
        })
      expect((await mongoChatStore(uri).findRoom('old'))?.encryption).toBe('legacy')
    })

    it('clears the folded copy when a message is recalled', async () => {
      const store = mongoChatStore(uri)
      await store.createRoom(room('p2', 'plain'))
      const sent = await store.appendMessage(say('p2', 'họp'))
      await store.softDeleteMessage('p2', sent.id, 'u1')

      const doc = await raw('p2')
      expect(doc).not.toHaveProperty('body')
      expect(doc).not.toHaveProperty('bodyFold')
    })
  })
}

import { randomUUID } from 'node:crypto'
import { MongoClient } from 'mongodb'
import { afterAll, describe, expect, it } from 'vitest'
import { mongoActivityStore } from '@/lib/activity/mongo-store'
import type { ActivityRecord } from '@/lib/activity/types'

/**
 * The Mongo adapter against a real MongoDB, checked by the same claims the
 * in-memory one answers in `tests/unit/activity-store.test.ts`.
 *
 * Two stores passing one list of statements is what makes the port a boundary
 * rather than a wish. A Postgres adapter added later runs this file's body
 * against itself and nothing here changes.
 */
const uri = process.env.MONGODB_TEST_URI
const describeMongo = uri ? describe : describe.skip

describeMongo('the Mongo store keeps the ActivityStore contract', () => {
  const store = mongoActivityStore(uri as string)
  const users: string[] = []

  /** A fresh id per test, so one database serves them all without collisions. */
  const someone = () => {
    const id = randomUUID()
    users.push(id)
    return id
  }

  afterAll(async () => {
    for (const id of users) await store.deleteAllFor(id)
    await new MongoClient(uri as string).close().catch(() => {})
    await globalThis.__medailyMongo?.close()
  })

  const entry = (userId: string, label: string): ActivityRecord => ({
    userId,
    at: new Date(),
    action: 'transaction.create',
    entityId: null,
    label,
    requestId: null,
  })

  it('returns what it was given, newest first', async () => {
    const me = someone()
    await store.append(entry(me, 'older'))
    await store.append(entry(me, 'newer'))

    const page = await store.list(me, { limit: 10 })
    expect(page.items.map((row) => row.label)).toEqual(['newer', 'older'])
  })

  it('never returns somebody else’s trail', async () => {
    const me = someone()
    const them = someone()
    await store.append(entry(me, 'mine'))
    await store.append(entry(them, 'theirs'))

    expect((await store.list(me, { limit: 10 })).items.map((r) => r.label)).toEqual(['mine'])
  })

  it('says there is no next page when the trail fits', async () => {
    const me = someone()
    await store.append(entry(me, 'only'))
    expect((await store.list(me, { limit: 10 })).nextCursor).toBeNull()
  })

  it('walks the whole trail without a gap or a repeat', async () => {
    const me = someone()
    for (let i = 0; i < 7; i++) await store.append(entry(me, `row-${i}`))

    const seen: string[] = []
    let cursor: string | null | undefined
    for (let guard = 0; guard < 10; guard++) {
      const page = await store.list(me, { cursor, limit: 3 })
      seen.push(...page.items.map((row) => row.label ?? ''))
      cursor = page.nextCursor
      if (!cursor) break
    }

    expect(seen).toEqual(['row-6', 'row-5', 'row-4', 'row-3', 'row-2', 'row-1', 'row-0'])
    expect(new Set(seen).size).toBe(7)
  })

  it('starts over on a cursor it cannot place, rather than skipping rows', async () => {
    const me = someone()
    await store.append(entry(me, 'only'))

    const page = await store.list(me, { cursor: 'not-a-cursor', limit: 10 })
    expect(page.items.map((row) => row.label)).toEqual(['only'])
  })

  it('erases one person and leaves the other', async () => {
    const me = someone()
    const them = someone()
    await store.append(entry(me, 'mine'))
    await store.append(entry(them, 'theirs'))

    await store.deleteAllFor(me)

    expect((await store.list(me, { limit: 10 })).items).toEqual([])
    expect((await store.list(them, { limit: 10 })).items).toHaveLength(1)
  })

  it('erases an account that never wrote anything without complaining', async () => {
    await expect(store.deleteAllFor(randomUUID())).resolves.toBeUndefined()
  })

  /** A log that grows forever is a liability, so the expiry is not optional. */
  it('lets the database expire the trail rather than trusting anyone to prune', async () => {
    const me = someone()
    await store.append(entry(me, 'indexes please'))

    const indexes = await globalThis.__medailyMongo!.db().collection('activity').indexes()
    const ttl = indexes.find((index) => index.name === 'ttl')
    expect(ttl?.expireAfterSeconds).toBeGreaterThan(0)
    expect(indexes.map((index) => index.name)).toContain('user_id_desc')
  })
})

import { randomUUID } from 'node:crypto'
import { inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { logicalDateOf } from '@/lib/dates'
import * as schema from '@/lib/db/schema'

/**
 * Who the evening reminder reaches. Either a daily log or a transaction dated
 * today counts as having written something down; a person with no device
 * cannot be told and is never asked about.
 */
const sent = vi.hoisted(() => ({ audiences: [] as string[][] }))
vi.mock('@/server/services/push', () => ({
  notify: async (userIds: string[]) => {
    sent.audiences.push(userIds)
    return { sent: userIds.length, dropped: 0, failed: 0 }
  },
}))

const url = process.env.DATABASE_URL
const describeDb = url ? describe : describe.skip

describeDb('evening reminder', () => {
  const client = postgres(url ?? '', { max: 2 })
  const db = drizzle(client, { schema })

  const blank = randomUUID()
  const logged = randomUUID()
  const spent = randomUUID()
  const unreachable = randomUUID()
  const everyone = [blank, logged, spent, unreachable]

  const now = new Date()
  const today = logicalDateOf(now, {
    timezone: 'Asia/Ho_Chi_Minh',
    dayRolloverHour: 4,
    weekStart: 'monday',
  })

  beforeAll(async () => {
    for (const id of everyone) {
      await db.insert(schema.users).values({ id, displayName: id, email: `${id}@example.com` })
      await db.insert(schema.userSettings).values({ userId: id })
    }
    for (const id of [blank, logged, spent]) {
      await db.insert(schema.pushDevices).values({ userId: id, token: `token-${id}` })
    }

    await db.insert(schema.dailyLogs).values({ userId: logged, logDate: today })

    const [account] = await db
      .insert(schema.accounts)
      .values({ userId: spent, name: 'Wallet' })
      .returning()
    await db.insert(schema.transactions).values({
      userId: spent,
      accountId: account!.id,
      occurredOn: today,
      amount: '35000',
      kind: 'expense',
    })
  })

  afterAll(async () => {
    await db.delete(schema.users).where(inArray(schema.users.id, everyone))
    await client.end()
  })

  it('reminds only the person with a device and nothing written today', async () => {
    const { remindBlankDays } = await import('@/server/services/log-reminder')
    await remindBlankDays(now)

    // The table is shared with whatever else the local database holds, so
    // only the people this test made are looked at.
    const reached = sent.audiences.flat().filter((id) => everyone.includes(id))
    expect(reached).toEqual([blank])
  })
})

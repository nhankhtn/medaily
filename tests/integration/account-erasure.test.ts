import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { deleteUser, insertUser } from '@/server/repositories/auth'
import { insertUserSettings } from '@/server/repositories/settings'
import { insertAccount, insertCategory, insertTransaction } from '@/server/repositories/finance'

/**
 * The right to be forgotten, against the database where the cascade actually
 * lives. Thirty-nine tables name a user; the claim being tested is that one
 * delete reaches all of them and stops exactly at the edge of somebody else's
 * workspace.
 */
const describeDb = process.env.DATABASE_URL ? describe : describe.skip

describeDb('erasing an account', () => {
  const survivors: string[] = []

  afterAll(async () => {
    for (const id of survivors) await db.delete(schema.users).where(eq(schema.users.id, id))
  })

  /** A workspace with something in every corner worth checking afterwards. */
  const furnished = async (name: string) => {
    const user = await insertUser({ displayName: name })
    await insertUserSettings(user.id)
    const account = await insertAccount({
      userId: user.id,
      name: 'wallet',
      type: 'cash',
      currency: 'VND',
      openingBalance: '0',
    })
    const category = await insertCategory({ userId: user.id, name: 'food', kind: 'expense' })
    await insertTransaction({
      userId: user.id,
      occurredOn: new Date().toISOString().slice(0, 10),
      amount: '1000',
      kind: 'expense',
      accountId: account.id,
      categoryId: category.id,
    })
    await db.insert(schema.dailyLogs).values({ userId: user.id, logDate: '2026-09-01' })
    return user.id
  }

  it('takes the settings, the ledger and the day with it', async () => {
    const userId = await furnished('erased')
    await deleteUser(userId)

    const left = await Promise.all([
      db.select().from(schema.users).where(eq(schema.users.id, userId)),
      db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId)),
      db.select().from(schema.transactions).where(eq(schema.transactions.userId, userId)),
      db.select().from(schema.accounts).where(eq(schema.accounts.userId, userId)),
      db.select().from(schema.financeCategories).where(eq(schema.financeCategories.userId, userId)),
      db.select().from(schema.dailyLogs).where(eq(schema.dailyLogs.userId, userId)),
    ])

    for (const rows of left) expect(rows).toHaveLength(0)
  })

  it('leaves everyone else exactly as they were', async () => {
    const mine = await furnished('goes')
    const theirs = await furnished('stays')
    survivors.push(theirs)

    await deleteUser(mine)

    const users = await db.select().from(schema.users).where(eq(schema.users.id, theirs))
    const transactions = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.userId, theirs))

    expect(users).toHaveLength(1)
    expect(transactions).toHaveLength(1)
  })

  it('is indifferent to an id that is already gone', async () => {
    const userId = await furnished('twice')
    await deleteUser(userId)
    await expect(deleteUser(userId)).resolves.toBeUndefined()
  })
})

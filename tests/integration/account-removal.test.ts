import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import {
  countAccountTransactions,
  deleteAccount,
  findAccountBalances,
  insertAccount,
  insertTransaction,
  updateAccount,
} from '@/server/repositories/finance'

/**
 * Removing an account has two outcomes and the ledger picks between them, so
 * the thing worth proving is what survives each one — against a real database,
 * where the cascade that makes this delicate actually lives.
 */
const describeDb = process.env.DATABASE_URL ? describe : describe.skip

describeDb('removing an account', () => {
  const userId = randomUUID()
  const today = new Date().toISOString().slice(0, 10)

  beforeAll(async () => {
    await db.insert(schema.users).values({ id: userId, displayName: 'test' })
    await db.insert(schema.userSettings).values({ userId })
  })

  afterAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.id, userId))
  })

  const account = (name: string) =>
    insertAccount({ userId, name, type: 'bidv', currency: 'VND', openingBalance: '0' })

  it('counts a transfer from both ends', async () => {
    const from = await account('from')
    const to = await account('to')
    await insertTransaction({
      userId,
      occurredOn: today,
      amount: '1000',
      kind: 'transfer',
      accountId: from.id,
      counterAccountId: to.id,
    })

    expect(await countAccountTransactions(userId, from.id)).toBe(1)
    expect(await countAccountTransactions(userId, to.id)).toBe(1)
  })

  it('deletes one nobody ever used', async () => {
    const unused = await account('unused')
    await deleteAccount(userId, unused.id)

    const left = await findAccountBalances(userId)
    expect(left.map((row) => row.accountId)).not.toContain(unused.id)
  })

  it('hides one that has history, and keeps the history', async () => {
    const used = await account('used')
    await insertTransaction({
      userId,
      occurredOn: today,
      amount: '250',
      kind: 'expense',
      accountId: used.id,
    })

    await updateAccount(userId, used.id, { archivedAt: new Date() })

    const shown = await findAccountBalances(userId)
    expect(shown.map((row) => row.accountId)).not.toContain(used.id)
    expect(await countAccountTransactions(userId, used.id)).toBe(1)
  })

  it('will not remove an account belonging to someone else', async () => {
    const mine = await account('mine')
    await deleteAccount(randomUUID(), mine.id)

    const still = await findAccountBalances(userId)
    expect(still.map((row) => row.accountId)).toContain(mine.id)
  })
})

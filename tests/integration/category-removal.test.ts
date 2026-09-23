import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import {
  countCategoryUsage,
  deleteCategory,
  findCategories,
  insertAccount,
  insertCategory,
  insertTransaction,
  updateCategory,
} from '@/server/repositories/finance'

/**
 * A category answers to three foreign keys and they do not agree: transactions
 * and recurring rows are set to null, budgets cascade. So the thing worth
 * proving against a real database is which of them survive a delete — that
 * difference is the whole reason a used category is hidden rather than removed.
 */
const describeDb = process.env.DATABASE_URL ? describe : describe.skip

describeDb('removing a category', () => {
  const userId = randomUUID()
  const today = new Date().toISOString().slice(0, 10)
  let accountId: string

  beforeAll(async () => {
    await db.insert(schema.users).values({ id: userId, displayName: 'test' })
    await db.insert(schema.userSettings).values({ userId })
    const account = await insertAccount({
      userId,
      name: 'wallet',
      type: 'bidv',
      currency: 'VND',
      openingBalance: '0',
    })
    accountId = account.id
  })

  afterAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.id, userId))
  })

  const category = (name: string) => insertCategory({ userId, name, kind: 'expense' })

  it('counts nothing for a category nobody filed anything under', async () => {
    const fresh = await category('fresh')
    expect(await countCategoryUsage(userId, fresh.id)).toEqual({
      transactions: 0,
      recurring: 0,
      budgets: 0,
    })
  })

  it('counts a transaction and a budget separately', async () => {
    const used = await category('counted')
    await insertTransaction({
      userId,
      occurredOn: today,
      amount: '1000',
      kind: 'expense',
      accountId,
      categoryId: used.id,
    })
    await db
      .insert(schema.budgets)
      .values({ userId, categoryId: used.id, periodStart: `${today.slice(0, 7)}-01`, amount: '50' })

    expect(await countCategoryUsage(userId, used.id)).toEqual({
      transactions: 1,
      recurring: 0,
      budgets: 1,
    })
  })

  it('deletes one nobody ever used', async () => {
    const unused = await category('unused')
    await deleteCategory(userId, unused.id)

    const left = await findCategories(userId)
    expect(left.map((row) => row.id)).not.toContain(unused.id)
  })

  it('hides one in use, and the transactions keep pointing at it', async () => {
    const used = await category('hidden')
    await insertTransaction({
      userId,
      occurredOn: today,
      amount: '250',
      kind: 'expense',
      accountId,
      categoryId: used.id,
    })

    await updateCategory(userId, used.id, { archivedAt: new Date() })

    const shown = await findCategories(userId)
    expect(shown.map((row) => row.id)).not.toContain(used.id)
    expect((await countCategoryUsage(userId, used.id)).transactions).toBe(1)
  })

  /** The reason a used category is never deleted: this is what it would cost. */
  it('would take the budgets with it, which is why a used one is not deleted', async () => {
    const doomed = await category('doomed')
    await db.insert(schema.budgets).values({
      userId,
      categoryId: doomed.id,
      periodStart: `${today.slice(0, 7)}-01`,
      amount: '75',
    })

    await deleteCategory(userId, doomed.id)

    const budgets = await db
      .select()
      .from(schema.budgets)
      .where(eq(schema.budgets.categoryId, doomed.id))
    expect(budgets).toHaveLength(0)
  })

  it('will not remove a category belonging to someone else', async () => {
    const mine = await category('mine')
    await deleteCategory(randomUUID(), mine.id)

    const still = await findCategories(userId)
    expect(still.map((row) => row.id)).toContain(mine.id)
  })
})

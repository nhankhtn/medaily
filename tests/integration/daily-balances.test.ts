import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { insertUser } from '@/server/repositories/auth'
import { insertUserSettings } from '@/server/repositories/settings'
import {
  findAccountBalances,
  findDailyBalances,
  insertAccount,
  insertTransaction,
} from '@/server/repositories/finance'

/**
 * A balance line is drawn from arithmetic that already exists in
 * `v_account_balances`, stopped at each day instead of only at the end. What
 * is worth proving is that the two agree, and that the three things a naive
 * running total gets wrong are handled: a day with no transaction, a transfer
 * counted from both sides, and history older than the window.
 */
const describeDb = process.env.DATABASE_URL ? describe : describe.skip

describeDb('the daily balance line', () => {
  const created: string[] = []

  afterAll(async () => {
    for (const id of created) await db.delete(schema.users).where(eq(schema.users.id, id))
  })

  const workspace = async (opening = '1000') => {
    const user = await insertUser({ displayName: 'balances' })
    created.push(user.id)
    await insertUserSettings(user.id)
    const account = await insertAccount({
      userId: user.id,
      name: 'wallet',
      type: 'cash',
      currency: 'VND',
      openingBalance: opening,
    })
    return { userId: user.id, accountId: account.id }
  }

  const spend = (userId: string, accountId: string, on: string, amount: string) =>
    insertTransaction({ userId, accountId, occurredOn: on, amount, kind: 'expense' })

  it('carries the last balance across a day with no transaction', async () => {
    const { userId, accountId } = await workspace('1000')
    await spend(userId, accountId, '2026-09-10', '300')

    const points = await findDailyBalances(userId, { start: '2026-09-09', end: '2026-09-12' })
    expect(points.map((p) => p.balance)).toEqual([1000, 700, 700, 700])
    expect(points.every((p) => p.accountId === accountId)).toBe(true)
  })

  /** A window that starts after the spending must not redraw it from zero. */
  it('folds history older than the window into the opening balance', async () => {
    const { userId, accountId } = await workspace('1000')
    await spend(userId, accountId, '2026-08-01', '400')

    const points = await findDailyBalances(userId, { start: '2026-09-01', end: '2026-09-02' })
    expect(points.map((p) => p.balance)).toEqual([600, 600])
  })

  it('moves a transfer out of one account and into the other on the same day', async () => {
    const { userId, accountId } = await workspace('1000')
    const other = await insertAccount({
      userId,
      name: 'bank',
      type: 'bank',
      currency: 'VND',
      openingBalance: '0',
    })
    await insertTransaction({
      userId,
      accountId,
      counterAccountId: other.id,
      occurredOn: '2026-09-05',
      amount: '250',
      kind: 'transfer',
    })

    const points = await findDailyBalances(userId, { start: '2026-09-05', end: '2026-09-05' })
    const byAccount = new Map(points.map((p) => [p.accountId, p.balance]))
    expect(byAccount.get(accountId)).toBe(750)
    expect(byAccount.get(other.id)).toBe(250)
    // The pair nets to zero: a transfer moves money, it does not make any.
    expect([...byAccount.values()].reduce((a, b) => a + b, 0)).toBe(1000)
  })

  /** The line's last point is the number the rest of the app already shows. */
  it('ends on the same balance the account board prints', async () => {
    const { userId, accountId } = await workspace('5000')
    await spend(userId, accountId, '2026-09-03', '1200')
    await insertTransaction({
      userId,
      accountId,
      occurredOn: '2026-09-07',
      amount: '800',
      kind: 'income',
    })

    const [board] = await findAccountBalances(userId)
    const points = await findDailyBalances(userId, { start: '2026-09-01', end: '2026-09-20' })
    expect(points.at(-1)?.balance).toBe(board?.balance)
    expect(points.at(-1)?.balance).toBe(4600)
  })

  it('returns a point for every day, so the line has no holes', async () => {
    const { userId } = await workspace()
    const points = await findDailyBalances(userId, { start: '2026-09-01', end: '2026-09-30' })
    expect(points).toHaveLength(30)
  })
})

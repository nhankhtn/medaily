import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { insertUser } from '@/server/repositories/auth'
import {
  decodeTransactionCursor,
  findTransactionsPage,
  insertAccount,
  insertTransaction,
} from '@/server/repositories/finance'

/**
 * The seam between two pages, against the database that decides the order.
 *
 * Ids are random uuids, so a day's rows have no natural order of their own.
 * The claim tested here is that `created_at` gives them one, and that stepping
 * through it a page at a time returns every row exactly once — the failure it
 * guards against is a row seen twice, or never, at a page boundary.
 */
const describeDb = process.env.DATABASE_URL ? describe : describe.skip

describeDb('paging the ledger', () => {
  const users: string[] = []

  afterAll(async () => {
    for (const id of users) await db.delete(schema.users).where(eq(schema.users.id, id))
  })

  /** Twelve rows on one day, entered a minute apart, in a deliberate jumble. */
  const ledgerOf = async () => {
    const user = await insertUser({ displayName: 'paging fixture' })
    users.push(user.id)
    const account = await insertAccount({
      userId: user.id,
      name: 'wallet',
      type: 'cash',
      currency: 'VND',
      openingBalance: '0',
    })

    const entered: string[] = []
    for (let minute = 0; minute < 12; minute++) {
      const row = await insertTransaction({
        userId: user.id,
        accountId: account.id,
        occurredOn: '2026-09-26',
        amount: String(1000 + minute),
        kind: 'expense',
        merchant: `row ${minute}`,
        createdAt: new Date(Date.UTC(2026, 8, 26, 3, minute)),
      })
      if (row) entered.push(row.id)
    }
    return { userId: user.id, entered }
  }

  it('walks every row exactly once, three at a time', async () => {
    const { userId, entered } = await ledgerOf()

    const seen: string[] = []
    let cursor = null
    for (let page = 0; page < 10; page++) {
      const result = await findTransactionsPage(userId, { limit: 3, cursor })
      seen.push(...result.items.map((row) => row.id))
      if (!result.nextCursor) break
      cursor = decodeTransactionCursor(result.nextCursor)
      expect(cursor).not.toBeNull()
    }

    expect(seen).toHaveLength(entered.length)
    expect(new Set(seen).size).toBe(entered.length)
    // Newest entry first: the reverse of the order they went in.
    expect(seen).toEqual([...entered].reverse())
  })

  it('puts a row entered later above one entered earlier on the same day', async () => {
    const { userId, entered } = await ledgerOf()
    const { items } = await findTransactionsPage(userId, { limit: 50 })
    expect(items[0]!.id).toBe(entered.at(-1))
  })

  it('refuses a cursor from the older two-part format rather than guessing', () => {
    const stale = Buffer.from('2026-09-26|11111111-1111-4111-8111-111111111111', 'utf8').toString(
      'base64url',
    )
    expect(decodeTransactionCursor(stale)).toBeNull()
  })
})

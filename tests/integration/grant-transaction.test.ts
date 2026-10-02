import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import * as schema from '@/lib/db/schema'

// Nothing to notify in a test database, and a push attempt would be a network
// call in the middle of an assertion about a row.
vi.mock('@/server/services/push', () => ({ notify: vi.fn(async () => undefined) }))

const url = process.env.DATABASE_URL
const describeDb = url ? describe : describe.skip

/**
 * What the endpoint writes, which is the part that cannot be asserted without
 * a database: the right column, and the same id twice landing once.
 */
describeDb('filing a transaction through a grant', () => {
  const client = postgres(url ?? '', { max: 2 })
  const db = drizzle(client, { schema })

  const userId = randomUUID()
  const personId = randomUUID()
  const accountId = randomUUID()
  const categoryId = randomUUID()
  const otherCategoryId = randomUUID()

  const grant = {
    ownerUserId: userId,
    payeePersonId: personId,
    accountId,
    categoryId,
    maxAmount: 200_000,
  }

  beforeAll(async () => {
    await db.insert(schema.users).values({ id: userId, displayName: 'grant test' })
    await db.insert(schema.people).values({ id: personId, userId, name: 'A' })
    await db
      .insert(schema.accounts)
      .values({ id: accountId, userId, name: 'Ví tiền mặt', type: 'cash' })
    await db.insert(schema.financeCategories).values([
      { id: categoryId, userId, name: 'Ăn sáng', kind: 'expense' },
      { id: otherCategoryId, userId, name: 'Cà phê', kind: 'expense' },
    ])
  })

  afterAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.id, userId))
    await client.end()
  })

  const file = async (over: Partial<Parameters<typeof call>[1]> = {}) => call(grant, over)

  async function call(
    claims: typeof grant,
    over: {
      amount?: number
      occurredOn?: string
      category?: string | null
      merchant?: string | null
      clientId?: string
    },
  ) {
    const { fileGrantedTransaction } = await import('@/server/services/grant-transaction')
    return fileGrantedTransaction(claims, {
      amount: over.amount ?? 15_000,
      occurredOn: (over.occurredOn ?? '2026-10-02') as never,
      category: over.category,
      merchant: over.merchant,
      clientId: over.clientId ?? randomUUID(),
    })
  }

  /**
   * `payeePersonId`, never `personId`. The latter is a debt and is excluded
   * from spending totals, so filing it there would make the money vanish from
   * the month's report with nothing to show for it.
   */
  it('records who covered it without turning it into a debt', async () => {
    const result = await file({ merchant: 'bánh mì' })
    expect(result.ok).toBe(true)

    const [row] = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, result.ok ? result.id : ''))

    expect(row?.payeePersonId).toBe(personId)
    expect(row?.personId, 'a debt would be left out of spending totals').toBeNull()
    expect(row?.transferredAt, 'still owed until it is settled').toBeNull()
    expect(row?.kind).toBe('expense')
    expect(row?.amount).toBe('15000.00')
    expect(row?.categoryId).toBe(categoryId)
  })

  it('files once however many times the same id arrives', async () => {
    const clientId = randomUUID()
    // A day of its own: the duplicate rule would otherwise refuse the second
    // call for clashing with another test's row rather than with its own.
    const first = await file({ clientId, occurredOn: '2026-10-24' })
    const again = await file({ clientId, occurredOn: '2026-10-24' })

    expect(first.ok).toBe(true)
    expect(again).toEqual({ ok: false, error: 'conflict' })

    const rows = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, clientId))
    expect(rows).toHaveLength(1)
  })

  /**
   * (date, category, payee) is what the endpoint treats as one meal. Filing
   * Wednesday's lunch again — covered by the same person, under a new id — is
   * that same lunch, whether the owner typed it first or the caller is sending
   * it twice.
   */
  it('refuses a second expense for the same day, category and payer', async () => {
    const day = '2026-10-29'
    const first = await file({ occurredOn: day, amount: 40_000 })
    expect(first.ok).toBe(true)

    expect(await file({ occurredOn: day, amount: 55_000 })).toEqual({
      ok: false,
      error: 'already_recorded',
    })
  })

  it('refuses it when the owner recorded that meal themselves', async () => {
    const day = '2026-10-28'
    await db.insert(schema.transactions).values({
      userId,
      occurredOn: day,
      amount: '40000',
      kind: 'expense',
      accountId,
      categoryId,
      payeePersonId: personId,
    })

    expect(await file({ occurredOn: day })).toEqual({ ok: false, error: 'already_recorded' })
  })

  /** A different category on the same day is a different meal. */
  it('allows another category on a day that already has one', async () => {
    const day = '2026-10-27'
    expect((await file({ occurredOn: day })).ok).toBe(true)
    expect((await file({ occurredOn: day, category: 'Cà phê' })).ok).toBe(true)
  })

  /**
   * An expense the owner paid for themselves carries no payer, so it is not
   * the same row and must not block one that does.
   */
  it('ignores an expense nobody covered for you', async () => {
    const day = '2026-10-26'
    await db.insert(schema.transactions).values({
      userId,
      occurredOn: day,
      amount: '40000',
      kind: 'expense',
      accountId,
      categoryId,
    })

    expect((await file({ occurredOn: day })).ok).toBe(true)
  })

  it('takes a category by name', async () => {
    const result = await file({ category: 'cà phê' })
    const [row] = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, result.ok ? result.id : ''))
    expect(row?.categoryId).toBe(otherCategoryId)
  })

  /** Inventing one would fill the ledger with near-duplicates nobody chose. */
  it('refuses a category this ledger does not have', async () => {
    expect(await file({ category: 'du thuyền' })).toEqual({
      ok: false,
      error: 'unknown_category',
    })
  })

  it('refuses more than the grant allows', async () => {
    expect(await file({ amount: 200_001 })).toEqual({ ok: false, error: 'too_much' })
  })
})

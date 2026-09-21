import { and, asc, between, desc, eq, gte, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  accounts,
  assets,
  budgets,
  financeCategories,
  investments,
  transactions,
} from '@/lib/db/schema'
import type {
  Account,
  Asset,
  Budget,
  FinanceCategory,
  Investment,
  Transaction,
} from '@/lib/db/schema'
import { ISO_DATE_RE, type DateRange, type ISODate } from '@/lib/dates'
import { toAccountType, type AccountType } from '@/lib/finance/account-types'

export const TRANSACTION_PAGE_SIZE = 40

export type TransactionCursor = {
  occurredOn: string
  id: string
}

export type TransactionPageFilters = {
  accountId?: string
  /** `null` = uncategorized only; omit for any category. */
  categoryId?: string | null
  from?: string
  to?: string
}

export type TransactionPage = {
  items: Transaction[]
  nextCursor: string | null
}

/** Opaque keyset cursor for `(occurred_on DESC, id DESC)`. */
export function encodeTransactionCursor(cursor: TransactionCursor): string {
  return Buffer.from(`${cursor.occurredOn}|${cursor.id}`, 'utf8').toString('base64url')
}

export function decodeTransactionCursor(raw: string): TransactionCursor | null {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8')
    const sep = decoded.indexOf('|')
    if (sep <= 0) return null
    const occurredOn = decoded.slice(0, sep)
    const id = decoded.slice(sep + 1)
    if (!ISO_DATE_RE.test(occurredOn)) return null
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return null
    }
    return { occurredOn, id }
  } catch {
    return null
  }
}

export async function findAccounts(userId: string): Promise<Account[]> {
  return db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), isNull(accounts.archivedAt)))
    .orderBy(asc(accounts.name))
}

export type AccountBalance = {
  accountId: string
  name: string
  type: AccountType
  currency: string
  balance: number
}

/** Reads `v_account_balances`, so the arithmetic lives in one place (spec 27.3). */
export async function findAccountBalances(userId: string): Promise<AccountBalance[]> {
  const rows = await db.execute<{
    account_id: string
    name: string
    type: string
    currency: string
    balance: string
  }>(sql`
    SELECT b.account_id, b.name, b.type, b.currency, b.balance
    FROM v_account_balances b
    JOIN accounts a ON a.id = b.account_id
    WHERE b.user_id = ${userId} AND a.archived_at IS NULL
    ORDER BY b.name
  `)

  return rows.map((row) => ({
    accountId: row.account_id,
    name: row.name,
    type: toAccountType(row.type),
    currency: row.currency,
    balance: Number(row.balance),
  }))
}

/** From either side: a transfer names one account as the counterparty. */
export async function countAccountTransactions(userId: string, accountId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        or(eq(transactions.accountId, accountId), eq(transactions.counterAccountId, accountId)),
      ),
    )
  return rows[0]?.n ?? 0
}

export async function deleteAccount(userId: string, accountId: string): Promise<void> {
  await db.delete(accounts).where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
}

export async function insertAccount(values: typeof accounts.$inferInsert): Promise<Account> {
  const rows = await db.insert(accounts).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert account')
  return row
}

export async function updateAccount(
  userId: string,
  accountId: string,
  patch: Partial<typeof accounts.$inferInsert>,
): Promise<Account> {
  const rows = await db
    .update(accounts)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
    .returning()
  const row = rows[0]
  if (!row) throw new Error('account not found')
  return row
}

export async function findCategories(userId: string): Promise<FinanceCategory[]> {
  return db
    .select()
    .from(financeCategories)
    .where(and(eq(financeCategories.userId, userId), isNull(financeCategories.archivedAt)))
    .orderBy(asc(financeCategories.kind), asc(financeCategories.name))
}

export async function insertCategory(
  values: typeof financeCategories.$inferInsert,
): Promise<FinanceCategory> {
  const rows = await db.insert(financeCategories).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert category')
  return row
}

export async function updateCategory(
  userId: string,
  categoryId: string,
  patch: Partial<typeof financeCategories.$inferInsert>,
): Promise<FinanceCategory> {
  const rows = await db
    .update(financeCategories)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(financeCategories.userId, userId), eq(financeCategories.id, categoryId)))
    .returning()
  const row = rows[0]
  if (!row) throw new Error('category not found')
  return row
}

export async function findTransactions(
  userId: string,
  range: DateRange,
  limit = 200,
): Promise<Transaction[]> {
  return db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        between(transactions.occurredOn, range.start, range.end),
      ),
    )
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
    .limit(limit)
}

/**
 * Keyset page for the ledger. Fetches `limit + 1` rows so the caller can tell
 * whether another page exists without a separate count query.
 */
export async function findTransactionsPage(
  userId: string,
  opts: {
    filters?: TransactionPageFilters
    cursor?: TransactionCursor | null
    limit?: number
  } = {},
): Promise<TransactionPage> {
  const limit = opts.limit ?? TRANSACTION_PAGE_SIZE
  const filters = opts.filters ?? {}
  const conditions = [eq(transactions.userId, userId)]

  if (filters.accountId) {
    conditions.push(
      or(
        eq(transactions.accountId, filters.accountId),
        eq(transactions.counterAccountId, filters.accountId),
      )!,
    )
  }
  if (filters.categoryId === null) {
    conditions.push(isNull(transactions.categoryId))
  } else if (filters.categoryId) {
    conditions.push(eq(transactions.categoryId, filters.categoryId))
  }
  if (filters.from) {
    conditions.push(gte(transactions.occurredOn, filters.from))
  }
  if (filters.to) {
    conditions.push(lte(transactions.occurredOn, filters.to))
  }
  if (opts.cursor) {
    const cursor = opts.cursor
    conditions.push(
      or(
        lt(transactions.occurredOn, cursor.occurredOn),
        and(eq(transactions.occurredOn, cursor.occurredOn), lt(transactions.id, cursor.id)),
      )!,
    )
  }

  const rows = await db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.occurredOn), desc(transactions.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const last = items[items.length - 1]
  return {
    items,
    nextCursor:
      hasMore && last
        ? encodeTransactionCursor({ occurredOn: last.occurredOn, id: last.id })
        : null,
  }
}

/**
 * Insert, or do nothing if this row is already here.
 *
 * The caller may pass an `id` the browser generated, which is what makes a
 * transaction queued offline safe to send twice — a retry after a reply that
 * never arrived lands on the same primary key and writes nothing. Without it
 * a replay is a duplicate, and a duplicate here is money.
 *
 * Returns null when the row already existed, so a caller can tell "saved" from
 * "was already saved" rather than guessing.
 */
export async function insertTransaction(
  values: typeof transactions.$inferInsert,
): Promise<Transaction | null> {
  const rows = await db
    .insert(transactions)
    .values(values)
    .onConflictDoNothing({ target: transactions.id })
    .returning()
  return rows[0] ?? null
}

/** One statement, so a batch of drafts is all saved or none of it is. */
export async function insertTransactions(
  values: (typeof transactions.$inferInsert)[],
): Promise<number> {
  if (values.length === 0) return 0
  const rows = await db.insert(transactions).values(values).returning({ id: transactions.id })
  return rows.length
}

/** Scoped by user, so a well-formed id cannot reach another person's row. */
export async function updateTransaction(
  userId: string,
  id: string,
  patch: Partial<typeof transactions.$inferInsert>,
): Promise<Transaction> {
  const rows = await db
    .update(transactions)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
    .returning()
  const row = rows[0]
  if (!row) throw new Error('transaction not found')
  return row
}

export async function deleteTransaction(userId: string, id: string): Promise<void> {
  await db.delete(transactions).where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
}

export type CategoryTotal = { categoryId: string | null; kind: string; total: number }

/** Debts are left out: lending money is not spending it (see `personId`). */
export async function sumByCategory(userId: string, range: DateRange): Promise<CategoryTotal[]> {
  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      kind: transactions.kind,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.personId),
        between(transactions.occurredOn, range.start, range.end),
      ),
    )
    .groupBy(transactions.categoryId, transactions.kind)

  return rows.map((row) => ({
    categoryId: row.categoryId,
    kind: row.kind,
    total: Number(row.total),
  }))
}

export async function findBudgets(userId: string, periodStart: ISODate): Promise<Budget[]> {
  return db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.periodStart, periodStart)))
}

export async function upsertBudget(values: typeof budgets.$inferInsert): Promise<Budget> {
  const rows = await db
    .insert(budgets)
    .values(values)
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.categoryId, budgets.periodStart],
      set: { amount: values.amount, updatedAt: new Date() },
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('failed to upsert budget')
  return row
}

export async function findAssets(userId: string): Promise<Asset[]> {
  return db.select().from(assets).where(eq(assets.userId, userId)).orderBy(desc(assets.asOf))
}

export async function insertAsset(values: typeof assets.$inferInsert): Promise<Asset> {
  const rows = await db.insert(assets).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert asset')
  return row
}

export async function findInvestments(userId: string): Promise<Investment[]> {
  return db
    .select()
    .from(investments)
    .where(and(eq(investments.userId, userId), isNull(investments.archivedAt)))
    .orderBy(asc(investments.symbol))
}

export async function insertInvestment(
  values: typeof investments.$inferInsert,
): Promise<Investment> {
  const rows = await db.insert(investments).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert investment')
  return row
}

export type MonthKindRow = { month: string; kind: string; total: number }

/**
 * Income and spending grouped by the month they fell in. Grouping in the
 * database rather than pulling a year of rows back to add them up here.
 */
export async function sumByMonth(userId: string, range: DateRange): Promise<MonthKindRow[]> {
  const month = sql<string>`to_char(date_trunc('month', ${transactions.occurredOn}), 'YYYY-MM-DD')`

  const rows = await db
    .select({
      month,
      kind: transactions.kind,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.personId),
        between(transactions.occurredOn, range.start, range.end),
      ),
    )
    .groupBy(sql`date_trunc('month', ${transactions.occurredOn})`, transactions.kind)

  return rows.map((row) => ({ month: row.month, kind: row.kind, total: Number(row.total) }))
}

/** The heaviest single expenses in the range, biggest first. */
export async function findLargestExpenses(
  userId: string,
  range: DateRange,
  limit = 5,
): Promise<Transaction[]> {
  return db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.kind, 'expense'),
        isNull(transactions.personId),
        between(transactions.occurredOn, range.start, range.end),
      ),
    )
    .orderBy(desc(transactions.amount))
    .limit(limit)
}

/** The oldest transaction's date, for working out which years to offer. */
export async function findEarliestTransactionDate(userId: string): Promise<ISODate | null> {
  const rows = await db
    .select({ occurredOn: transactions.occurredOn })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(asc(transactions.occurredOn))
    .limit(1)

  return rows[0]?.occurredOn ?? null
}

export type PersonDebtRow = { personId: string; kind: string; amount: number }

/**
 * Every debt row this user has, with no date range at all: a debt runs until
 * it is paid off, and cutting it at a month boundary would report a loan from
 * last year as settled.
 */
export async function sumDebtsByPerson(userId: string): Promise<PersonDebtRow[]> {
  const rows = await db
    .select({
      personId: transactions.personId,
      kind: transactions.kind,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), isNotNull(transactions.personId)))
    .groupBy(transactions.personId, transactions.kind)

  return rows.flatMap((row) =>
    row.personId === null
      ? []
      : [{ personId: row.personId, kind: row.kind, amount: Number(row.total) }],
  )
}

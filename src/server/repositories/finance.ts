import { and, asc, between, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  accounts,
  assets,
  budgets,
  financeCategories,
  investments,
  transactions,
} from '@/lib/db/schema'
import type { Account, Asset, Budget, FinanceCategory, Investment, Transaction } from '@/lib/db/schema'
import type { DateRange, ISODate } from '@/lib/dates'

export async function findAccounts(userId: string): Promise<Account[]> {
  return db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), isNull(accounts.archivedAt)))
    .orderBy(asc(accounts.name))
}

export type AccountBalance = { accountId: string; name: string; currency: string; balance: number }

/** Reads `v_account_balances`, so the arithmetic lives in one place (spec 27.3). */
export async function findAccountBalances(userId: string): Promise<AccountBalance[]> {
  const rows = await db.execute<{
    account_id: string
    name: string
    currency: string
    balance: string
  }>(sql`
    SELECT account_id, name, currency, balance
    FROM v_account_balances
    WHERE user_id = ${userId}
    ORDER BY name
  `)

  return rows.map((row) => ({
    accountId: row.account_id,
    name: row.name,
    currency: row.currency,
    balance: Number(row.balance),
  }))
}

export async function insertAccount(values: typeof accounts.$inferInsert): Promise<Account> {
  const rows = await db.insert(accounts).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert account')
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

export async function findTransactions(
  userId: string,
  range: DateRange,
  limit = 200,
): Promise<Transaction[]> {
  return db
    .select()
    .from(transactions)
    .where(
      and(eq(transactions.userId, userId), between(transactions.occurredOn, range.start, range.end)),
    )
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
    .limit(limit)
}

export async function insertTransaction(
  values: typeof transactions.$inferInsert,
): Promise<Transaction> {
  const rows = await db.insert(transactions).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert transaction')
  return row
}

export async function deleteTransaction(userId: string, id: string): Promise<void> {
  await db.delete(transactions).where(and(eq(transactions.userId, userId), eq(transactions.id, id)))
}

export type CategoryTotal = { categoryId: string | null; kind: string; total: number }

export async function sumByCategory(userId: string, range: DateRange): Promise<CategoryTotal[]> {
  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      kind: transactions.kind,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(eq(transactions.userId, userId), between(transactions.occurredOn, range.start, range.end)),
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

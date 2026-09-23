'use server'

import { revalidatePath } from 'next/cache'
import { log } from '@/lib/log'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { today } from '@/lib/dates'
import type { FinanceCategory } from '@/lib/db/schema'
import { ACCOUNT_TYPES } from '@/lib/finance/account-types'
import { MAX_DRAFTS, type TransactionDraft } from '@/lib/finance/drafts'
import { PATHS } from '@/lib/paths'
import { isoDateSchema } from '@/lib/validation/daily'
import {
  countAccountTransactions,
  decodeTransactionCursor,
  deleteAccount,
  deleteTransaction,
  findAccounts,
  findCategories,
  findTransactionsPage,
  insertAccount,
  insertAsset,
  insertCategory,
  insertInvestment,
  insertTransaction,
  insertTransactions,
  updateAccount,
  updateCategory,
  updateTransaction,
  upsertBudget,
} from '@/server/repositories/finance'
import { findPeople } from '@/server/repositories/people'
import { parseTransactions } from '@/server/services/finance-capture'
import { aiServiceConfigured } from '@/server/services/ai-service'
import { dayContextOf, getSettings } from '@/server/services/settings'
import { createLimit } from '@/lib/rate-limit'

const money = z.number().positive().max(999_999_999_999)
const optionalText = z
  .string()
  .max(500)
  .transform((value) => (value.trim() === '' ? null : value.trim()))
  .nullable()
  .optional()

function revalidateFinance() {
  revalidatePath(PATHS.finance)
  revalidatePath(PATHS.home)
}

export async function createAccount(input: unknown) {
  const parsed = z
    .object({
      name: z.string().min(1).max(120),
      type: z.enum(ACCOUNT_TYPES),
      currency: z.string().length(3),
      openingBalance: z.number().min(-999_999_999_999).max(999_999_999_999).default(0),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  await insertAccount({
    userId: await getCurrentUserId(),
    name: parsed.data.name,
    type: parsed.data.type,
    currency: parsed.data.currency.toUpperCase(),
    openingBalance: String(parsed.data.openingBalance),
  })

  revalidateFinance()
  return { ok: true as const }
}

export async function saveAccount(input: unknown) {
  const parsed = z
    .object({
      id: z.string().uuid(),
      name: z.string().min(1).max(120),
      type: z.enum(ACCOUNT_TYPES),
      currency: z.string().length(3),
      openingBalance: z.number().min(-999_999_999_999).max(999_999_999_999),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  await updateAccount(await getCurrentUserId(), parsed.data.id, {
    name: parsed.data.name,
    type: parsed.data.type,
    currency: parsed.data.currency.toUpperCase(),
    openingBalance: String(parsed.data.openingBalance),
  })

  revalidateFinance()
  return { ok: true as const }
}

/**
 * Removing an account means two different things, and the ledger decides which.
 * `transactions.account_id` cascades, so deleting one that has been used would
 * take its history with it — that account is hidden instead, and every row it
 * is part of stays where it is. An account nobody ever used is simply gone.
 */
export async function removeAccount(input: unknown) {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const userId = await getCurrentUserId()
  const used = await countAccountTransactions(userId, parsed.data.id)

  if (used > 0) await updateAccount(userId, parsed.data.id, { archivedAt: new Date() })
  else await deleteAccount(userId, parsed.data.id)

  revalidateFinance()
  return { ok: true as const, hidden: used > 0, transactions: used }
}

export async function createCategory(input: unknown) {
  const parsed = z
    .object({
      name: z.string().min(1).max(120),
      kind: z.enum(['income', 'expense']),
      note: optionalText,
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  await insertCategory({ ...parsed.data, userId: await getCurrentUserId() })
  revalidateFinance()
  return { ok: true as const }
}

export async function saveCategory(input: unknown) {
  const parsed = z
    .object({
      id: z.string().uuid(),
      name: z.string().min(1).max(120),
      kind: z.enum(['income', 'expense']),
      note: optionalText,
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const { id, ...patch } = parsed.data
  await updateCategory(await getCurrentUserId(), id, patch)
  revalidateFinance()
  return { ok: true as const }
}

const transactionFields = {
  occurredOn: isoDateSchema,
  amount: money,
  kind: z.enum(['income', 'expense', 'transfer']),
  accountId: z.string().uuid(),
  counterAccountId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  personId: z.string().uuid().nullable().optional(),
  payeePersonId: z.string().uuid().nullable().optional(),
  merchant: optionalText,
  note: optionalText,
} as const

type TransactionInput = {
  kind: 'income' | 'expense' | 'transfer'
  accountId: string
  counterAccountId?: string | null
  personId?: string | null
}

// A transfer moves money between two different accounts; enforced here and
// again by a CHECK constraint in the database (spec 26.1). Shared, so saving
// an edit cannot be the one path that forgets it.
const transferRule = (value: TransactionInput) =>
  value.kind !== 'transfer' ||
  Boolean(value.counterAccountId && value.counterAccountId !== value.accountId)
const transferMessage = {
  message: 'transfer needs a different counter account',
  path: ['counterAccountId'],
}

// A transfer moves money between two accounts you already own, so there is
// nobody on the other side of it to owe or be owed.
const debtRule = (value: TransactionInput) => value.kind !== 'transfer' || !value.personId
const debtMessage = { message: 'a transfer cannot be a debt', path: ['personId'] }

const transactionSchema = z
  .object({
    /**
     * Generated by the browser when a transaction is queued offline, so a
     * retry after a reply that never arrived lands on the same row instead of
     * adding a second one. Optional — an ordinary online save leaves it to
     * the database.
     *
     * Not in `transactionFields`, because the id an edit carries means
     * something else: which row to change. Sharing one field between the two
     * is how a create quietly becomes an overwrite.
     */
    id: z.uuid().optional(),
    ...transactionFields,
  })
  .refine(transferRule, transferMessage)
  .refine(debtRule, debtMessage)

/**
 * A well-formed uuid still has to name a row this user owns (spec 29). Returns
 * the id when it does and null when it does not, so a stale or forged id
 * becomes "none" rather than a write against someone else's row.
 */
function ownedBy(id: string | null | undefined, rows: { id: string }[]): string | null {
  return id && rows.some((row) => row.id === id) ? id : null
}

export async function createTransaction(input: unknown) {
  const parsed = transactionSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  // The session cookie names the user without touching the database, so the
  // settings row is read alongside the ownership lists rather than ahead of
  // them. One wave of queries instead of two.
  const userId = await getCurrentUserId()
  const [settings, accounts, categories, people] = await Promise.all([
    getSettings(),
    findAccounts(userId),
    findCategories(userId),
    // Archived included: re-saving an old transaction must not silently drop
    // the debt link to someone who has since been removed from the list.
    findPeople(userId, { includeArchived: true }),
  ])

  const transfer = parsed.data.kind === 'transfer'
  const accountId = ownedBy(parsed.data.accountId, accounts)
  const counterAccountId = transfer ? ownedBy(parsed.data.counterAccountId, accounts) : null
  if (accountId === null || (transfer && counterAccountId === null)) {
    return { ok: false as const, error: 'invalid_input' as const }
  }

  await insertTransaction({
    ...(parsed.data.id ? { id: parsed.data.id } : {}),
    userId: settings.userId,
    occurredOn: parsed.data.occurredOn,
    amount: String(parsed.data.amount),
    currency: settings.defaultCurrency,
    kind: parsed.data.kind,
    accountId,
    counterAccountId,
    categoryId: transfer ? null : ownedBy(parsed.data.categoryId, categories),
    personId: transfer ? null : ownedBy(parsed.data.personId, people),
    payeePersonId: ownedBy(parsed.data.payeePersonId, people),
    merchant: parsed.data.merchant ?? null,
    note: parsed.data.note ?? null,
  })

  revalidateFinance()
  return { ok: true as const }
}

/**
 * Editing a row that is already in the ledger.
 *
 * A schema of its own rather than `transactionSchema` plus an id: that one is
 * built for a new row, and reusing it would let a patch silently reset the
 * currency the row was recorded in to whatever the default is today.
 *
 * Every id is checked against this user's own accounts and categories. A
 * well-formed uuid still has to name a row this user owns (spec 29).
 */
/**
 * Records that the money has reached whoever covered the bill — or that it
 * never will, which this column cannot tell apart and does not need to. Either
 * way the row stops asking.
 *
 * Nothing else is written. The expense left the account when it was recorded;
 * where it went afterwards changes no total, so there is no second row here.
 */
export async function markTransactionTransferred(input: unknown) {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const userId = await getCurrentUserId()
  try {
    await updateTransaction(userId, parsed.data.id, { transferredAt: new Date() })
  } catch {
    // Someone else's row, or one deleted between the list rendering and the tap.
    return { ok: false as const, error: 'not_found' as const }
  }

  revalidateFinance()
  return { ok: true as const }
}

export async function saveTransaction(input: unknown) {
  const parsed = z
    .object({ id: z.string().uuid(), ...transactionFields })
    .refine(transferRule, transferMessage)
    .refine(debtRule, debtMessage)
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const userId = await getCurrentUserId()
  const [settings, accounts, categories, people] = await Promise.all([
    getSettings(),
    findAccounts(userId),
    findCategories(userId),
    // Archived included: re-saving an old transaction must not silently drop
    // the debt link to someone who has since been removed from the list.
    findPeople(userId, { includeArchived: true }),
  ])

  const transfer = parsed.data.kind === 'transfer'
  const accountId = ownedBy(parsed.data.accountId, accounts)
  const counterAccountId = transfer ? ownedBy(parsed.data.counterAccountId, accounts) : null
  if (accountId === null || (transfer && counterAccountId === null)) {
    return { ok: false as const, error: 'invalid_input' as const }
  }

  await updateTransaction(settings.userId, parsed.data.id, {
    occurredOn: parsed.data.occurredOn,
    amount: String(parsed.data.amount),
    kind: parsed.data.kind,
    accountId,
    counterAccountId,
    categoryId: transfer ? null : ownedBy(parsed.data.categoryId, categories),
    personId: transfer ? null : ownedBy(parsed.data.personId, people),
    payeePersonId: ownedBy(parsed.data.payeePersonId, people),
    merchant: parsed.data.merchant ?? null,
    note: parsed.data.note ?? null,
  })

  revalidateFinance()
  return { ok: true as const }
}

/**
 * Spec 12 + §14 — free text becomes *drafts*, never rows. The model's output is
 * mapped against the user's own accounts and categories, and the save below
 * re-checks every id, so nothing the model returned can reach the ledger
 * without the user seeing it first.
 *
 * Ten notes a minute: enough to work through a receipt, not a bill for the model.
 */
const captures = createLimit({ capacity: 10, refillMs: 60 * 1000 })

/**
 * The drafts travel with everything needed to review them, so the global
 * capture box in the shell needs no finance query of its own on every page.
 */
export type ParseTransactionsResult =
  | {
      ok: true
      drafts: TransactionDraft[]
      context: {
        accounts: { id: string; name: string }[]
        categories: FinanceCategory[]
        currency: string
      }
    }
  | { ok: false; error: 'disabled' | 'invalid_input' | 'rate_limited' | 'failed' }

export async function parseTransactionText(input: unknown): Promise<ParseTransactionsResult> {
  if (!aiServiceConfigured()) return { ok: false, error: 'disabled' }

  const parsed = z.object({ text: z.string().trim().min(3).max(2000) }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }

  // The cookie names the user, so the rate limit is checked before any read
  // rather than after one.
  const userId = await getCurrentUserId()
  if (!captures.take(userId).allowed) return { ok: false, error: 'rate_limited' }

  const [settings, accounts, categories] = await Promise.all([
    getSettings(),
    findAccounts(userId),
    findCategories(userId),
  ])

  try {
    const drafts = await parseTransactions({
      text: parsed.data.text,
      today: today(dayContextOf(settings)),
      currency: settings.defaultCurrency,
      categories,
    })
    return {
      ok: true,
      drafts,
      context: {
        accounts: accounts.map((account) => ({ id: account.id, name: account.name })),
        categories,
        currency: settings.defaultCurrency,
      },
    }
  } catch (error) {
    await log.error('finance', 'could not parse the note', error)
    return { ok: false, error: 'failed' }
  }
}

export async function createTransactions(input: unknown) {
  const parsed = z
    .object({
      accountId: z.uuid(),
      rows: z
        .array(
          z.object({
            occurredOn: isoDateSchema,
            amount: money,
            kind: z.enum(['income', 'expense']),
            categoryId: z.uuid().nullable().optional(),
            merchant: optionalText,
            note: optionalText,
          }),
        )
        .min(1)
        .max(MAX_DRAFTS),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const userId = await getCurrentUserId()
  const [settings, accounts, categories] = await Promise.all([
    getSettings(),
    findAccounts(userId),
    findCategories(userId),
  ])

  // A well-formed uuid still has to name a row this user owns (spec 29).
  if (!accounts.some((account) => account.id === parsed.data.accountId)) {
    return { ok: false as const, error: 'invalid_input' as const }
  }
  const ownedCategory = (id: string | null | undefined) =>
    id && categories.some((category) => category.id === id) ? id : null

  const saved = await insertTransactions(
    parsed.data.rows.map((row) => ({
      userId: settings.userId,
      occurredOn: row.occurredOn,
      amount: String(row.amount),
      currency: settings.defaultCurrency,
      kind: row.kind,
      accountId: parsed.data.accountId,
      counterAccountId: null,
      categoryId: ownedCategory(row.categoryId),
      merchant: row.merchant ?? null,
      note: row.note ?? null,
    })),
  )

  revalidateFinance()
  return { ok: true as const, saved }
}

export async function removeTransaction(input: unknown) {
  const id = z.string().uuid().parse(input)
  await deleteTransaction(await getCurrentUserId(), id)
  revalidateFinance()
  return { ok: true }
}

const listTransactionsSchema = z.object({
  cursor: z.string().min(1).max(200).optional(),
  accountId: z.string().uuid().optional(),
  categoryId: z.union([z.string().uuid(), z.literal('__none__')]).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  search: z.string().max(100).optional(),
})

/** Cursor page for the ledger; filters run in SQL, not on a client-side dump. */
export async function listTransactions(input: unknown) {
  const parsed = listTransactionsSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const cursorRaw = parsed.data.cursor
  const cursor = cursorRaw ? decodeTransactionCursor(cursorRaw) : null
  if (cursorRaw && !cursor) {
    return { ok: false as const, error: 'invalid_cursor' as const }
  }

  const categoryId =
    parsed.data.categoryId === '__none__'
      ? null
      : parsed.data.categoryId === undefined
        ? undefined
        : parsed.data.categoryId

  const page = await findTransactionsPage(await getCurrentUserId(), {
    cursor,
    filters: {
      accountId: parsed.data.accountId,
      categoryId,
      from: parsed.data.from,
      to: parsed.data.to,
      search: parsed.data.search?.trim() || undefined,
    },
  })

  return { ok: true as const, ...page }
}

export async function saveBudget(input: unknown) {
  const parsed = z
    .object({ categoryId: z.string().uuid(), periodStart: isoDateSchema, amount: money })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  await upsertBudget({
    userId: await getCurrentUserId(),
    categoryId: parsed.data.categoryId,
    periodStart: parsed.data.periodStart,
    amount: String(parsed.data.amount),
  })

  revalidateFinance()
  return { ok: true as const }
}

export async function createAsset(input: unknown) {
  const parsed = z
    .object({
      name: z.string().min(1).max(120),
      kind: z.enum(['asset', 'liability']),
      value: z.number().min(0).max(999_999_999_999),
      asOf: isoDateSchema,
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const settings = await getSettings()
  await insertAsset({
    userId: settings.userId,
    name: parsed.data.name,
    kind: parsed.data.kind,
    value: String(parsed.data.value),
    asOf: parsed.data.asOf,
    currency: settings.defaultCurrency,
  })

  revalidateFinance()
  return { ok: true as const }
}

export async function createInvestment(input: unknown) {
  const parsed = z
    .object({
      symbol: z.string().min(1).max(20),
      quantity: z.number().positive(),
      avgCost: z.number().positive(),
      lastPrice: z.number().positive().nullable().optional(),
      pricedAt: isoDateSchema.nullable().optional(),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const settings = await getSettings()
  await insertInvestment({
    userId: settings.userId,
    symbol: parsed.data.symbol.toUpperCase(),
    quantity: String(parsed.data.quantity),
    avgCost: String(parsed.data.avgCost),
    lastPrice:
      parsed.data.lastPrice === null || parsed.data.lastPrice === undefined
        ? null
        : String(parsed.data.lastPrice),
    pricedAt: parsed.data.pricedAt ?? null,
    currency: settings.defaultCurrency,
  })

  revalidateFinance()
  return { ok: true as const }
}

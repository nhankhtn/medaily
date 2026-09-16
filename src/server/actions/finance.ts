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
  deleteTransaction,
  findAccounts,
  findCategories,
  insertAccount,
  insertAsset,
  insertCategory,
  insertInvestment,
  insertTransaction,
  insertTransactions,
  updateAccount,
  updateTransaction,
  upsertBudget,
} from '@/server/repositories/finance'
import { parseTransactions } from '@/server/services/finance-capture'
import { geminiEnabled } from '@/server/services/gemini'
import { dayContextOf, getSettings } from '@/server/services/settings'

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

export async function createCategory(input: unknown) {
  const parsed = z
    .object({ name: z.string().min(1).max(120), kind: z.enum(['income', 'expense']) })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  await insertCategory({ ...parsed.data, userId: await getCurrentUserId() })
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
  merchant: optionalText,
  note: optionalText,
} as const

type TransactionInput = {
  kind: 'income' | 'expense' | 'transfer'
  accountId: string
  counterAccountId?: string | null
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

const transactionSchema = z.object(transactionFields).refine(transferRule, transferMessage)

export async function createTransaction(input: unknown) {
  const parsed = transactionSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const settings = await getSettings()
  await insertTransaction({
    userId: settings.userId,
    occurredOn: parsed.data.occurredOn,
    amount: String(parsed.data.amount),
    currency: settings.defaultCurrency,
    kind: parsed.data.kind,
    accountId: parsed.data.accountId,
    counterAccountId:
      parsed.data.kind === 'transfer' ? (parsed.data.counterAccountId ?? null) : null,
    categoryId: parsed.data.kind === 'transfer' ? null : (parsed.data.categoryId ?? null),
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
export async function saveTransaction(input: unknown) {
  const parsed = z
    .object({ id: z.string().uuid(), ...transactionFields })
    .refine(transferRule, transferMessage)
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const settings = await getSettings()
  const [accounts, categories] = await Promise.all([
    findAccounts(settings.userId),
    findCategories(settings.userId),
  ])

  const owned = (id: string | null | undefined, rows: { id: string }[]) =>
    id && rows.some((row) => row.id === id) ? id : null

  if (owned(parsed.data.accountId, accounts) === null) {
    return { ok: false as const, error: 'invalid_input' as const }
  }

  const transfer = parsed.data.kind === 'transfer'
  const counter = transfer ? owned(parsed.data.counterAccountId, accounts) : null
  if (transfer && counter === null) {
    return { ok: false as const, error: 'invalid_input' as const }
  }

  await updateTransaction(settings.userId, parsed.data.id, {
    occurredOn: parsed.data.occurredOn,
    amount: String(parsed.data.amount),
    kind: parsed.data.kind,
    accountId: parsed.data.accountId,
    counterAccountId: counter,
    categoryId: transfer ? null : owned(parsed.data.categoryId, categories),
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
 */
const CAPTURE_WINDOW_MS = 60 * 1000
const MAX_CAPTURES_PER_WINDOW = 10
const captures = new Map<string, { count: number; firstAt: number }>()

function captureAllowed(userId: string): boolean {
  const now = Date.now()
  const entry = captures.get(userId)

  if (!entry || now - entry.firstAt > CAPTURE_WINDOW_MS) {
    captures.set(userId, { count: 1, firstAt: now })
    return true
  }

  entry.count += 1
  return entry.count <= MAX_CAPTURES_PER_WINDOW
}

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
  if (!geminiEnabled()) return { ok: false, error: 'disabled' }

  const parsed = z.object({ text: z.string().trim().min(3).max(2000) }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }

  const settings = await getSettings()
  if (!captureAllowed(settings.userId)) return { ok: false, error: 'rate_limited' }

  const [accounts, categories] = await Promise.all([
    findAccounts(settings.userId),
    findCategories(settings.userId),
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

  const settings = await getSettings()
  const [accounts, categories] = await Promise.all([
    findAccounts(settings.userId),
    findCategories(settings.userId),
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

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { isoDateSchema } from '@/lib/validation/daily'
import {
  deleteTransaction,
  insertAccount,
  insertAsset,
  insertCategory,
  insertInvestment,
  insertTransaction,
  upsertBudget,
} from '@/server/repositories/finance'
import { getSettings } from '@/server/services/settings'

const money = z.number().positive().max(999_999_999_999)
const optionalText = z
  .string()
  .max(500)
  .transform((value) => (value.trim() === '' ? null : value.trim()))
  .nullable()
  .optional()

function revalidateFinance() {
  revalidatePath('/finance')
  revalidatePath('/')
}

export async function createAccount(input: unknown) {
  const parsed = z
    .object({
      name: z.string().min(1).max(120),
      type: z.enum(['cash', 'bank', 'credit_card', 'e_wallet', 'investment', 'loan']),
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

export async function createCategory(input: unknown) {
  const parsed = z
    .object({ name: z.string().min(1).max(120), kind: z.enum(['income', 'expense']) })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  await insertCategory({ ...parsed.data, userId: await getCurrentUserId() })
  revalidateFinance()
  return { ok: true as const }
}

const transactionSchema = z
  .object({
    occurredOn: isoDateSchema,
    amount: money,
    kind: z.enum(['income', 'expense', 'transfer']),
    accountId: z.string().uuid(),
    counterAccountId: z.string().uuid().nullable().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    merchant: optionalText,
    note: optionalText,
  })
  // A transfer moves money between two different accounts; enforced here and
  // again by a CHECK constraint in the database (spec 26.1).
  .refine(
    (value) =>
      value.kind !== 'transfer' ||
      (value.counterAccountId && value.counterAccountId !== value.accountId),
    { message: 'transfer needs a different counter account', path: ['counterAccountId'] },
  )

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
    counterAccountId: parsed.data.kind === 'transfer' ? (parsed.data.counterAccountId ?? null) : null,
    categoryId: parsed.data.kind === 'transfer' ? null : (parsed.data.categoryId ?? null),
    merchant: parsed.data.merchant ?? null,
    note: parsed.data.note ?? null,
  })

  revalidateFinance()
  return { ok: true as const }
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
    lastPrice: parsed.data.lastPrice === null || parsed.data.lastPrice === undefined ? null : String(parsed.data.lastPrice),
    pricedAt: parsed.data.pricedAt ?? null,
    currency: settings.defaultCurrency,
  })

  revalidateFinance()
  return { ok: true as const }
}

import { addDays, isISODate, maxDate, minDate, type ISODate } from '@/lib/dates'
import { foldText } from '@/lib/text'

/**
 * The bridge between what a language model returns and what the database will
 * accept. Everything here is pure, so the rules that keep a hallucinated row
 * out of the ledger can be tested without a network or a database.
 */

export const MAX_DRAFTS = 25

/** A year back is generous for "what did I spend"; older belongs in the form. */
const MAX_BACKDATE_DAYS = 365

const MAX_AMOUNT = 999_999_999_999

export type DraftKind = 'income' | 'expense'

/** Exactly the shape asked of the model — strings, because it returns strings. */
export type ParsedTransaction = {
  occurred_on?: unknown
  amount?: unknown
  kind?: unknown
  category?: unknown
  merchant?: unknown
  note?: unknown
}

export type TransactionDraft = {
  /** Stable across re-renders so a row keeps its inputs while others are removed. */
  id: string
  occurredOn: ISODate
  amount: number
  kind: DraftKind
  categoryId: string | null
  merchant: string | null
  note: string | null
}

export type CategoryOption = {
  id: string
  name: string
  kind: string
  /** Optional hint used by AI capture when choosing among similarly named buckets. */
  note?: string | null
}

/**
 * A category id for the name the model produced, or null. Only names the user
 * already created can match: a category is never invented from free text.
 */
export function matchCategoryId(
  name: string | null,
  categories: CategoryOption[],
  kind: DraftKind,
): string | null {
  if (!name) return null
  const needle = foldText(name)
  if (needle === '') return null

  const pool = categories.filter((category) => category.kind === kind)
  const exact = pool.find((category) => foldText(category.name) === needle)
  if (exact) return exact.id

  // A one-sided prefix or containment, longest name first so "Ăn uống ngoài"
  // wins over "Ăn" when both would match.
  const partial = [...pool]
    .sort((a, b) => b.name.length - a.name.length)
    .find((category) => {
      const hay = foldText(category.name)
      return hay.includes(needle) || needle.includes(hay)
    })

  return partial?.id ?? null
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Round to whole cents. The model happily returns 40000.000000001, and the
 * `numeric(14,2)` column would take it, which makes later sums look wrong.
 */
function asAmount(value: unknown): number | null {
  const amount = typeof value === 'number' ? value : Number(asString(value) ?? NaN)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return Math.min(MAX_AMOUNT, Math.round(amount * 100) / 100)
}

export function toDrafts({
  parsed,
  categories,
  today,
}: {
  parsed: ParsedTransaction[]
  categories: CategoryOption[]
  today: ISODate
}): TransactionDraft[] {
  const earliest = addDays(today, -MAX_BACKDATE_DAYS)
  const out: TransactionDraft[] = []

  for (const row of parsed.slice(0, MAX_DRAFTS)) {
    const amount = asAmount(row.amount)
    if (amount === null) continue

    const kind: DraftKind = row.kind === 'income' ? 'income' : 'expense'
    const rawDate = asString(row.occurred_on)
    // A date the model got wrong should not lose the row — the user sees and
    // can correct every field before any of this is saved.
    const occurredOn =
      rawDate && isISODate(rawDate) ? minDate(maxDate(rawDate, earliest), today) : today

    out.push({
      id: `draft-${out.length}`,
      occurredOn,
      amount,
      kind,
      categoryId: matchCategoryId(asString(row.category), categories, kind),
      merchant: asString(row.merchant)?.slice(0, 200) ?? null,
      note: asString(row.note)?.slice(0, 500) ?? null,
    })
  }

  return out
}

import type { ISODate } from '@/lib/dates'

export type DayTotals = { income: number; expense: number }

export type LedgerEntry<T> =
  { type: 'day'; day: ISODate; totals: DayTotals | null } | { type: 'row'; day: ISODate; row: T }

type Dated = {
  occurredOn: ISODate
  kind: 'income' | 'expense' | 'transfer'
  amount: string | number
  currency?: string | null
}

/**
 * The ledger with a header before each day, for rows already sorted newest
 * first. `complete: false` means more pages exist, so the last day may be cut
 * in half and its totals are left out rather than shown wrong.
 *
 * Rows in another currency are not added: nothing converts them yet.
 */
export function groupByDay<T extends Dated>(
  rows: T[],
  { currency, complete }: { currency: string; complete: boolean },
): LedgerEntry<T>[] {
  const entries: LedgerEntry<T>[] = []
  let header = null as Extract<LedgerEntry<T>, { type: 'day' }> | null

  for (const row of rows) {
    if (header?.day !== row.occurredOn) {
      header = { type: 'day', day: row.occurredOn, totals: { income: 0, expense: 0 } }
      entries.push(header)
    }
    entries.push({ type: 'row', day: row.occurredOn, row })

    const sameCurrency = !row.currency || row.currency === currency
    if (header.totals && sameCurrency && row.kind !== 'transfer') {
      header.totals[row.kind] += Number(row.amount)
    }
  }

  if (!complete && header) header.totals = null
  return entries
}

/** Marks a slot in a translated string so a React node can replace it after formatting. */
export const slot = (index: number) => `${index}`

/** `"a 0 b"` → `["a ", 0, " b"]`; the numbers are slot indices. */
export function splitSlots(text: string): (string | number)[] {
  const parts: (string | number)[] = []
  const pattern = /(\d+)/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push(Number(match[1]))
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

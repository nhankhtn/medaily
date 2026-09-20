import {
  toDrafts,
  MAX_DRAFTS,
  type CategoryOption,
  type ParsedTransaction,
  type TransactionDraft,
} from '@/lib/finance/drafts'
import type { ISODate } from '@/lib/dates'
import { aiClient } from '@/server/services/ai-service'

/**
 * Free text in, draft transactions out. Nothing is written: the drafts land in
 * a form the user edits and confirms, so a misread amount is a visible row to
 * fix rather than a wrong number in the ledger.
 *
 * The reading is `medaily-ai`'s — the prompt lives there, with every other
 * prompt, at `src/services/capture/finance.ts`. What is still this app's is
 * everything around it: which categories exist, what a draft row is, and the
 * check that turns an answer off a model into rows this form can render.
 *
 * What leaves the machine is the sentence the user just typed plus their own
 * category names — no balances, no history, no other module's data.
 */
const TIMEOUT_MS = 45_000

export async function parseTransactions({
  text,
  today,
  currency,
  categories,
}: {
  text: string
  today: ISODate
  currency: string
  categories: CategoryOption[]
}): Promise<TransactionDraft[]> {
  const body = await aiClient('capture', TIMEOUT_MS).request<{
    transactions?: ParsedTransaction[]
  }>('/api/capture/finance', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text,
      today,
      currency,
      // Names (and optional notes) only. Ids stay here; matching a name back
      // to one is this side's job, and an id is nothing the reading needs.
      categories: categories.map((category) => ({
        name: category.name,
        kind: category.kind,
        ...(category.note?.trim() ? { note: category.note.trim() } : {}),
      })),
      maxItems: MAX_DRAFTS,
    }),
  })

  return toDrafts({ parsed: body.transactions ?? [], categories, today })
}

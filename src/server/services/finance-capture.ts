import {
  toDrafts,
  MAX_DRAFTS,
  type CategoryOption,
  type ParsedTransaction,
  type TransactionDraft,
} from '@/lib/finance/drafts'
import type { ISODate } from '@/lib/dates'
import { generateJson, type JsonSchema } from '@/server/services/gemini'

/**
 * Free text in, draft transactions out. Nothing is written: the drafts land in
 * a form the user edits and confirms, so a misread amount is a visible row to
 * fix rather than a wrong number in the ledger.
 *
 * What leaves the machine is the sentence the user just typed plus their own
 * category names — no balances, no history, no other module's data.
 */
const SYSTEM_PROMPT = `You extract personal spending records from a short note someone wrote about their own day. You work in Vietnamese and English.

Return one record per distinct payment or receipt. A sentence listing three purchases is three records. Never merge them, never invent one that is not mentioned, and never add a rounding, a tip or a tax the text does not state.

Amounts:
- Numbers are in the user's own currency, in major units. Keep decimals exactly as written — "4.50" is 4.5, not 4 — unless the currency has no minor unit, as VND does not. Vietnamese shorthand is common: "40k", "40 nghìn", "40 ngàn" are all 40000; "2tr", "2 triệu", "2 củ" are 2000000; "1 tỷ" is 1000000000.
- "50k mỗi người, 3 người" is one record of 150000 unless the text clearly separates the payments.
- If a price is genuinely absent, drop the record rather than guessing.

Dates: resolve every relative word against the note's date, given below. "sáng nay"/"trưa nay"/"tối nay"/"hôm nay" are that date; "hôm qua"/"tối qua" the day before; "hôm kia" two days before. With nothing stated, use the note's date. Never return a future date.

Kind: "expense" for money going out, "income" for money coming in (salary, refunds, gifts received). Default to "expense". Transfers between the user's own accounts are out of scope — record them as expense and let the user correct it.

Category: choose one name, copied exactly, from the list of the user's categories below. Use "" when none of them fits. Never write a category name that is not on the list.

Merchant: the shop, place or short label the text names ("phở Thìn", "Highlands", "ăn sáng"). Keep it under 60 characters and in the language the user wrote it. Use "" if there is nothing to name.

Note: only a detail the merchant field does not already carry. Usually "".`

const SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    transactions: {
      type: 'array',
      maxItems: MAX_DRAFTS,
      items: {
        type: 'object',
        properties: {
          occurred_on: { type: 'string', format: 'date', description: 'YYYY-MM-DD' },
          amount: { type: 'number', description: 'Positive, in whole major currency units' },
          kind: { type: 'string', enum: ['expense', 'income'] },
          category: { type: 'string', description: 'Exactly one of the listed names, or ""' },
          merchant: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['occurred_on', 'amount', 'kind', 'category', 'merchant', 'note'],
      },
    },
  },
  required: ['transactions'],
}

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
  const names = (kind: string) =>
    categories
      .filter((category) => category.kind === kind)
      .map((category) => category.name)
      .join(' | ') || '(none)'

  const result = await generateJson<{ transactions?: ParsedTransaction[] }>({
    systemInstruction: SYSTEM_PROMPT,
    schema: SCHEMA,
    input: [
      `Note date: ${today}`,
      `Currency: ${currency}`,
      `Expense categories: ${names('expense')}`,
      `Income categories: ${names('income')}`,
      '',
      'Note:',
      text,
    ].join('\n'),
  })

  return toDrafts({ parsed: result.transactions ?? [], categories, today })
}

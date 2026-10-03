import { z } from 'zod'
import { PATHS } from '@/lib/paths'
import { transferReference } from '@/lib/finance/vietqr'

/**
 * Readers for `notifications.kind`. Adding a notice means a schema here and a
 * branch in {@link presentNotification} — the table is not touched.
 */
const grantExpense = z.object({
  transactionId: z.string().min(1),
  personName: z.string(),
  amount: z.number().finite(),
  currency: z.string().min(1),
  merchant: z.string().nullable(),
})

/** Rows written before kind existed: the words were already chosen. */
const legacyNotice = z.object({
  title: z.string(),
  body: z.string(),
  url: z.string().min(1),
})

export const NOTIFICATION_KINDS = {
  grant_expense: grantExpense,
  legacy: legacyNotice,
} as const

export type NotificationKind = keyof typeof NOTIFICATION_KINDS
export type GrantExpenseData = z.infer<typeof grantExpense>

export type NoticeCopy = (
  key: 'grantExpense' | 'unknown',
  values?: { name: string },
) => string

/** Title, body and where a tap lands. The same words the push is sent with. */
export function presentNotification(
  kind: string,
  payload: unknown,
  locale: string,
  copy: NoticeCopy,
): { title: string; body: string; url: string } {
  const shown = render(kind, payload, locale, copy)
  return shown ?? { title: copy('unknown'), body: '', url: PATHS.home }
}

function render(
  kind: string,
  payload: unknown,
  locale: string,
  copy: NoticeCopy,
): { title: string; body: string; url: string } | null {
  if (kind === 'grant_expense') {
    const data = grantExpense.safeParse(payload)
    if (!data.success) return null
    const merchant = data.data.merchant
    return {
      title: copy('grantExpense', { name: data.data.personName }),
      body: merchant
        ? `${money(locale, data.data.amount, data.data.currency)} · ${merchant}`
        : money(locale, data.data.amount, data.data.currency),
      url: PATHS.financeSearch(transferReference(data.data.transactionId)),
    }
  }

  if (kind === 'legacy') {
    const data = legacyNotice.safeParse(payload)
    if (!data.success) return null
    return data.data
  }

  return null
}

function money(locale: string, amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

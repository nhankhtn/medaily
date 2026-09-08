'use client'

import { ArrowRightLeft, Trash2 } from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import type { FinanceCategory, Transaction } from '@/lib/db/schema'
import { fromISODate } from '@/lib/dates'
import { formatMoney } from '@/lib/format/money'
import { removeTransaction } from '@/server/actions/finance'
import { cn } from '@/lib/utils'

export function TransactionList({
  transactions,
  categories,
  accounts,
  currency,
}: {
  transactions: Transaction[]
  categories: FinanceCategory[]
  accounts: { id: string; name: string }[]
  currency: string
}) {
  const t = useTranslations('finance')
  const tc = useTranslations('common')
  const locale = useLocale()
  const format = useFormatter()
  const [pending, startTransition] = useTransition()

  if (transactions.length === 0) {
    return <p className="text-sm text-text-subtle">{t('noTransactions')}</p>
  }

  const label = (transaction: Transaction) => {
    if (transaction.kind === 'transfer') {
      const to = accounts.find((account) => account.id === transaction.counterAccountId)?.name
      return `${accounts.find((account) => account.id === transaction.accountId)?.name ?? ''} → ${to ?? ''}`
    }
    return (
      transaction.merchant ??
      categories.find((category) => category.id === transaction.categoryId)?.name ??
      t('noCategory')
    )
  }

  return (
    <ul className="divide-y divide-border-base">
      {transactions.map((transaction) => (
        <li key={transaction.id} className="group flex items-center gap-3 py-2">
          <span className="w-16 shrink-0 text-xs tabular-nums text-text-subtle">
            {format.dateTime(fromISODate(transaction.occurredOn), { day: 'numeric', month: 'short' })}
          </span>

          <span className="min-w-0 flex-1 truncate text-sm">{label(transaction)}</span>

          {transaction.kind === 'transfer' ? (
            <Badge>
              <ArrowRightLeft className="size-3" />
            </Badge>
          ) : (
            <Badge tone={transaction.kind === 'income' ? 'good' : 'neutral'}>
              {t(`kinds.${transaction.kind}`)}
            </Badge>
          )}

          <span
            className={cn(
              'shrink-0 text-sm font-medium tabular-nums',
              transaction.kind === 'income' ? 'text-good' : 'text-text',
            )}
          >
            {transaction.kind === 'income' ? '+' : transaction.kind === 'expense' ? '−' : ''}
            {formatMoney(Number(transaction.amount), transaction.currency || currency, locale)}
          </span>

          <button
            type="button"
            disabled={pending}
            aria-label={tc('delete')}
            onClick={() => startTransition(async () => void (await removeTransaction(transaction.id)))}
            className="shrink-0 text-text-subtle opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  )
}

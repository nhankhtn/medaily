'use client'

import { ArrowRightLeft, Check, Pencil, Trash2, X } from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import { Select } from '@/components/ui/select'
import type { FinanceCategory, Transaction } from '@/lib/db/schema'
import { fromISODate } from '@/lib/dates'
import { formatMoney } from '@/lib/format/money'
import { removeTransaction, saveTransaction } from '@/server/actions/finance'
import { cn } from '@/lib/utils'

type Account = { id: string; name: string }

export function TransactionList({
  transactions,
  categories,
  accounts,
  currency,
}: {
  transactions: Transaction[]
  categories: FinanceCategory[]
  accounts: Account[]
  currency: string
}) {
  const t = useTranslations('finance')
  const tc = useTranslations('common')
  const locale = useLocale()
  const format = useFormatter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (transactions.length === 0) {
    return <p className="text-text-subtle text-sm">{t('noTransactions')}</p>
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
    <ul className="divide-border-base divide-y">
      {transactions.map((transaction) => {
        if (editingId === transaction.id) {
          return (
            <li key={transaction.id} className="bg-surface-2 rounded-[var(--radius)] p-2">
              <TransactionEditor
                transaction={transaction}
                accounts={accounts}
                categories={categories}
                pending={pending}
                onClose={() => setEditingId(null)}
                onSave={(patch) =>
                  startTransition(async () => {
                    const result = await saveTransaction({ id: transaction.id, ...patch })
                    if (!result.ok) {
                      toast.error(tc('error'))
                      return
                    }
                    setEditingId(null)
                    toast.success(t('saved'))
                  })
                }
              />
            </li>
          )
        }

        return (
          <li key={transaction.id} className="group flex items-center gap-3 py-2">
            <span className="text-text-subtle w-16 shrink-0 text-xs tabular-nums">
              {format.dateTime(fromISODate(transaction.occurredOn), 'dayMonth')}
            </span>

            {/* Tapping the row is how you change it; the pencil is for whoever
                looks for a button instead. */}
            <button
              type="button"
              onClick={() => setEditingId(transaction.id)}
              className="min-w-0 flex-1 truncate text-left text-sm"
            >
              {label(transaction)}
            </button>

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

            {/* Visible on a phone, where there is no hover to reveal them. */}
            <span className="flex shrink-0 items-center gap-1 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <button
                type="button"
                disabled={pending}
                aria-label={`${tc('edit')} ${label(transaction)}`}
                onClick={() => setEditingId(transaction.id)}
                className="text-text-subtle hover:text-text p-1"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                type="button"
                disabled={pending}
                aria-label={`${tc('delete')} ${label(transaction)}`}
                onClick={() =>
                  startTransition(async () => void (await removeTransaction(transaction.id)))
                }
                className="text-text-subtle hover:text-bad p-1"
              >
                <Trash2 className="size-3.5" />
              </button>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

type Patch = {
  occurredOn: string
  amount: number
  kind: 'income' | 'expense' | 'transfer'
  accountId: string
  counterAccountId: string | null
  categoryId: string | null
  merchant: string | null
  note: string | null
}

/**
 * The row opens into the same shape of fields it was typed in, rather than a
 * dialog on top of the page.
 *
 * A form, because the amount field keeps its plain number in a hidden sibling
 * and every other money field in the app is read the same way — through
 * `FormData` rather than through React state.
 */
function TransactionEditor({
  transaction,
  accounts,
  categories,
  onSave,
  onClose,
  pending,
}: {
  transaction: Transaction
  accounts: Account[]
  categories: FinanceCategory[]
  onSave: (patch: Patch) => void
  onClose: () => void
  pending: boolean
}) {
  const t = useTranslations('finance')
  const tc = useTranslations('common')
  const [kind, setKind] = useState(transaction.kind)
  const [accountId, setAccountId] = useState(transaction.accountId)

  const relevant = categories.filter((category) =>
    kind === 'income' ? category.kind === 'income' : category.kind === 'expense',
  )

  // A transfer needs somewhere else to go. With one account the only
  // destination on offer would be the source, which the save rejects — so the
  // kind is not offered at all, unless the row already is one.
  const kinds = (['expense', 'income', 'transfer'] as const).filter(
    (option) => option !== 'transfer' || accounts.length > 1 || transaction.kind === 'transfer',
  )
  const destinations = accounts.filter((account) => account.id !== accountId)

  const submit = (formData: FormData) => {
    const text = (key: string) => {
      const value = String(formData.get(key) ?? '').trim()
      return value === '' ? null : value
    }

    onSave({
      occurredOn: text('occurredOn') ?? transaction.occurredOn,
      amount: Number(formData.get('amount') ?? 0),
      kind,
      accountId: accountId,
      counterAccountId: kind === 'transfer' ? text('counterAccountId') : null,
      categoryId: kind === 'transfer' ? null : text('categoryId'),
      merchant: text('merchant'),
      // Kept as it was: the note is not in this row, and leaving it out of the
      // patch would quietly wipe whatever the capture box wrote there.
      note: transaction.note,
    })
  }

  return (
    <form
      action={submit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <label className="w-28 space-y-1.5">
        <span className="text-text-muted text-xs font-medium">{t('kind')}</span>
        <Select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
          {kinds.map((option) => (
            <option key={option} value={option}>
              {t(`kinds.${option}`)}
            </option>
          ))}
        </Select>
      </label>

      <label className="w-32 space-y-1.5">
        <span className="text-text-muted text-xs font-medium">{t('amount')}</span>
        <MoneyInput
          autoFocus
          name="amount"
          required
          defaultValue={Number(transaction.amount)}
          className="text-right tabular-nums"
        />
      </label>

      <label className="min-w-36 flex-1 space-y-1.5">
        <span className="text-text-muted text-xs font-medium">{t('account')}</span>
        <Select
          name="accountId"
          required
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
      </label>

      {kind === 'transfer' ? (
        <label className="min-w-36 flex-1 space-y-1.5">
          <span className="text-text-muted text-xs font-medium">{t('toAccount')}</span>
          <Select
            name="counterAccountId"
            required
            defaultValue={transaction.counterAccountId ?? ''}
          >
            {destinations.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </label>
      ) : (
        <label className="min-w-36 flex-1 space-y-1.5">
          <span className="text-text-muted text-xs font-medium">{t('category')}</span>
          <Select name="categoryId" defaultValue={transaction.categoryId ?? ''}>
            <option value="">{t('noCategory')}</option>
            {relevant.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </label>
      )}

      <label className="min-w-32 flex-1 space-y-1.5">
        <span className="text-text-muted text-xs font-medium">{t('merchant')}</span>
        <Input name="merchant" maxLength={200} defaultValue={transaction.merchant ?? ''} />
      </label>

      <label className="w-36 space-y-1.5">
        <span className="text-text-muted text-xs font-medium">{t('date')}</span>
        <Input type="date" name="occurredOn" defaultValue={transaction.occurredOn} />
      </label>

      <div className="flex shrink-0 items-center gap-1 pb-1">
        <button
          type="submit"
          disabled={pending}
          aria-label={tc('save')}
          className="text-good hover:bg-surface rounded p-1.5"
        >
          <Check className="size-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={tc('cancel')}
          className="text-text-subtle hover:bg-surface hover:text-text rounded p-1.5"
        >
          <X className="size-4" />
        </button>
      </div>

      {kind === 'transfer' ? (
        <p className="text-text-subtle basis-full text-xs">{t('transferHint')}</p>
      ) : null}
    </form>
  )
}

'use client'

import { ArrowRightLeft, Check, Pencil, Trash2, User, X } from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import { Select } from '@/components/ui/select'
import { VirtualInfiniteList } from '@/components/ui/virtual-infinite-list'
import type { FinanceCategory, Transaction } from '@/lib/db/schema'
import { fromISODate } from '@/lib/dates'
import { formatMoney } from '@/lib/format/money'
import { removeTransaction, saveTransaction } from '@/server/actions/finance'
import { cn } from '@/lib/utils'
import type { PendingTransaction } from './pending'

type Account = { id: string; name: string }
type Person = { id: string; name: string }

/** Everything the row's title needs, which a pending row also has. */
type Titled = Pick<Transaction, 'kind' | 'merchant' | 'categoryId' | 'accountId'> & {
  counterAccountId: string | null
}

const ROW_ESTIMATE = 56

export function TransactionList({
  transactions,
  pending,
  categories,
  accounts,
  people,
  currency,
  emptyLabel,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  onRemoved,
}: {
  transactions: Transaction[]
  /** Rows sent but not confirmed; they sit above the ledger until it catches up. */
  pending: PendingTransaction[]
  categories: FinanceCategory[]
  accounts: Account[]
  people: Person[]
  currency: string
  /** Overrides the empty-state copy when filters leave nothing to show. */
  emptyLabel?: string
  loadingMore?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  onRemoved?: (id: string) => void
}) {
  const t = useTranslations('finance')
  const tc = useTranslations('common')
  const locale = useLocale()
  const format = useFormatter()
  const [editingId, setEditingId] = useState<string | null>(null)
  /**
   * Which row is mid-write. Plain state rather than `useTransition`, whose
   * pending flag also covers the page refresh that follows the write and so
   * left these buttons dead for seconds after the change had landed.
   */
  const [busyId, setBusyId] = useState<string | null>(null)

  const label = (transaction: Titled) => {
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

  const accountName = (id: string) => accounts.find((account) => account.id === id)?.name

  if (transactions.length === 0 && pending.length === 0) {
    return <p className="text-text-subtle text-sm">{emptyLabel ?? t('noTransactions')}</p>
  }

  return (
    <div className="space-y-1">
      {pending.length > 0 ? (
        <ul className="divide-border-base divide-y">
          {pending.map((row) => (
            // Faded, and without the pencil or the bin: there is no row on the
            // server yet for either of them to act on.
            <li key={row.key} className="flex items-center gap-3 py-2 opacity-50">
              <span className="text-text-subtle w-16 shrink-0 text-xs tabular-nums">
                {format.dateTime(fromISODate(row.occurredOn), 'dayMonth')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{label(row)}</span>
                {row.kind !== 'transfer' && accountName(row.accountId) ? (
                  <span className="text-text-subtle block truncate text-xs">
                    {accountName(row.accountId)}
                  </span>
                ) : null}
              </span>
              {row.personId ? (
                <Badge tone="accent">
                  <User className="size-3" />
                  {people.find((person) => person.id === row.personId)?.name ?? '—'}
                </Badge>
              ) : null}
              {row.kind === 'transfer' ? (
                <Badge>
                  <ArrowRightLeft className="size-3" />
                </Badge>
              ) : (
                <Badge tone={row.kind === 'income' ? 'good' : 'neutral'}>
                  {t(`kinds.${row.kind}`)}
                </Badge>
              )}
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {row.kind === 'income' ? '+' : row.kind === 'expense' ? '−' : ''}
                {formatMoney(row.amount, currency, locale)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <VirtualInfiniteList
        items={transactions}
        getKey={(row) => row.id}
        estimateSize={ROW_ESTIMATE}
        maxVisibleRows={{ base: 5, sm: 10 }}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={onLoadMore}
        loadingMoreLabel={tc('loading')}
        listClassName="divide-border-base divide-y"
        renderItem={(transaction) => {
          const editing = editingId === transaction.id
          return (
            <div
              className={cn(
                editing
                  ? 'glass rounded-[var(--radius)] p-2'
                  : 'group grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-2 sm:flex sm:gap-3',
              )}
            >
              {editing ? (
                <TransactionEditor
                  transaction={transaction}
                  accounts={accounts}
                  categories={categories}
                  people={people}
                  pending={busyId === transaction.id}
                  onClose={() => setEditingId(null)}
                  onSave={async (patch) => {
                    setBusyId(transaction.id)
                    try {
                      const result = await saveTransaction({ id: transaction.id, ...patch })
                      if (!result.ok) {
                        toast.error(tc('error'))
                        return
                      }
                      setEditingId(null)
                      toast.success(t('saved'))
                    } finally {
                      setBusyId(null)
                    }
                  }}
                />
              ) : (
                <>
                  {/* Tapping the row is how you change it; the pencil is for whoever
                      looks for a button instead. */}
                  <button
                    type="button"
                    onClick={() => setEditingId(transaction.id)}
                    className="min-w-0 truncate text-left sm:order-2 sm:flex-1"
                  >
                    <span className="block truncate text-sm">{label(transaction)}</span>
                    {transaction.kind !== 'transfer' && accountName(transaction.accountId) ? (
                      <span className="text-text-subtle block truncate text-xs">
                        {accountName(transaction.accountId)}
                      </span>
                    ) : null}
                  </button>

                  <span
                    className={cn(
                      'text-right text-sm font-medium tabular-nums sm:order-4 sm:shrink-0',
                      transaction.kind === 'income' ? 'text-good' : 'text-text',
                    )}
                  >
                    {transaction.kind === 'income'
                      ? '+'
                      : transaction.kind === 'expense'
                        ? '−'
                        : ''}
                    {formatMoney(
                      Number(transaction.amount),
                      transaction.currency || currency,
                      locale,
                    )}
                  </span>

                  <span className="flex min-w-0 items-center gap-2 sm:contents">
                    <span className="text-text-subtle shrink-0 text-xs tabular-nums sm:order-1 sm:w-16">
                      {format.dateTime(fromISODate(transaction.occurredOn), 'dayMonth')}
                    </span>

                    {transaction.personId ? (
                      <Badge tone="accent" className="min-w-0 sm:order-3">
                        <User className="size-3 shrink-0" />
                        <span className="truncate">
                          {people.find((person) => person.id === transaction.personId)?.name ??
                            '—'}
                        </span>
                      </Badge>
                    ) : null}

                    {transaction.kind === 'transfer' ? (
                      <Badge className="sm:order-3">
                        <ArrowRightLeft className="size-3" />
                      </Badge>
                    ) : (
                      <Badge
                        tone={transaction.kind === 'income' ? 'good' : 'neutral'}
                        className="sm:order-3"
                      >
                        {t(`kinds.${transaction.kind}`)}
                      </Badge>
                    )}
                  </span>

                  {/* Visible on a phone, where there is no hover to reveal them. */}
                  <span className="flex shrink-0 items-center justify-end gap-1 sm:order-5 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                    <button
                      type="button"
                      disabled={busyId === transaction.id}
                      aria-label={`${tc('edit')} ${label(transaction)}`}
                      onClick={() => setEditingId(transaction.id)}
                      className="text-text-subtle hover:text-text p-1"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={busyId === transaction.id}
                      aria-label={`${tc('delete')} ${label(transaction)}`}
                      onClick={async () => {
                        setBusyId(transaction.id)
                        try {
                          await removeTransaction(transaction.id)
                          onRemoved?.(transaction.id)
                        } finally {
                          setBusyId(null)
                        }
                      }}
                      className="text-text-subtle hover:text-bad p-1"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                </>
              )}
            </div>
          )
        }}
      />
    </div>
  )
}

type Patch = {
  occurredOn: string
  amount: number
  kind: 'income' | 'expense' | 'transfer'
  accountId: string
  counterAccountId: string | null
  categoryId: string | null
  personId: string | null
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
  people,
  onSave,
  onClose,
  pending,
}: {
  transaction: Transaction
  accounts: Account[]
  categories: FinanceCategory[]
  people: Person[]
  onSave: (patch: Patch) => Promise<void>
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

  // `onSubmit` rather than `action`: a form action runs inside a transition,
  // and the saving flag set in there would not reach the screen until the
  // transition — refreshed page and all — had finished.
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const text = (key: string) => {
      const value = String(formData.get(key) ?? '').trim()
      return value === '' ? null : value
    }

    void onSave({
      occurredOn: text('occurredOn') ?? transaction.occurredOn,
      amount: Number(formData.get('amount') ?? 0),
      kind,
      accountId: accountId,
      counterAccountId: kind === 'transfer' ? text('counterAccountId') : null,
      categoryId: kind === 'transfer' ? null : text('categoryId'),
      personId: kind === 'transfer' ? null : text('personId'),
      merchant: text('merchant'),
      // Kept as it was: the note is not in this row, and leaving it out of the
      // patch would quietly wipe whatever the capture box wrote there.
      note: transaction.note,
    })
  }

  return (
    <form
      onSubmit={submit}
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

      {kind === 'transfer' || people.length === 0 ? null : (
        <label className="min-w-36 flex-1 space-y-1.5">
          <span className="text-text-muted text-xs font-medium">{t('debt')}</span>
          <Select name="personId" defaultValue={transaction.personId ?? ''}>
            <option value="">{t('notDebt')}</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        </label>
      )}

      <label className="min-w-32 flex-1 space-y-1.5">
        <span className="text-text-muted text-xs font-medium">{t('merchant')}</span>
        <Input name="merchant" maxLength={200} defaultValue={transaction.merchant ?? ''} />
      </label>

      <label className="w-full space-y-1.5 sm:w-36">
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

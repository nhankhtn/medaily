'use client'

import { ArrowRightLeft, Pencil, Send, Trash2, User } from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import { Select } from '@/components/ui/select'
import { VirtualInfiniteList } from '@/components/ui/virtual-infinite-list'
import type { FinanceCategory, Transaction } from '@/lib/db/schema'
import { fromISODate } from '@/lib/dates'
import { formatMoney } from '@/lib/format/money'
import { canReceive, type Payee } from '@/lib/finance/payee'
import { transferNote } from '@/lib/finance/vietqr'
import {
  markTransactionTransferred,
  removeTransaction,
  restoreTransaction,
  saveTransaction,
} from '@/server/actions/finance'
import { TransferDialog } from './transfer-dialog'
import { cn } from '@/lib/utils'
import type { PendingTransaction } from './pending'

type Account = { id: string; name: string }

/** Everything the row's title needs, which a pending row also has. */
type Titled = Pick<Transaction, 'kind' | 'merchant' | 'categoryId' | 'accountId'> & {
  counterAccountId: string | null
}

const ROW_ESTIMATE = 56
/** The same row on a phone, where it stacks onto two lines. Measured, not guessed. */
const PHONE_ROW_ESTIMATE = 104

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
  onRestored,
}: {
  transactions: Transaction[]
  /** Rows sent but not confirmed; they sit above the ledger until it catches up. */
  pending: PendingTransaction[]
  categories: FinanceCategory[]
  accounts: Account[]
  people: Payee[]
  currency: string
  /** Overrides the empty-state copy when filters leave nothing to show. */
  emptyLabel?: string
  loadingMore?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  onRemoved?: (id: string) => void
  /** Puts an undone delete back in the list without waiting for a refetch. */
  onRestored?: (transaction: Transaction) => void
}) {
  const t = useTranslations('finance')
  const tc = useTranslations('common')
  const locale = useLocale()
  const format = useFormatter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing =
    editingId === null ? null : (transactions.find((row) => row.id === editingId) ?? null)
  /** The row whose money has not been handed over yet, while its sheet is open. */
  const [transfer, setTransfer] = useState<{
    id: string
    payee: Payee
    amount: number
    reference: string
  } | null>(null)
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

  /** `2026-09-22` as `22/09`, which is what fits a bank reference line. */
  const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

  /**
   * The person still waiting to be paid back for this row, or null when there
   * is nobody, the hand-off is done, or their details have since been removed.
   */
  const payeeOf = (transaction: Transaction): Payee | null => {
    if (!transaction.payeePersonId || transaction.transferredAt) return null
    const payee = people.find((person) => person.id === transaction.payeePersonId)
    return payee && canReceive(payee) ? payee : null
  }

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
        phoneEstimateSize={PHONE_ROW_ESTIMATE}
        maxVisibleRows={{ base: 5, sm: 10 }}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={onLoadMore}
        loadingMoreLabel={tc('loading')}
        listClassName="divide-border-base divide-y"
        renderItem={(transaction) => {
          return (
            <div className="group grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-2 sm:flex sm:gap-3">
              {
                <>
                  {/* The slot holds the row's width; only the name inside it is
                      the button. Stretching the button across the slot made the
                      empty space beside the badges open the editor, which is
                      how a tap aimed at something else landed here. */}
                  <span className="min-w-0 sm:order-2 sm:flex-1">
                    <button
                      type="button"
                      onClick={() => setEditingId(transaction.id)}
                      className="hover:text-accent inline-block max-w-full truncate text-left align-top text-sm"
                    >
                      {label(transaction)}
                    </button>
                    {transaction.kind !== 'transfer' && accountName(transaction.accountId) ? (
                      <span className="text-text-subtle block truncate text-xs">
                        {accountName(transaction.accountId)}
                      </span>
                    ) : null}
                  </span>

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
                          {people.find((person) => person.id === transaction.personId)?.name ?? '—'}
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
                  <span className="flex shrink-0 items-center justify-end gap-1.5 sm:order-5 sm:gap-1">
                    {/* Stays lit rather than hiding behind hover like edit and
                        delete: it is the row asking for something, not an
                        action offered on a row that is already settled. */}
                    {payeeOf(transaction) ? (
                      <button
                        type="button"
                        aria-label={`${t('transfer.title')} ${label(transaction)}`}
                        onClick={() => {
                          const payee = payeeOf(transaction)
                          if (!payee) return
                          setTransfer({
                            id: transaction.id,
                            payee,
                            amount: Number(transaction.amount),
                            reference: transferNote(
                              [transaction.merchant, dayMonth(transaction.occurredOn)],
                              transaction.id,
                            ),
                          })
                        }}
                        className="text-accent hover:bg-surface-2 inline-flex size-10 shrink-0 items-center justify-center rounded-full sm:size-8"
                      >
                        <Send className="size-4 sm:size-3.5" />
                      </button>
                    ) : null}
                    <span className="flex items-center gap-1.5 sm:gap-1 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                      <button
                        type="button"
                        disabled={busyId === transaction.id}
                        aria-label={`${tc('edit')} ${label(transaction)}`}
                        onClick={() => setEditingId(transaction.id)}
                        className="text-text-subtle hover:bg-surface-2 hover:text-text inline-flex size-10 shrink-0 items-center justify-center rounded-full sm:size-8"
                      >
                        <Pencil className="size-4 sm:size-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={busyId === transaction.id}
                        aria-label={`${tc('delete')} ${label(transaction)}`}
                        onClick={async () => {
                          setBusyId(transaction.id)
                          try {
                            const result = await removeTransaction(transaction.id)
                            onRemoved?.(transaction.id)
                            const removed = result.removed
                            if (!removed) return
                            toast.success(t('transactionDeleted', { what: label(transaction) }), {
                              action: {
                                label: tc('undo'),
                                onClick: () => {
                                  void restoreTransaction({
                                    ...removed,
                                    amount: Number(removed.amount),
                                  }).then((undone) => {
                                    if (undone.ok) onRestored?.(removed)
                                    else toast.error(tc('error'))
                                  })
                                },
                              },
                            })
                          } finally {
                            setBusyId(null)
                          }
                        }}
                        className="text-text-subtle hover:bg-surface-2 hover:text-bad inline-flex size-10 shrink-0 items-center justify-center rounded-full sm:size-8"
                      >
                        <Trash2 className="size-4 sm:size-3.5" />
                      </button>
                    </span>
                  </span>
                </>
              }
            </div>
          )
        }}
      />

      {/* On top of the page rather than in the row. The row is a dense line of
          small controls, and swapping it for a form made the thing you were
          aiming at move under your finger. */}
      <Dialog open={editing !== null} onOpenChange={(next) => (next ? null : setEditingId(null))}>
        <DialogContent title={tc('edit')}>
          {editing ? (
            <TransactionEditor
              transaction={editing}
              accounts={accounts}
              categories={categories}
              people={people}
              pending={busyId === editing.id}
              onClose={() => setEditingId(null)}
              onSave={async (patch) => {
                setBusyId(editing.id)
                try {
                  const result = await saveTransaction({ id: editing.id, ...patch })
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
          ) : null}
        </DialogContent>
      </Dialog>

      <TransferDialog
        open={transfer !== null}
        onOpenChange={(next) => {
          if (!next) setTransfer(null)
        }}
        payees={people}
        payee={transfer?.payee ?? null}
        amount={transfer?.amount ?? 0}
        reference={transfer?.reference ?? ''}
        currency={currency}
        onTransferred={async () => {
          if (!transfer) return
          const result = await markTransactionTransferred({ id: transfer.id })
          if (!result.ok) toast.error(tc('error'))
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
  payeePersonId: string | null
  merchant: string | null
}

/**
 * The same fields the row was typed in, opened in a dialog.
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
  people: Payee[]
  onSave: (patch: Patch) => Promise<void>
  onClose: () => void
  pending: boolean
}) {
  const t = useTranslations('finance')
  const tc = useTranslations('common')
  const [kind, setKind] = useState(transaction.kind)
  /** Only contacts money can actually be sent to; the rest would be a dead end. */
  const payable = people.filter(canReceive)
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
      payeePersonId: kind === 'transfer' ? null : text('payeePersonId'),
      merchant: text('merchant'),
    })
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
      className="grid grid-cols-2 items-end gap-2"
    >
      <label className="min-w-0 space-y-1.5">
        <span className="text-text-muted text-xs font-medium">{t('kind')}</span>
        <Select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
          {kinds.map((option) => (
            <option key={option} value={option}>
              {t(`kinds.${option}`)}
            </option>
          ))}
        </Select>
      </label>

      <label className="min-w-0 space-y-1.5">
        <span className="text-text-muted text-xs font-medium">{t('amount')}</span>
        <MoneyInput
          autoFocus
          name="amount"
          required
          defaultValue={Number(transaction.amount)}
          className="text-right tabular-nums"
        />
      </label>

      <label className="min-w-0 space-y-1.5">
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
        <label className="min-w-0 space-y-1.5">
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
        <label className="min-w-0 space-y-1.5">
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
        <label className="min-w-0 space-y-1.5">
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

      {/* The way a row saved with plain Save can still be pointed at someone.
          Without it the payee could only ever be set as the row was created. */}
      {kind === 'transfer' || payable.length === 0 ? null : (
        <label className="min-w-0 space-y-1.5">
          <span className="text-text-muted text-xs font-medium">{t('transfer.title')}</span>
          <Select name="payeePersonId" defaultValue={transaction.payeePersonId ?? ''}>
            <option value="">{t('transfer.nobodyShort')}</option>
            {payable.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        </label>
      )}

      <label className="col-span-2 min-w-0 space-y-1.5">
        <span className="text-text-muted text-xs font-medium">{t('merchant')}</span>
        <Input name="merchant" maxLength={200} defaultValue={transaction.merchant ?? ''} />
      </label>

      <label className="col-span-2 min-w-0 space-y-1.5">
        <span className="text-text-muted text-xs font-medium">{t('date')}</span>
        <Input type="date" name="occurredOn" defaultValue={transaction.occurredOn} />
      </label>

      <div className="col-span-2 flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onClose}>
          {tc('cancel')}
        </Button>
        <Button type="submit" disabled={pending}>
          {tc('save')}
        </Button>
      </div>

      {kind === 'transfer' ? (
        <p className="text-text-subtle col-span-2 text-xs">{t('transferHint')}</p>
      ) : null}
    </form>
  )
}

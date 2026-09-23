'use client'

import { useCallback, useEffect, useOptimistic, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { FinanceCategory, Transaction } from '@/lib/db/schema'
import type { ISODate } from '@/lib/dates'
import type { Payee } from '@/lib/finance/payee'
import { foldText } from '@/lib/text'
import { useCursorPage } from '@/lib/hooks/use-cursor-page'
import { listTransactions } from '@/server/actions/finance'
import type { TransactionPage } from '@/server/repositories/finance'
import type { PendingTransaction } from './pending'
import { useQueuedTransactions } from './pending-transactions'
import { TransactionForm } from './transaction-form'
import { TransactionList } from './transaction-list'

const transactionId = (row: Transaction) => row.id

/**
 * Holds the rows that have been sent but not yet confirmed.
 *
 * The ledger below is rendered from server data, which cannot include a new
 * row until the next render arrives from the server — a wait of a quarter
 * second on the deploy and rather more from a laptop. `useOptimistic` fills
 * that gap: its setter applies on the current frame even inside the transition
 * the form action runs in, and the list empties itself when the refreshed
 * first page makes it redundant.
 *
 * Confirmed rows are cursor-paged from the server; changing a filter resets
 * the list and loads page one again.
 */
export function TransactionPanel({
  initialPage,
  categories,
  accounts,
  people,
  currency,
  today,
}: {
  initialPage: TransactionPage
  categories: FinanceCategory[]
  accounts: { id: string; name: string; type: string; currency: string }[]
  people: Payee[]
  currency: string
  today: ISODate
}) {
  const t = useTranslations('finance')
  const tc = useTranslations('common')
  const [pending, addPending] = useOptimistic<PendingTransaction[], PendingTransaction>(
    [],
    (current, row) => [row, ...current],
  )
  const queued = useQueuedTransactions()
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')
  /*
   * What the query actually runs on. Every keystroke changes `queryKey`, and
   * without the delay each one would throw away the page in flight and ask
   * for another.
   */
  const [settledSearch, setSettledSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setSettledSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const filtering = Boolean(accountId || categoryId || from || to || settledSearch)
  const queryKey = [accountId, categoryId, from, to, settledSearch].filter(Boolean).join('|')

  const filterInput = useCallback(() => {
    return {
      ...(accountId ? { accountId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(settledSearch ? { search: settledSearch } : {}),
    }
  }, [accountId, categoryId, from, to, settledSearch])

  const fetchPage = useCallback(
    async (cursor: string | null) => {
      const result = await listTransactions({
        ...filterInput(),
        ...(cursor ? { cursor } : {}),
      })
      if (!result.ok) return { ok: false as const }
      return { ok: true as const, items: result.items, nextCursor: result.nextCursor }
    },
    [filterInput],
  )

  const { items, setItems, loading, loadingMore, hasMore, loadMore, removeItem } = useCursorPage({
    initialPage,
    queryKey,
    fetchPage,
    getId: transactionId,
  })

  // An undone delete slots back in by date rather than at the top, so the row
  // reappears where the eye left it. The ledger is newest first.
  const restoreItem = useCallback(
    (row: Transaction) => {
      setItems((current) =>
        current.some((item) => transactionId(item) === row.id)
          ? current
          : [...current, row].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)),
      )
    },
    [setItems],
  )

  const names = accounts.map((account) => ({ id: account.id, name: account.name }))

  const matchesPending = (row: {
    key: string
    accountId: string
    counterAccountId: string | null
    categoryId: string | null
    occurredOn: string
    merchant: string | null
  }) => {
    if (settledSearch) {
      const needle = foldText(settledSearch)
      const merchant = foldText(row.merchant ?? '')
      const reference = row.key.replace(/-/g, '').toLowerCase()
      if (!merchant.includes(needle) && !reference.startsWith(needle)) return false
    }
    if (accountId) {
      const hit = row.accountId === accountId || row.counterAccountId === accountId
      if (!hit) return false
    }
    if (categoryId === '__none__') {
      if (row.categoryId !== null) return false
    } else if (categoryId && row.categoryId !== categoryId) {
      return false
    }
    if (from && row.occurredOn < from) return false
    if (to && row.occurredOn > to) return false
    return true
  }

  /*
   * Two kinds of row sit above the ledger, and they are not the same thing.
   * `pending` is optimistic — the save is in flight, and React drops it the
   * moment the action settles. `queued` is on the device because there was no
   * network; it has to outlive the action, or a transaction typed with no
   * signal would blink out while the server has no record of it either.
   *
   * A row in both is the same save seen twice: they share the id the form
   * chose, so the queued copy wins and the optimistic one is dropped.
   */
  const queuedRows: PendingTransaction[] = queued.map((entry) => ({
    key: entry.id,
    occurredOn: entry.occurredOn,
    kind: entry.kind,
    amount: entry.amount,
    accountId: entry.accountId,
    counterAccountId: entry.counterAccountId,
    categoryId: entry.categoryId,
    personId: entry.personId,
    merchant: entry.merchant,
  }))

  const queuedKeys = new Set(queuedRows.map((row) => row.key))
  const filteredPending = [
    ...queuedRows,
    ...pending.filter((row) => !queuedKeys.has(row.key)),
  ].filter(matchesPending)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('addTransactionTitle')} />
        <CardBody>
          <TransactionForm
            accounts={names}
            categories={categories}
            people={people}
            currency={currency}
            today={today}
            onPending={addPending}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('transactions')} />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-36 flex-1 space-y-1.5 sm:max-w-48">
              <span className="text-text-muted text-xs font-medium">{t('account')}</span>
              <Select
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                aria-label={t('account')}
              >
                <option value="">{t('filterAllAccounts')}</option>
                {names.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </label>

            <label className="min-w-36 flex-1 space-y-1.5 sm:max-w-48">
              <span className="text-text-muted text-xs font-medium">{t('category')}</span>
              <Select
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                aria-label={t('category')}
              >
                <option value="">{t('filterAllCategories')}</option>
                <option value="__none__">{t('noCategory')}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </label>

            <label className="min-w-36 flex-1 space-y-1.5 sm:max-w-56">
              <span className="text-text-muted text-xs font-medium">{t('search')}</span>
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('searchPlaceholder')}
              />
            </label>

            <label className="w-36 space-y-1.5 sm:w-40">
              <span className="text-text-muted text-xs font-medium">{t('filterFrom')}</span>
              <Input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>

            <label className="w-36 space-y-1.5 sm:w-40">
              <span className="text-text-muted text-xs font-medium">{t('filterTo')}</span>
              <Input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </div>

          {loading ? (
            <p className="text-text-subtle text-sm">{tc('loading')}</p>
          ) : (
            <TransactionList
              transactions={items}
              pending={filteredPending}
              categories={categories}
              accounts={names}
              people={people}
              currency={currency}
              emptyLabel={filtering ? t('noMatchingTransactions') : t('noTransactions')}
              loadingMore={loadingMore}
              hasMore={hasMore}
              onLoadMore={loadMore}
              onRemoved={removeItem}
              onRestored={restoreItem}
            />
          )}
        </CardBody>
      </Card>
    </div>
  )
}

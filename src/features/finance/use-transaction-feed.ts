'use client'

import { useCallback, useOptimistic, useState } from 'react'
import type { FinanceCategory, Transaction } from '@/lib/db/schema'
import { useCursorPage } from '@/lib/hooks/use-cursor-page'
import { useDebounced } from '@/lib/hooks/use-debounced'
import { foldText } from '@/lib/text'
import { listTransactions } from '@/server/actions/finance'
import type { TransactionPage } from '@/server/repositories/finance'
import type { PendingTransaction } from './pending'
import { useQueuedTransactions } from './pending-transactions'

const transactionId = (row: Transaction) => row.id

export type LedgerFilters = {
  accountId: string
  /** `__none__` means uncategorised only. */
  categoryId: string
  from: string
  to: string
  search: string
}

const NO_FILTERS: LedgerFilters = {
  accountId: '',
  categoryId: '',
  from: '',
  to: '',
  search: '',
}

/** Long enough that a word typed at speed asks the server once. */
const SEARCH_DELAY = 300

/**
 * Everything the ledger does, with none of how it looks.
 *
 * Phone and desktop arrange these controls differently enough to be separate
 * components, and the one thing that must not be duplicated with them is this:
 * two copies would mean two filter states, two cursors and two calls to
 * `listTransactions` for one screen.
 */
export function useTransactionFeed({
  initialPage,
  categories,
}: {
  initialPage: TransactionPage
  categories: FinanceCategory[]
}) {
  const [pending, addPending] = useOptimistic<PendingTransaction[], PendingTransaction>(
    [],
    (current, row) => [row, ...current],
  )
  const queued = useQueuedTransactions()

  const [filters, setFilters] = useState<LedgerFilters>(NO_FILTERS)

  /** One setter for five fields, so a new filter is a key rather than a pair of hooks. */
  const setFilter = useCallback(
    <K extends keyof LedgerFilters>(key: K, value: LedgerFilters[K]) =>
      setFilters((current) => ({ ...current, [key]: value })),
    [],
  )

  const { accountId, categoryId, from, to } = filters
  const search = useDebounced(filters.search.trim(), SEARCH_DELAY)

  const filtering = Boolean(accountId || categoryId || from || to || search)
  // Search is never hidden behind anything, so it is not one that needs counting.
  const activeFilters = [accountId, categoryId, from, to].filter(Boolean).length
  const queryKey = [accountId, categoryId, from, to, search].filter(Boolean).join('|')

  const filterInput = useCallback(
    () => ({
      ...(accountId ? { accountId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(search ? { search } : {}),
    }),
    [accountId, categoryId, from, to, search],
  )

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

  const matchesPending = (row: PendingTransaction) => {
    if (search) {
      const needle = foldText(search)
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
  const pendingRows = [...queuedRows, ...pending.filter((row) => !queuedKeys.has(row.key))].filter(
    matchesPending,
  )

  return {
    categories,
    filters,
    setFilter,
    activeFilters,
    filtering,
    rows: { items, pendingRows, loading, loadingMore, hasMore, loadMore, removeItem, restoreItem },
    addPending,
  }
}

export type TransactionFeed = ReturnType<typeof useTransactionFeed>

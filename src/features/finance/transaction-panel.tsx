'use client'

import { useOptimistic, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { FinanceCategory, Transaction } from '@/lib/db/schema'
import type { ISODate } from '@/lib/dates'
import type { PendingTransaction } from './pending'
import { TransactionForm } from './transaction-form'
import { TransactionList } from './transaction-list'

/**
 * Holds the rows that have been sent but not yet confirmed.
 *
 * The ledger below is rendered from server data, which cannot include a new
 * row until the next render arrives from the server — a wait of a quarter
 * second on the deploy and rather more from a laptop. `useOptimistic` fills
 * that gap: its setter applies on the current frame even inside the transition
 * the form action runs in, and the list empties itself when the refreshed
 * `transactions` prop makes it redundant.
 *
 * The form is its own card so adding a row is not buried under the ledger, and
 * the list card carries the account / category / date filters for the month's history.
 */
export function TransactionPanel({
  transactions,
  categories,
  accounts,
  people,
  currency,
  today,
}: {
  transactions: Transaction[]
  categories: FinanceCategory[]
  accounts: { id: string; name: string; type: string; currency: string }[]
  people: { id: string; name: string }[]
  currency: string
  today: ISODate
}) {
  const t = useTranslations('finance')
  const [pending, addPending] = useOptimistic<PendingTransaction[], PendingTransaction>(
    [],
    (current, row) => [row, ...current],
  )
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const names = accounts.map((account) => ({ id: account.id, name: account.name }))

  const matches = (row: {
    accountId: string
    counterAccountId: string | null
    categoryId: string | null
    occurredOn: string
  }) => {
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

  const filtered = transactions.filter(matches)
  const filteredPending = pending.filter(matches)
  const filtering = Boolean(accountId || categoryId || from || to)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('addTransactionTitle')} />
        <CardBody>
          <TransactionForm
            accounts={names}
            categories={categories}
            people={people}
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

          <TransactionList
            transactions={filtered}
            pending={filteredPending}
            categories={categories}
            accounts={names}
            people={people}
            currency={currency}
            emptyLabel={filtering ? t('noMatchingTransactions') : t('noTransactions')}
          />
        </CardBody>
      </Card>
    </div>
  )
}

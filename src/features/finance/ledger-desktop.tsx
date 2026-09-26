'use client'

import { useTranslations } from 'next-intl'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { FinanceData } from '@/server/services/finance'
import { TransactionForm } from './transaction-form'
import { TransactionList } from './transaction-list'
import { useTransactionFeed } from './use-transaction-feed'

/**
 * The wide layout: every filter on one row above the ledger. Nothing folds
 * away, because there is room for all of it.
 *
 * Its phone counterpart is a separate component rather than the same one under
 * breakpoint classes — the two disagree about grouping and order, not just
 * width, and one file per layout is one file to read. What they must not
 * disagree about is behaviour, which is why both drive `useTransactionFeed`.
 */
export function LedgerDesktop({ data }: { data: FinanceData }) {
  const t = useTranslations('finance')
  const tc = useTranslations('common')
  const { filters, setFilter, filtering, rows, addPending } = useTransactionFeed({
    initialPage: data.transactionsPage,
    categories: data.categories,
  })
  const names = data.accounts.map((account) => ({ id: account.id, name: account.name }))

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('addTransactionTitle')} />
        <CardBody>
          <TransactionForm
            accounts={names}
            categories={data.categories}
            people={data.people}
            currency={data.currency}
            today={data.today}
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
                value={filters.accountId}
                onChange={(event) => setFilter('accountId', event.target.value)}
                aria-label={t('account')}
              >
                <option value="">{t('filterAll')}</option>
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
                value={filters.categoryId}
                onChange={(event) => setFilter('categoryId', event.target.value)}
                aria-label={t('category')}
              >
                <option value="">{t('filterAll')}</option>
                <option value="__none__">{t('noCategory')}</option>
                {data.categories.map((category) => (
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
                value={filters.search}
                onChange={(event) => setFilter('search', event.target.value)}
                placeholder={t('searchPlaceholder')}
              />
            </label>

            <label className="w-40 space-y-1.5">
              <span className="text-text-muted text-xs font-medium">{t('filterFrom')}</span>
              <Input
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(event) => setFilter('from', event.target.value)}
              />
            </label>

            <label className="w-40 space-y-1.5">
              <span className="text-text-muted text-xs font-medium">{t('filterTo')}</span>
              <Input
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(event) => setFilter('to', event.target.value)}
              />
            </label>
          </div>

          {rows.loading ? (
            <p className="text-text-subtle text-sm">{tc('loading')}</p>
          ) : (
            <TransactionList
              transactions={rows.items}
              pending={rows.pendingRows}
              categories={data.categories}
              accounts={names}
              people={data.people}
              currency={data.currency}
              emptyLabel={filtering ? t('noMatchingTransactions') : t('noTransactions')}
              loadingMore={rows.loadingMore}
              hasMore={rows.hasMore}
              onLoadMore={rows.loadMore}
              onRemoved={rows.removeItem}
              onRestored={rows.restoreItem}
              onUpdated={rows.updateItem}
            />
          )}
        </CardBody>
      </Card>
    </div>
  )
}

'use client'

import { SlidersHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { FinanceData } from '@/server/services/finance'
import { TransactionForm } from './transaction-form'
import { TransactionList } from './transaction-list'
import { useTransactionFeed } from './use-transaction-feed'

/**
 * The phone layout. Five filters will not share a row with a search box, so
 * they fold behind one button and open two to a row underneath.
 *
 * Its desktop counterpart is a separate component. Both drive
 * `useTransactionFeed`, which is what keeps one filter state and one cursor
 * however differently the two arrange them.
 */
export function LedgerMobile({ data }: { data: FinanceData }) {
  const t = useTranslations('finance')
  const tc = useTranslations('common')
  const { filters, setFilter, activeFilters, filtering, rows, addPending } = useTransactionFeed({
    initialPage: data.transactionsPage,
    categories: data.categories,
  })
  const [filtersOpen, setFiltersOpen] = useState(false)
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
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1 space-y-1.5">
              <span className="text-text-muted text-xs font-medium">{t('search')}</span>
              <Input
                type="search"
                value={filters.search}
                onChange={(event) => setFilter('search', event.target.value)}
                placeholder={t('searchPlaceholder')}
              />
            </label>

            {/* Folded away, so the count is the only sign a filter is still on. */}
            <Button
              type="button"
              variant="outline"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
              className="shrink-0"
            >
              <SlidersHorizontal className="size-4" />
              {t('filters')}
              {activeFilters > 0 ? (
                <span className="bg-accent text-accent-text rounded-full px-1.5 text-xs tabular-nums">
                  {activeFilters}
                </span>
              ) : null}
            </Button>
          </div>

          {filtersOpen ? (
            <div className="space-y-2">
              {/* Two to a row. A date fits beside another because `Input` sends
                  `type="date"` through `DateInput`, which draws dd/mm/yyyy
                  rather than the long string Safari picks from the OS locale. */}
              <div className="grid grid-cols-2 gap-2">
                <label className="block min-w-0 space-y-1.5">
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

                <label className="block min-w-0 space-y-1.5">
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
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block min-w-0 space-y-1.5">
                  <span className="text-text-muted text-xs font-medium">{t('filterFrom')}</span>
                  <Input
                    type="date"
                    value={filters.from}
                    max={filters.to || undefined}
                    onChange={(event) => setFilter('from', event.target.value)}
                  />
                </label>

                <label className="block min-w-0 space-y-1.5">
                  <span className="text-text-muted text-xs font-medium">{t('filterTo')}</span>
                  <Input
                    type="date"
                    value={filters.to}
                    min={filters.from || undefined}
                    onChange={(event) => setFilter('to', event.target.value)}
                  />
                </label>
              </div>
            </div>
          ) : null}

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
            />
          )}
        </CardBody>
      </Card>
    </div>
  )
}

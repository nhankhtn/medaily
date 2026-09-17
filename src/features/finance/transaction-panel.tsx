'use client'

import { useOptimistic } from 'react'
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
  const [pending, addPending] = useOptimistic<PendingTransaction[], PendingTransaction>(
    [],
    (current, row) => [row, ...current],
  )

  const names = accounts.map((account) => ({ id: account.id, name: account.name }))

  return (
    <div className="space-y-4">
      <TransactionForm
        accounts={names}
        categories={categories}
        people={people}
        today={today}
        onPending={addPending}
      />
      <TransactionList
        transactions={transactions}
        pending={pending}
        categories={categories}
        accounts={names}
        people={people}
        currency={currency}
      />
    </div>
  )
}

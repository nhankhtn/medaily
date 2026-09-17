'use client'

import { Plus } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import { Select } from '@/components/ui/select'
import type { FinanceCategory } from '@/lib/db/schema'
import type { ISODate } from '@/lib/dates'
import { createTransaction } from '@/server/actions/finance'
import type { PendingTransaction } from './pending'

/**
 * One row that covers income, expense and transfer. The category field swaps
 * for a destination account when the kind is a transfer, because a transfer has
 * no category — it is not spending.
 */
export function TransactionForm({
  accounts,
  categories,
  people,
  today,
  onPending,
}: {
  accounts: { id: string; name: string }[]
  categories: FinanceCategory[]
  people: { id: string; name: string }[]
  today: ISODate
  /** Shows the row straight away; see `TransactionPanel`. */
  onPending: (row: PendingTransaction) => void
}) {
  const t = useTranslations('finance')
  useLocale()
  const [kind, setKind] = useState<'income' | 'expense' | 'transfer'>('expense')
  const formRef = useRef<HTMLFormElement>(null)

  if (accounts.length === 0) return null

  /**
   * The row is shown and the fields are cleared on this frame, before the
   * server has been asked. Both have to happen here rather than after the
   * await: React defers a `useState` setter inside a transition until the
   * transition ends, and this one ends only when the refreshed page arrives.
   *
   * Clearing the fields is also what makes a second click harmless, which is
   * why there is no disabled state on the button. The old one stayed disabled
   * until the refresh landed — seconds after the row was already saved.
   */
  const submit = async (formData: FormData) => {
    const input = {
      occurredOn: String(formData.get('occurredOn') ?? today),
      amount: Number(formData.get('amount') ?? 0),
      kind,
      accountId: String(formData.get('accountId') ?? ''),
      counterAccountId: emptyToNull(formData.get('counterAccountId')),
      categoryId: emptyToNull(formData.get('categoryId')),
      personId: emptyToNull(formData.get('personId')),
      merchant: String(formData.get('merchant') ?? ''),
      note: '',
    }

    onPending({
      key: crypto.randomUUID(),
      occurredOn: input.occurredOn,
      kind,
      amount: input.amount,
      accountId: input.accountId,
      counterAccountId: input.counterAccountId,
      categoryId: input.categoryId,
      personId: input.personId,
      merchant: input.merchant.trim() === '' ? null : input.merchant.trim(),
    })
    formRef.current?.reset()

    try {
      const result = await createTransaction(input)
      if (!result.ok) {
        toast.error(t('notSaved'))
        return
      }
      toast.success(t('saved'))
    } catch (error) {
      console.error('[finance] could not save the transaction:', error)
      toast.error(t('notSaved'))
    }
  }

  const relevantCategories = categories.filter((category) =>
    kind === 'income' ? category.kind === 'income' : category.kind === 'expense',
  )

  return (
    <form id="transaction-form" ref={formRef} action={submit} className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="w-28 space-y-1.5">
          <span className="text-text-muted text-xs font-medium">{t('kind')}</span>
          <Select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
            {(['expense', 'income', 'transfer'] as const).map((option) => (
              <option key={option} value={option}>
                {t(`kinds.${option}`)}
              </option>
            ))}
          </Select>
        </label>

        <label className="w-32 space-y-1.5">
          <span className="text-text-muted text-xs font-medium">{t('amount')}</span>
          <MoneyInput name="amount" required className="text-right tabular-nums" />
        </label>

        <label className="min-w-36 flex-1 space-y-1.5">
          <span className="text-text-muted text-xs font-medium">{t('account')}</span>
          <Select name="accountId" required>
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
            <Select name="counterAccountId" required>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </label>
        ) : (
          <label className="min-w-36 flex-1 space-y-1.5">
            <span className="text-text-muted text-xs font-medium">{t('category')}</span>
            <Select name="categoryId">
              <option value="">{t('noCategory')}</option>
              {relevantCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </label>
        )}

        {/* A transfer is between your own accounts, so there is nobody to owe. */}
        {kind === 'transfer' ? null : people.length === 0 ? null : (
          <label className="min-w-36 flex-1 space-y-1.5">
            <span className="text-text-muted text-xs font-medium">{t('debt')}</span>
            <Select name="personId">
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
          <Input name="merchant" maxLength={200} />
        </label>

        <label className="w-36 space-y-1.5">
          <span className="text-text-muted text-xs font-medium">{t('date')}</span>
          <Input type="date" name="occurredOn" defaultValue={today} />
        </label>

        <Button type="submit">
          <Plus className="size-4" />
          {t('addTransaction')}
        </Button>
      </div>

      {kind === 'transfer' ? <p className="text-text-subtle text-xs">{t('transferHint')}</p> : null}
    </form>
  )
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? '').trim()
  return text === '' ? null : text
}

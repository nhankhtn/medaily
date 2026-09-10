'use client'

import { Plus } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import { Select } from '@/components/ui/select'
import type { FinanceCategory } from '@/lib/db/schema'
import type { ISODate } from '@/lib/dates'
import { createTransaction } from '@/server/actions/finance'

/**
 * One row that covers income, expense and transfer. The category field swaps
 * for a destination account when the kind is a transfer, because a transfer has
 * no category — it is not spending.
 */
export function TransactionForm({
  accounts,
  categories,
  today,
}: {
  accounts: { id: string; name: string }[]
  categories: FinanceCategory[]
  today: ISODate
}) {
  const t = useTranslations('finance')
  const tc = useTranslations('common')
  useLocale()
  const [kind, setKind] = useState<'income' | 'expense' | 'transfer'>('expense')
  const [pending, startTransition] = useTransition()

  if (accounts.length === 0) return null

  const submit = (formData: FormData) => {
    startTransition(async () => {
      try {
        const result = await createTransaction({
          occurredOn: String(formData.get('occurredOn') ?? today),
          amount: Number(formData.get('amount') ?? 0),
          kind,
          accountId: String(formData.get('accountId') ?? ''),
          counterAccountId: emptyToNull(formData.get('counterAccountId')),
          categoryId: emptyToNull(formData.get('categoryId')),
          merchant: String(formData.get('merchant') ?? ''),
          note: '',
        })

        if (!result.ok) {
          toast.error(tc('error'))
          return
        }
        toast.success(t('saved'))
        const form = document.getElementById('transaction-form') as HTMLFormElement | null
        form?.reset()
      } catch (error) {
        console.error('[finance] could not save the transaction:', error)
        toast.error(tc('error'))
      }
    })
  }

  const relevantCategories = categories.filter((category) =>
    kind === 'income' ? category.kind === 'income' : category.kind === 'expense',
  )

  return (
    <form id="transaction-form" action={submit} className="space-y-2">
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

        <label className="min-w-32 flex-1 space-y-1.5">
          <span className="text-text-muted text-xs font-medium">{t('merchant')}</span>
          <Input name="merchant" maxLength={200} />
        </label>

        <label className="w-36 space-y-1.5">
          <span className="text-text-muted text-xs font-medium">{t('date')}</span>
          <Input type="date" name="occurredOn" defaultValue={today} />
        </label>

        <Button type="submit" disabled={pending}>
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

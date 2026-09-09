'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import { Select } from '@/components/ui/select'
import { Field } from '@/features/projects/project-dialog'
import type { FinanceCategory } from '@/lib/db/schema'
import type { ISODate } from '@/lib/dates'
import {
  createAccount,
  createAsset,
  createCategory,
  createInvestment,
  saveBudget,
} from '@/server/actions/finance'

const ACCOUNT_TYPES = ['cash', 'bank', 'credit_card', 'e_wallet', 'investment', 'loan'] as const

function useDialogAction(onDone: () => void) {
  const tc = useTranslations('common')
  const [pending, startTransition] = useTransition()

  const run = (action: () => Promise<{ ok: boolean }>) =>
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        toast.error(tc('error'))
        return
      }
      onDone()
    })

  return { pending, run }
}

export function AccountDialog({ defaultCurrency }: { defaultCurrency: string }) {
  const t = useTranslations('finance')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const { pending, run } = useDialogAction(() => {
    toast.success(t('saved'))
    setOpen(false)
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          {t('addAccount')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('addAccount')}>
        <form
          action={(formData) =>
            run(() =>
              createAccount({
                name: String(formData.get('name') ?? ''),
                type: formData.get('type'),
                currency: String(formData.get('currency') ?? defaultCurrency),
                openingBalance: Number(formData.get('openingBalance') ?? 0),
              }),
            )
          }
          className="space-y-3"
        >
          <Field label={t('accountName')}>
            <Input name="name" required autoFocus maxLength={120} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('accountType')}>
              <Select name="type" defaultValue="bank">
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`accountTypes.${type}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('currency')}>
              <Input name="currency" defaultValue={defaultCurrency} maxLength={3} minLength={3} />
            </Field>
          </div>
          <Field label={t('openingBalance')}>
            <MoneyInput name="openingBalance" defaultValue={0} allowNegative className="text-right tabular-nums" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {tc('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CategoryDialog() {
  const t = useTranslations('finance')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const { pending, run } = useDialogAction(() => {
    toast.success(t('saved'))
    setOpen(false)
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          {t('addCategory')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('addCategory')}>
        <form
          action={(formData) =>
            run(() =>
              createCategory({
                name: String(formData.get('name') ?? ''),
                kind: formData.get('kind'),
              }),
            )
          }
          className="space-y-3"
        >
          <Field label={t('accountName')}>
            <Input name="name" required autoFocus maxLength={120} />
          </Field>
          <Field label={t('kind')}>
            <Select name="kind" defaultValue="expense">
              <option value="expense">{t('kinds.expense')}</option>
              <option value="income">{t('kinds.income')}</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {tc('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function BudgetDialog({
  categories,
  monthStart,
}: {
  categories: FinanceCategory[]
  monthStart: ISODate
}) {
  const t = useTranslations('finance')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const { pending, run } = useDialogAction(() => {
    toast.success(t('saved'))
    setOpen(false)
  })

  // A budget is a limit on a category, so there is nothing to configure until
  // one exists. The caller shows the way forward instead (see the Budgets card).
  const expenseCategories = categories.filter((category) => category.kind === 'expense')
  if (expenseCategories.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          {t('addBudget')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('addBudget')}>
        <form
          action={(formData) =>
            run(() =>
              saveBudget({
                categoryId: String(formData.get('categoryId') ?? ''),
                periodStart: monthStart,
                amount: Number(formData.get('amount') ?? 0),
              }),
            )
          }
          className="space-y-3"
        >
          <Field label={t('category')}>
            <Select name="categoryId" required>
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('amount')}>
            <MoneyInput name="amount" required className="text-right tabular-nums" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {tc('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AssetDialog({ today }: { today: ISODate }) {
  const t = useTranslations('finance')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const { pending, run } = useDialogAction(() => {
    toast.success(t('saved'))
    setOpen(false)
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          {t('addAsset')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('assets')}>
        <form
          action={(formData) =>
            run(() =>
              createAsset({
                name: String(formData.get('name') ?? ''),
                kind: formData.get('kind'),
                value: Number(formData.get('value') ?? 0),
                asOf: String(formData.get('asOf') ?? today),
              }),
            )
          }
          className="space-y-3"
        >
          <Field label={t('accountName')}>
            <Input name="name" required autoFocus maxLength={120} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('kind')}>
              <Select name="kind" defaultValue="asset">
                <option value="asset">{t('asset')}</option>
                <option value="liability">{t('liability')}</option>
              </Select>
            </Field>
            <Field label={t('amount')}>
              <MoneyInput name="value" required className="text-right tabular-nums" />
            </Field>
          </div>
          <Field label={t('date')}>
            <Input type="date" name="asOf" defaultValue={today} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {tc('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function InvestmentDialog({ today }: { today: ISODate }) {
  const t = useTranslations('finance')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const { pending, run } = useDialogAction(() => {
    toast.success(t('saved'))
    setOpen(false)
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          {t('addInvestment')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('addInvestment')} description={t('noPriceFeed')}>
        <form
          action={(formData) =>
            run(() =>
              createInvestment({
                symbol: String(formData.get('symbol') ?? ''),
                quantity: Number(formData.get('quantity') ?? 0),
                avgCost: Number(formData.get('avgCost') ?? 0),
                lastPrice: formData.get('lastPrice') ? Number(formData.get('lastPrice')) : null,
                pricedAt: formData.get('lastPrice') ? today : null,
              }),
            )
          }
          className="space-y-3"
        >
          <div className="grid grid-cols-3 gap-3">
            <Field label={t('symbol')}>
              <Input name="symbol" required autoFocus maxLength={20} />
            </Field>
            <Field label={t('quantity')}>
              <Input type="number" name="quantity" step="any" min={0} required className="text-right tabular-nums" />
            </Field>
            <Field label={t('avgCost')}>
              <MoneyInput name="avgCost" required className="text-right tabular-nums" />
            </Field>
          </div>
          <Field label={t('lastPrice')}>
            <MoneyInput name="lastPrice" className="text-right tabular-nums" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {tc('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

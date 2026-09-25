'use client'

import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import { Select } from '@/components/ui/select'
import { AccountIcon } from '@/features/finance/account-icon'
import { Field } from '@/features/projects/project-dialog'
import type { FinanceCategory } from '@/lib/db/schema'
import type { ISODate } from '@/lib/dates'
import { ACCOUNT_TYPES, type AccountType } from '@/lib/finance/account-types'
import {
  createAccount,
  createAsset,
  createCategory,
  createInvestment,
  removeAccount,
  removeCategory,
  saveAccount,
  saveBudget,
  saveCategory,
} from '@/server/actions/finance'

function useDialogAction(onDone: () => void) {
  const tc = useTranslations('common')
  const [pending, startTransition] = useTransition()

  const run = (action: () => Promise<{ ok: boolean }>) =>
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) {
          toast.error(tc('error'))
          return
        }
        onDone()
      } catch (error) {
        console.error('[finance] action failed:', error)
        toast.error(tc('error'))
      }
    })

  return { pending, run }
}

export function AccountDialog({ defaultCurrency }: { defaultCurrency: string }) {
  const t = useTranslations('finance')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<AccountType>('bidv')
  const { pending, run } = useDialogAction(() => {
    toast.success(t('saved'))
    setOpen(false)
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-tour="account-new">
          <Plus className="size-4" />
          {t('addAccountShort')}
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('accountType')}>
              <div className="flex min-w-0 items-center gap-2">
                <AccountIcon type={type} />
                <Select
                  name="type"
                  value={type}
                  onChange={(event) => setType(event.target.value as AccountType)}
                  className="min-w-0"
                >
                  {ACCOUNT_TYPES.map((option) => (
                    <option key={option} value={option}>
                      {t(`accountTypes.${option}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </Field>
            <Field label={t('currency')}>
              <Input name="currency" defaultValue={defaultCurrency} maxLength={3} minLength={3} />
            </Field>
          </div>
          <Field label={t('openingBalance')}>
            <MoneyInput
              name="openingBalance"
              defaultValue={0}
              allowNegative
              className="text-right tabular-nums"
            />
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

export function AccountEditDialog({
  account,
}: {
  account: { id: string; name: string; type: AccountType; currency: string; openingBalance: string }
}) {
  const t = useTranslations('finance')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<AccountType>(account.type)
  const { pending, run } = useDialogAction(() => {
    toast.success(t('saved'))
    setOpen(false)
  })
  const [removing, startRemoving] = useTransition()

  const remove = () =>
    startRemoving(async () => {
      const result = await removeAccount({ id: account.id })
      if (!result.ok) {
        toast.error(tc('error'))
        return
      }
      toast.success(
        result.hidden ? t('accountHidden', { count: result.transactions }) : t('accountDeleted'),
      )
      setOpen(false)
    })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="group flex min-w-0 flex-1 items-center gap-1.5 text-left">
          <span className="group-hover:text-accent truncate text-sm">{account.name}</span>
          <Pencil className="text-text-subtle group-hover:text-accent size-3 shrink-0" />
        </button>
      </DialogTrigger>
      <DialogContent title={t('editAccount')} description={account.name}>
        <form
          action={(formData) =>
            run(() =>
              saveAccount({
                id: account.id,
                name: String(formData.get('name') ?? ''),
                type: formData.get('type'),
                currency: String(formData.get('currency') ?? account.currency),
                openingBalance: Number(formData.get('openingBalance') ?? 0),
              }),
            )
          }
          className="space-y-3"
        >
          <Field label={t('accountName')}>
            <Input name="name" required autoFocus maxLength={120} defaultValue={account.name} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('accountType')}>
              <div className="flex min-w-0 items-center gap-2">
                <AccountIcon type={type} />
                <Select
                  name="type"
                  value={type}
                  onChange={(event) => setType(event.target.value as AccountType)}
                  className="min-w-0"
                >
                  {ACCOUNT_TYPES.map((option) => (
                    <option key={option} value={option}>
                      {t(`accountTypes.${option}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </Field>
            <Field label={t('currency')}>
              <Input
                name="currency"
                defaultValue={account.currency}
                maxLength={3}
                minLength={3}
                required
              />
            </Field>
          </div>
          {/* The balance on the page is this plus every transaction, so this is
              the only part of it a person can correct. */}
          <Field label={t('openingBalance')}>
            <MoneyInput
              name="openingBalance"
              defaultValue={Number(account.openingBalance)}
              allowNegative
              className="text-right tabular-nums"
            />
          </Field>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="danger"
              className="mr-auto"
              disabled={removing || pending}
              onClick={remove}
            >
              <Trash2 className="size-4" />
              {t('removeAccount')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={pending || removing}>
              {tc('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CategoryDialog({ category }: { category?: FinanceCategory }) {
  const t = useTranslations('finance')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const editing = Boolean(category)
  const { pending, run } = useDialogAction(() => {
    toast.success(t('saved'))
    setOpen(false)
  })
  const [removing, startRemoving] = useTransition()

  const remove = () =>
    startRemoving(async () => {
      if (!category) return
      const result = await removeCategory({ id: category.id })
      if (!result.ok) {
        toast.error(tc('error'))
        return
      }
      toast.success(
        result.hidden
          ? t('categoryHidden', { count: result.transactions + result.recurring + result.budgets })
          : t('categoryDeleted'),
      )
      setOpen(false)
    })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="ghost" size="sm" className="px-1.5" aria-label={t('editCategory')}>
            <Pencil className="size-3.5" />
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            <Plus className="size-4" />
            {t('addCategoryShort')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={editing ? t('editCategory') : t('addCategory')}>
        <form
          action={(formData) =>
            run(() => {
              const payload = {
                name: String(formData.get('name') ?? ''),
                kind: formData.get('kind'),
                note: String(formData.get('note') ?? ''),
              }
              return editing && category
                ? saveCategory({ id: category.id, ...payload })
                : createCategory(payload)
            })
          }
          className="space-y-3"
        >
          <Field label={t('accountName')}>
            <Input
              name="name"
              required
              autoFocus={!editing}
              maxLength={120}
              defaultValue={category?.name ?? ''}
            />
          </Field>
          <Field label={t('kind')}>
            <Select name="kind" defaultValue={category?.kind ?? 'expense'}>
              <option value="expense">{t('kinds.expense')}</option>
              <option value="income">{t('kinds.income')}</option>
            </Select>
          </Field>
          <Field label={t('categoryNote')}>
            <Textarea
              name="note"
              rows={3}
              maxLength={500}
              defaultValue={category?.note ?? ''}
              placeholder={t('categoryNotePlaceholder')}
            />
            <p className="text-text-subtle text-xs">{t('categoryNoteHint')}</p>
          </Field>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {editing ? (
              <Button
                type="button"
                variant="danger"
                className="mr-auto"
                disabled={pending || removing}
                onClick={remove}
              >
                <Trash2 className="size-4" />
                {t('removeCategory')}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={pending || removing}>
              {tc('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function BudgetEditDialog({
  budget,
}: {
  budget: { categoryId: string; periodStart: string; categoryName: string; amount: string }
}) {
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
        <button type="button" className="group flex min-w-0 items-center gap-1.5 text-left">
          <span className="group-hover:text-accent truncate text-sm">{budget.categoryName}</span>
          <Pencil className="text-text-subtle group-hover:text-accent size-3 shrink-0" />
        </button>
      </DialogTrigger>
      <DialogContent title={t('editBudget')} description={budget.categoryName}>
        <form
          action={(formData) =>
            run(() =>
              saveBudget({
                categoryId: budget.categoryId,
                periodStart: budget.periodStart,
                amount: Number(formData.get('amount') ?? 0),
              }),
            )
          }
          className="space-y-3"
        >
          <Field label={t('amount')}>
            <MoneyInput
              name="amount"
              defaultValue={Number(budget.amount)}
              required
              autoFocus
              className="text-right tabular-nums"
            />
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
          <div className="grid gap-3 sm:grid-cols-2">
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
              <Input
                type="number"
                name="quantity"
                step="any"
                min={0}
                required
                className="text-right tabular-nums"
              />
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

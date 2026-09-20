'use client'

import { Loader2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import { Select } from '@/components/ui/select'
import type { FinanceCategory } from '@/lib/db/schema'
import { formatMoney } from '@/lib/format/money'
import type { DraftKind, TransactionDraft } from '@/lib/finance/drafts'
import { PATHS } from '@/lib/paths'
import { createTransactions } from '@/server/actions/finance'

/**
 * The review step shared by the finance page's capture box and the global one:
 * one editable row per detected payment, a running total, and a save that only
 * runs when the user presses it.
 */
export function FinanceDraftList({
  drafts,
  accounts,
  categories,
  currency,
  onSaved,
  onDiscard,
}: {
  drafts: TransactionDraft[]
  accounts: { id: string; name: string }[]
  categories: FinanceCategory[]
  currency: string
  onSaved: () => void
  onDiscard: () => void
}) {
  const t = useTranslations('finance.capture')
  const tf = useTranslations('finance')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [rows, setRows] = useState(drafts)
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [saving, startSaving] = useTransition()

  const formRef = useRef<HTMLFormElement>(null)
  const [totals, setTotals] = useState({ expense: 0, income: 0 })

  // Read the live DOM rather than mirroring every keystroke in state: the money
  // fields format themselves as you type, and re-controlling them would fight
  // that. Runs on edit and, through the effect, on row removal.
  const recount = useCallback(() => {
    const form = formRef.current
    if (!form) return
    const data = new FormData(form)
    let expense = 0
    let income = 0
    for (const row of rows) {
      const amount = Number(data.get(`amount:${row.id}`) ?? 0)
      if (!Number.isFinite(amount)) continue
      if (data.get(`kind:${row.id}`) === 'income') income += amount
      else expense += amount
    }
    setTotals({ expense, income })
  }, [rows])

  useEffect(recount, [recount])

  if (accounts.length === 0) {
    return (
      <div className="glass space-y-2 rounded-[var(--radius)] p-3">
        <p className="text-sm">{tf('noAccountsBody')}</p>
        <Button asChild size="sm" variant="outline">
          <Link href={PATHS.finance}>{tf('addAccount')}</Link>
        </Button>
      </div>
    )
  }

  const save = () =>
    startSaving(async () => {
      const form = formRef.current
      if (!form) return
      const data = new FormData(form)

      const payload = rows.map((row) => ({
        // A cleared date field submits as "", which would fail validation for
        // no reason the user can see. Fall back to what was parsed.
        occurredOn: emptyToNull(data.get(`occurredOn:${row.id}`)) ?? row.occurredOn,
        amount: Number(data.get(`amount:${row.id}`) ?? 0),
        kind: String(data.get(`kind:${row.id}`) ?? 'expense') as DraftKind,
        categoryId: emptyToNull(data.get(`categoryId:${row.id}`)),
        merchant: emptyToNull(data.get(`merchant:${row.id}`)),
        note: row.note,
      }))

      if (payload.some((row) => !(row.amount > 0))) {
        toast.error(t('needAmount'))
        return
      }

      const result = await createTransactions({ accountId, rows: payload })
      if (!result.ok) {
        toast.error(tc('error'))
        return
      }

      toast.success(t('savedToast', { count: result.saved }))
      onSaved()
    })

  const money = (amount: number) => formatMoney(amount, currency, locale)

  return (
    <form ref={formRef} onInput={recount} className="space-y-3">
      <p className="text-text-muted text-xs leading-snug">{t('reviewHint')}</p>

      <label className="block space-y-1.5">
        <span className="text-text-muted text-xs font-medium">{t('intoAccount')}</span>
        <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
      </label>

      <ul className="space-y-2">
        {rows.map((row) => (
          <DraftRow
            key={row.id}
            draft={row}
            categories={categories}
            onRemove={() => {
              const next = rows.filter((candidate) => candidate.id !== row.id)
              if (next.length === 0) onDiscard()
              else setRows(next)
            }}
          />
        ))}
      </ul>

      {/*
       * Pinned to the bottom of whatever is scrolling: in the capture panel the
       * rows can run past the fold, and a save button you have to go looking
       * for is the reason a review step gets skipped.
       */}
      <div className="glass sticky bottom-0 -mx-4 -mb-4 flex flex-wrap items-center justify-between gap-2 px-4 pt-2 pb-4">
        <p className="text-text-muted text-xs tabular-nums">
          {t('summary', { count: rows.length })}
          {totals.expense > 0 ? ` · ${t('outgoing')} ${money(totals.expense)}` : ''}
          {totals.income > 0 ? ` · ${t('incoming')} ${money(totals.income)}` : ''}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onDiscard} disabled={saving}>
            {t('discard')}
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t('saveAll', { count: rows.length })}
          </Button>
        </div>
      </div>
    </form>
  )
}

function DraftRow({
  draft,
  categories,
  onRemove,
}: {
  draft: TransactionDraft
  categories: FinanceCategory[]
  onRemove: () => void
}) {
  const t = useTranslations('finance')
  const tc = useTranslations('finance.capture')
  const [kind, setKind] = useState<DraftKind>(draft.kind)
  // A category belongs to one kind, so flipping the kind invalidates the pick.
  const [categoryId, setCategoryId] = useState(draft.categoryId ?? '')

  const relevant = categories.filter((category) => category.kind === kind)

  return (
    <li className="glass space-y-2 rounded-[var(--radius)] p-2">
      <div className="flex items-center gap-2">
        <Input
          name={`merchant:${draft.id}`}
          defaultValue={draft.merchant ?? ''}
          aria-label={t('merchant')}
          placeholder={t('merchant')}
          maxLength={200}
          className="h-9 min-w-0 flex-1 text-base sm:text-sm"
        />
        <MoneyInput
          name={`amount:${draft.id}`}
          defaultValue={draft.amount}
          aria-label={t('amount')}
          className="h-9 w-32 text-right text-base tabular-nums sm:text-sm"
        />
        <Button
          type="button"
          variant="ghost"
          size="iconSm"
          onClick={onRemove}
          aria-label={tc('removeRow')}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select
          name={`kind:${draft.id}`}
          value={kind}
          aria-label={t('kind')}
          onChange={(event) => {
            setKind(event.target.value as DraftKind)
            setCategoryId('')
          }}
          className="h-9 w-28 text-base sm:text-sm"
        >
          <option value="expense">{t('kinds.expense')}</option>
          <option value="income">{t('kinds.income')}</option>
        </Select>

        <Select
          name={`categoryId:${draft.id}`}
          value={categoryId}
          aria-label={t('category')}
          onChange={(event) => setCategoryId(event.target.value)}
          className="h-9 min-w-32 flex-1 text-base sm:text-sm"
        >
          <option value="">{t('noCategory')}</option>
          {relevant.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>

        <Input
          type="date"
          name={`occurredOn:${draft.id}`}
          defaultValue={draft.occurredOn}
          aria-label={t('date')}
          className="h-9 w-full text-base sm:w-36 sm:text-sm"
        />
      </div>
    </li>
  )
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? '').trim()
  return text === '' ? null : text
}

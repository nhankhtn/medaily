'use client'

import { Plus, Send } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/ui/money-input'
import { Select } from '@/components/ui/select'
import type { FinanceCategory } from '@/lib/db/schema'
import type { ISODate } from '@/lib/dates'
import { randomUuid } from '@/lib/uuid'
import { canReceive, type Payee } from '@/lib/finance/payee'
import { transferNote } from '@/lib/finance/vietqr'
import { createTransaction, markTransactionTransferred } from '@/server/actions/finance'
import { TransferDialog } from './transfer-dialog'
import { queuePendingTransaction } from './pending-transactions'
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
  currency,
  today,
  onPending,
}: {
  accounts: { id: string; name: string }[]
  categories: FinanceCategory[]
  people: Payee[]
  currency: string
  today: ISODate
  /** Shows the row straight away; see `TransactionPanel`. */
  onPending: (row: PendingTransaction) => void
}) {
  const t = useTranslations('finance')
  useLocale()
  const [kind, setKind] = useState<'income' | 'expense' | 'transfer'>('expense')
  const formRef = useRef<HTMLFormElement>(null)
  const payeeRef = useRef<HTMLInputElement>(null)

  const [transferOpen, setTransferOpen] = useState(false)
  /**
   * The transfer sheet opens on a row that is still being written. Everything
   * it needs is captured here, because the fields it came from are cleared on
   * the same frame the save starts.
   */
  const [transfer, setTransfer] = useState<{
    id: string
    payee: Payee | null
    amount: number
    reference: string
  } | null>(null)
  /** Resolves when the row exists on the server, so marking it cannot arrive first. */
  const savingRef = useRef<Promise<boolean>>(Promise.resolve(false))
  /**
   * The id the sheet has already put in the transfer reference. The save that
   * follows has to adopt it, or the note would name a row that never existed.
   */
  const pendingIdRef = useRef<string | null>(null)

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
    /*
     * Decided here, not by the database, and shared with the optimistic row.
     * If this save has to be queued, the id is what makes sending it again
     * land on the same row instead of charging the coffee twice.
     */
    const id = pendingIdRef.current ?? randomUuid()
    pendingIdRef.current = null

    const input = {
      id,
      occurredOn: String(formData.get('occurredOn') ?? today),
      amount: Number(formData.get('amount') ?? 0),
      kind,
      accountId: String(formData.get('accountId') ?? ''),
      counterAccountId: emptyToNull(formData.get('counterAccountId')),
      categoryId: emptyToNull(formData.get('categoryId')),
      personId: emptyToNull(formData.get('personId')),
      payeePersonId: emptyToNull(formData.get('payeePersonId')),
      merchant: String(formData.get('merchant') ?? ''),
    }

    onPending({
      key: id,
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

    if (input.payeePersonId) {
      const payee = people.find((person) => person.id === input.payeePersonId) ?? null
      setTransfer((current) => (current ? { ...current, payee } : current))
    }

    /*
     * Held so the transfer sheet can wait for it. Marking a row transferred
     * before its insert lands would update nothing and silently leave the row
     * still asking to be paid.
     */
    const saving = (async (): Promise<boolean> => {
      try {
        const result = await createTransaction(input)
        if (!result.ok) {
          toast.error(t('notSaved'))
          return false
        }
        toast.success(t('saved'))
        return true
      } catch (error) {
        // The action throws when it cannot reach the server. That one is worth
        // keeping: the transaction is held on the device and goes up on its own.
        console.error('[finance] could not save the transaction:', error)

        try {
          await queuePendingTransaction({
            id,
            occurredOn: input.occurredOn,
            amount: input.amount,
            kind: input.kind,
            accountId: input.accountId,
            counterAccountId: input.counterAccountId,
            categoryId: input.categoryId,
            personId: input.personId,
            payeePersonId: input.payeePersonId,
            merchant: input.merchant.trim() === '' ? null : input.merchant.trim(),
          })
          toast.success(t('offline.queued'))
        } catch (kept) {
          // The device would not hold it either. Say so — a transaction
          // reported as saved and stored nowhere is the worst of both.
          console.error('[offline] could not keep the transaction on this device:', kept)
          toast.error(t('offline.notKept'))
        }
        return false
      }
    })()

    savingRef.current = saving
    await saving
  }

  /** `2026-09-22` as `22/09`, which is what fits a bank reference line. */
  const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

  const reachable = people.some(canReceive)

  /**
   * Opens the sheet before anything is saved, because the payee has to be
   * picked first — it is part of the row, not something bolted on after.
   * Picking is what submits the form.
   */
  const startTransfer = () => {
    const form = formRef.current
    if (!form) return
    const data = new FormData(form)
    const amount = Number(data.get('amount') ?? 0)
    if (!(amount > 0)) {
      toast.error(t('transfer.needAmount'))
      return
    }
    /*
     * The amount is read now rather than after the save, because the fields
     * are cleared the moment the save starts — the sheet would open showing
     * zero and correct itself a frame later.
     *
     * The id is decided here too, so the reference shown is the one the row
     * will carry. The save picks it up from `pendingIdRef`.
     */
    const id = randomUuid()
    pendingIdRef.current = id
    setTransfer({
      id,
      payee: null,
      amount,
      reference: transferNote(
        [String(data.get('merchant') ?? ''), dayMonth(String(data.get('occurredOn') ?? today))],
        id,
      ),
    })
    setTransferOpen(true)
  }

  const confirmTransfer = async () => {
    const pending = transfer
    if (!pending?.id) return
    // A row that never reached the server has nothing to mark. It carries the
    // payee in the queue and will ask again from the ledger once it is up.
    if (!(await savingRef.current)) return
    await markTransactionTransferred({ id: pending.id })
  }

  const relevantCategories = categories.filter((category) =>
    kind === 'income' ? category.kind === 'income' : category.kind === 'expense',
  )

  return (
    <form id="transaction-form" ref={formRef} action={submit} className="space-y-2">
      <div className="grid grid-cols-2 items-end gap-2 lg:flex lg:flex-nowrap">
        <label className="space-y-1.5 lg:w-24 lg:shrink-0">
          <span className="text-text-muted text-xs font-medium">{t('kind')}</span>
          <Select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
            {(['expense', 'income', 'transfer'] as const).map((option) => (
              <option key={option} value={option}>
                {t(`kinds.${option}`)}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-1.5 lg:w-28 lg:shrink-0">
          <span className="text-text-muted text-xs font-medium">{t('amount')}</span>
          <MoneyInput name="amount" required className="text-right tabular-nums" />
        </label>

        <label className="space-y-1.5 lg:w-28 lg:shrink-0">
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
          <label className="min-w-0 space-y-1.5 lg:w-32 lg:flex-1">
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
          <label className="min-w-0 space-y-1.5 lg:w-32 lg:flex-1">
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
          <label className="space-y-1.5 lg:w-28 lg:shrink-0">
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

        <label className="min-w-0 space-y-1.5 lg:min-w-24 lg:flex-1">
          <span className="text-text-muted text-xs font-medium">{t('merchant')}</span>
          <Input name="merchant" maxLength={200} />
        </label>

        <label className="space-y-1.5 lg:w-32 lg:shrink-0">
          <span className="text-text-muted text-xs font-medium">{t('date')}</span>
          <Input type="date" name="occurredOn" defaultValue={today} />
        </label>

        {/* Set by the sheet's picker, then read back out of `FormData` like
            every other field here. Written to the DOM rather than to state so
            the submit that follows on the same tick sees it. */}
        <input type="hidden" name="payeePersonId" ref={payeeRef} defaultValue="" />

        <div className="col-span-2 flex w-full gap-2 lg:col-auto lg:w-auto lg:shrink-0">
          <Button type="submit" className="flex-1 lg:flex-none">
            <Plus className="size-4" />
            {t('addTransaction')}
          </Button>
          {/* A transfer is between your own accounts; there is nobody to send to. */}
          {kind === 'transfer' || !reachable ? null : (
            <Button type="button" variant="outline" onClick={startTransfer}>
              <Send className="size-4" />
              {t('transfer.title')}
            </Button>
          )}
        </div>
      </div>

      {kind === 'transfer' ? <p className="text-text-subtle text-xs">{t('transferHint')}</p> : null}

      <TransferDialog
        open={transferOpen}
        onOpenChange={(next) => {
          setTransferOpen(next)
          if (!next) {
            setTransfer(null)
            pendingIdRef.current = null
            if (payeeRef.current) payeeRef.current.value = ''
          }
        }}
        payees={people}
        payee={transfer?.payee ?? null}
        onPick={(payee) => {
          if (payeeRef.current) payeeRef.current.value = payee.id
          formRef.current?.requestSubmit()
        }}
        amount={transfer?.amount ?? 0}
        reference={transfer?.reference ?? ''}
        currency={currency}
        onTransferred={confirmTransfer}
      />
    </form>
  )
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? '').trim()
  return text === '' ? null : text
}

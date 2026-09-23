'use client'

import { Check, Copy, ExternalLink } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { QrCode } from '@/components/ui/qr-code'
import { copyText } from '@/lib/clipboard'
import { bankName } from '@/lib/finance/banks'
import { formatMoney } from '@/lib/format/money'
import { bankTarget, canReceive, isMomoLink, momoLink, type Payee } from '@/lib/finance/payee'
import { vietQrPayload } from '@/lib/finance/vietqr'

/**
 * Hands over the details of a transfer that happens somewhere else — a bank
 * app, MoMo — and then takes the one thing this app cannot observe: whether it
 * happened.
 *
 * A QR carries the account, the amount and the reference in one scan, so on a
 * desktop nothing has to be typed. A phone cannot scan its own screen, so
 * there the same three travel by clipboard instead.
 */
export function TransferDialog({
  open,
  onOpenChange,
  payees,
  payee,
  onPick,
  amount,
  reference,
  currency,
  onTransferred,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Offered when no payee is settled yet; anyone unreachable is left out. */
  payees: Payee[]
  payee: Payee | null
  onPick?: (payee: Payee) => void
  amount: number
  reference: string
  currency: string
  onTransferred: () => Promise<void> | void
}) {
  const t = useTranslations('finance')
  const locale = useLocale()
  /**
   * Only the choice made in here. The settled payee arrives as a prop, so the
   * two are read as one below rather than copied into state — a copy would
   * need an effect to stay honest, and would go stale between the pick and
   * the row that comes back carrying it.
   */
  const [picked, setPicked] = useState<Payee | null>(null)
  const [busy, setBusy] = useState(false)

  const chosen = payee ?? picked
  const reachable = payees.filter(canReceive)

  const close = (next: boolean) => {
    if (!next) setPicked(null)
    onOpenChange(next)
  }

  const pick = (next: Payee) => {
    setPicked(next)
    onPick?.(next)
  }

  const copy = async (value: string, done: string) => {
    if (await copyText(value)) toast.success(done)
    else toast.error(t('transfer.copyFailed'))
  }

  const openMomo = (momo: string) => {
    /*
     * The copy is started but not awaited: the navigation has to stay inside
     * the tap that asked for it, and iOS blocks one that resumes after an
     * await. A pasted receive link needs no clipboard — it carries the payee
     * itself; a bare number does, because the app opens on its home screen.
     */
    if (!isMomoLink(momo)) void copy(momo, t('transfer.copiedMomo'))
    window.location.href = momoLink(momo)
  }

  const confirm = async () => {
    setBusy(true)
    try {
      await onTransferred()
      close(false)
    } finally {
      setBusy(false)
    }
  }

  const target = chosen ? bankTarget(chosen) : null
  /** Built here, so it carries this transaction's amount and reference. */
  const built = target ? vietQrPayload({ ...target, amount, message: reference }) : null
  /*
   * Otherwise the code the payee sent. That one is fixed — whatever it was made
   * with — so the sum has to be typed into whichever app scans it.
   */
  const payload = built ?? chosen?.paymentQr ?? null

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent title={t('transfer.title')}>
        {chosen === null ? (
          reachable.length === 0 ? (
            <p className="text-text-muted text-sm">{t('transfer.nobody')}</p>
          ) : (
            <div className="space-y-3">
              <p className="text-text-muted text-sm">{t('transfer.pick')}</p>
              <div className="flex flex-wrap gap-2">
                {reachable.map((option) => (
                  <Button key={option.id} variant="outline" size="sm" onClick={() => pick(option)}>
                    {option.name}
                  </Button>
                ))}
              </div>
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-lg font-medium tabular-nums">
                {formatMoney(amount, currency, locale)}
              </p>
              <p className="text-sm">{chosen.name}</p>
              {target ? (
                <p className="text-text-muted text-sm tabular-nums">
                  {[bankName(chosen.bankBin), target.accountNumber].filter(Boolean).join(' · ')}
                </p>
              ) : null}
              {/* Read before leaving: a wrong row is caught here or not at all. */}
              {chosen.bankAccountName ? (
                <p className="text-text-muted text-sm uppercase">{chosen.bankAccountName}</p>
              ) : null}
              {reference ? (
                <p className="text-text-subtle text-xs">
                  {t('transfer.reference')}: {reference}
                </p>
              ) : null}
            </div>

            {payload ? (
              <div className="flex justify-center">
                <QrCode value={payload} className="size-52 max-w-full rounded-[var(--radius)]" />
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {target ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(target.accountNumber, t('transfer.copiedAccount'))}
                >
                  <Copy className="size-4" />
                  {t('transfer.copyAccount')}
                </Button>
              ) : null}
              {chosen.momoPhone ? (
                <Button variant="outline" size="sm" onClick={() => openMomo(chosen.momoPhone!)}>
                  <ExternalLink className="size-4" />
                  {t('transfer.openMomo')}
                </Button>
              ) : null}
            </div>

            {payload && !built ? (
              <p className="text-text-subtle text-xs">{t('transfer.staticQr')}</p>
            ) : null}

            {chosen.momoPhone && !isMomoLink(chosen.momoPhone) ? (
              <p className="text-text-subtle text-xs">{t('transfer.momoOnly')}</p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => close(false)}>
                {t('transfer.later')}
              </Button>
              <Button onClick={confirm} disabled={busy}>
                <Check className="size-4" />
                {t('transfer.done')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

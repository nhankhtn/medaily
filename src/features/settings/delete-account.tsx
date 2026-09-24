'use client'

import { Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { deleteMyAccount } from '@/server/actions/auth'
import { PATHS } from '@/lib/paths'

/**
 * The end of the account, and the only thing on this page that cannot be
 * undone — so it is the only one that asks the person to type something.
 *
 * A button alone is not enough here: the rest of the page is full of them and
 * a thumb finds this one the same way it finds the others. Typing the account
 * name is a deliberate act, and it is also the moment to point at the export
 * one card up, because afterwards there is nothing left to export.
 */
export function DeleteAccount({ subject }: { subject: string }) {
  const t = useTranslations('account')
  const tc = useTranslations('common')
  const [confirmation, setConfirmation] = useState('')
  const [pending, startTransition] = useTransition()

  const matches = confirmation.trim().toLowerCase() === subject.trim().toLowerCase()

  const remove = () =>
    startTransition(async () => {
      const result = await deleteMyAccount({ confirmation })
      if (!result.ok) {
        toast.error(result.error === 'confirmation_mismatch' ? t('nameMismatch') : tc('error'))
        return
      }
      // A hard navigation, not a router push: every cached server payload in
      // this tab belongs to an account that no longer exists.
      window.location.href = PATHS.login
    })

  return (
    <Card className="border-bad/40 space-y-3 p-4">
      <div>
        <h2 className="text-bad text-sm font-semibold">{t('deleteTitle')}</h2>
        <p className="text-text-subtle mt-0.5 text-xs leading-snug">{t('deleteBody')}</p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-text-muted text-xs font-medium">
          {t('typeToConfirm', { name: subject })}
        </span>
        <Input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          maxLength={400}
          aria-label={t('typeToConfirm', { name: subject })}
          className="sm:max-w-xs"
        />
      </label>

      <Button variant="danger" disabled={!matches || pending} onClick={remove}>
        <Trash2 className="size-4" />
        {t('deleteAction')}
      </Button>
    </Card>
  )
}

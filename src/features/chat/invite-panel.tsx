'use client'

import { Link2, Mail } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PATHS } from '@/lib/paths'
import { createInvite } from '@/server/actions/chat'

/**
 * Making a way in.
 *
 * The email field never reports whether that address has an account — the
 * server does not look. Both answers are the same sentence, which is also why
 * the copy says "if somebody is using that address" rather than "invited".
 */
export function InvitePanel({ roomId }: { roomId: string }) {
  const t = useTranslations('chat')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const make = async (withEmail?: string) => {
    setBusy(true)
    const result = await createInvite({ roomId, ...(withEmail ? { email: withEmail } : {}) })
    setBusy(false)

    if (!result.ok) {
      toast.error(t(result.error === 'rate_limited' ? 'tooFast' : 'sendFailed'))
      return
    }

    if (withEmail) {
      setEmail('')
      toast.success(t('emailQueued'), { description: t('noEmailSent') })
      return
    }

    const link = `${window.location.origin}${PATHS.chatJoin(result.code)}`
    await navigator.clipboard.writeText(link).catch(() => {})
    toast.success(t('linkCopied'), { description: link })
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" disabled={busy} onClick={() => void make()}>
        <Link2 className="size-4" />
        {t('inviteLink')}
      </Button>

      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (email.trim() === '') return
          void make(email.trim())
        }}
      >
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t('inviteByEmail')}
          aria-label={t('inviteByEmail')}
          maxLength={200}
        />
        <Button type="submit" variant="outline" size="sm" disabled={busy || email.trim() === ''}>
          <Mail className="size-4" />
          {t('invite')}
        </Button>
      </form>
    </div>
  )
}

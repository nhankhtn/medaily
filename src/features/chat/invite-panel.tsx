'use client'

import { Link2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PATHS } from '@/lib/paths'
import { createInvite } from '@/server/actions/chat'

/**
 * Making a way in.
 *
 * One link, good once, for two days. There was an address field beside it that
 * read as sending an invitation and sent nothing — no mail leaves this app —
 * so whoever used it still had to pass the link along by hand, having been
 * told it was already handled.
 */
export function InvitePanel({ roomId }: { roomId: string }) {
  const t = useTranslations('chat')
  const [busy, setBusy] = useState(false)

  /**
   * Puts the link on the clipboard, and says so only if it got there.
   *
   * Safari allows a clipboard write while the tap that asked for it is still
   * "active", and the invite has to be made on the server first — by the time
   * that round trip answers, the tap has expired and the write is refused. So
   * the write is started inside the tap and handed a promise of the text,
   * which is the one shape WebKit accepts; `writeText` is for the browsers
   * that have no `ClipboardItem` and do not mind the wait.
   */
  const copyLink = async (link: Promise<string>): Promise<boolean> => {
    try {
      if (typeof ClipboardItem === 'function') {
        const text = link.then((value) => new Blob([value], { type: 'text/plain' }))
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': text })])
      } else {
        await navigator.clipboard.writeText(await link)
      }
      return true
    } catch (error) {
      console.error('[chat] could not reach the clipboard:', error)
      return false
    }
  }

  const make = async () => {
    setBusy(true)
    const made = createInvite({ roomId })

    // Started here, before anything is awaited, so the tap is still the reason
    // the clipboard is being written to.
    const copied = copyLink(
      made.then((result) =>
        result.ok ? `${window.location.origin}${PATHS.chatJoin(result.code)}` : '',
      ),
    )

    const result = await made
    setBusy(false)

    if (!result.ok) {
      toast.error(t(result.error === 'rate_limited' ? 'tooFast' : 'sendFailed'))
      return
    }

    // The link is in the description either way: when the clipboard refused,
    // it is the only copy there is, and claiming a copy that is not there
    // sends somebody to paste nothing.
    const link = `${window.location.origin}${PATHS.chatJoin(result.code)}`
    if (await copied) toast.success(t('linkCopied'), { description: link })
    else toast.warning(t('copyBlocked'), { description: link, duration: 20000 })
  }

  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={() => void make()}>
      <Link2 className="size-4" />
      {t('inviteLink')}
    </Button>
  )
}

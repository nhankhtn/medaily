'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { PATHS } from '@/lib/paths'
import { acceptInvite, peekInvite } from '@/server/actions/chat'

type Peek =
  | { state: 'loading' }
  | { state: 'gone'; reason: string }
  | { state: 'ready'; title: string | null; alreadyIn: boolean }

/**
 * The invitation, asked over the room list rather than on a page of its own.
 *
 * It opens from `?join=` and closes by clearing it, so the address stays the
 * thing that decides what is on screen — a refresh reopens it, and answering
 * leaves nothing behind in the history to walk back into.
 */
export function InviteDialog({ code }: { code: string }) {
  const t = useTranslations('chat')
  const router = useRouter()
  const [peek, setPeek] = useState<Peek>({ state: 'loading' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let dropped = false
    void peekInvite(code).then((result) => {
      if (dropped) return
      setPeek(
        result.ok
          ? { state: 'ready', title: result.title, alreadyIn: result.alreadyIn }
          : { state: 'gone', reason: t(result.error === 'rate_limited' ? 'tooFast' : 'joinGone') },
      )
    })
    return () => {
      dropped = true
    }
  }, [code, t])

  const close = () => router.replace(PATHS.chat)

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent title={t('joinTitle')}>
        {peek.state === 'loading' ? (
          <p className="text-text-subtle text-sm">{t('joinChecking')}</p>
        ) : peek.state === 'gone' ? (
          <div className="space-y-4">
            <p className="text-text-muted text-sm">{peek.reason}</p>
            <div className="flex justify-end">
              <Button variant="ghost" onClick={close}>
                {t('joinDecline')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">
              {t.rich(peek.alreadyIn ? 'joinAlready' : 'joinInvited', {
                room: peek.title ?? t('untitled'),
                b: (chunks) => <span className="font-medium">{chunks}</span>,
              })}
            </p>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close} disabled={busy}>
                {t('joinDecline')}
              </Button>
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  const result = await acceptInvite(code)
                  if (result.ok) {
                    router.replace(PATHS.chatRoom(result.roomId))
                    return
                  }
                  setBusy(false)
                  // Expired, revoked, spent and never-existed all read the
                  // same, so somebody trying codes learns nothing from the
                  // difference.
                  setPeek({
                    state: 'gone',
                    reason: t(result.error === 'rate_limited' ? 'tooFast' : 'joinGone'),
                  })
                }}
              >
                {peek.alreadyIn ? t('joinOpen') : t('joinAccept')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

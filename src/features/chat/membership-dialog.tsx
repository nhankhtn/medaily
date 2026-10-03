'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { PATHS } from '@/lib/paths'
import { acceptMembership, declineMembership, peekMembership } from '@/server/actions/room-invite'

type Peek =
  | { state: 'loading' }
  | { state: 'gone' }
  | { state: 'ready'; roomTitle: string; inviterName: string; roomId: string }

/**
 * An invite addressed to this account.
 *
 * Closing the dialog leaves it open: "later" is not a refusal. Decline is the
 * button that answers no, so the bell stops offering the same seat.
 */
export function MembershipDialog({ inviteId }: { inviteId: string }) {
  const t = useTranslations('chat')
  const router = useRouter()
  const [peek, setPeek] = useState<Peek>({ state: 'loading' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let dropped = false
    void peekMembership(inviteId).then((result) => {
      if (dropped) return
      setPeek(
        result.ok
          ? {
              state: 'ready',
              roomTitle: result.invite.roomTitle,
              inviterName: result.invite.inviterName,
              roomId: result.invite.roomId,
            }
          : { state: 'gone' },
      )
    })
    return () => {
      dropped = true
    }
  }, [inviteId])

  const close = () => router.replace(PATHS.chat)

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent title={t('membershipTitle')}>
        {peek.state === 'loading' ? (
          <p className="text-text-subtle text-sm">{t('joinChecking')}</p>
        ) : peek.state === 'gone' ? (
          <div className="space-y-4">
            <p className="text-text-muted text-sm">{t('membershipGone')}</p>
            <div className="flex justify-end">
              <Button variant="ghost" onClick={close}>
                {t('joinDecline')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">
              {t.rich(peek.roomTitle ? 'membershipBody' : 'membershipUntitled', {
                name: peek.inviterName,
                room: peek.roomTitle,
                b: (chunks) => <span className="font-medium">{chunks}</span>,
              })}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  await declineMembership(inviteId)
                  close()
                }}
              >
                {t('membershipDecline')}
              </Button>
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  const result = await acceptMembership(inviteId)
                  if (result.ok) {
                    router.replace(PATHS.chatRoom(result.roomId))
                    return
                  }
                  setBusy(false)
                  setPeek({ state: 'gone' })
                }}
              >
                {t('membershipAccept')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

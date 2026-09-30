'use client'

import { Settings } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { InvitePanel } from './invite-panel'
import { LeaveRoom } from './leave-room'

/**
 * What can be done to the room, rather than said in it — behind a gear beside
 * the title.
 *
 * Both of these used to sit in a card under the conversation, in the path of a
 * finger scrolling the transcript. Neither is done often and neither is
 * reversible in the same breath: an invite link, once copied, is out of your
 * hands, and a room is left once and never unleft. One deliberate tap away is
 * the right distance for both.
 *
 * `drawer` because that is where this app reads and edits one record: a
 * centred box would read as a question being asked, and nothing here is being
 * asked.
 */
export function RoomSettings({ roomId, owner }: { roomId: string; owner: boolean }) {
  const t = useTranslations('chat')

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="iconSm"
          title={t('roomSettings')}
          aria-label={t('roomSettings')}
        >
          <Settings className="size-4" />
        </Button>
      </DialogTrigger>

      <DialogContent layout="drawer" title={t('roomSettings')}>
        <div className="space-y-5">
          {/* Only the owner can make a way in, so for everybody else this
              panel is the one control below and no empty heading above it. */}
          {owner ? (
            <section className="space-y-2">
              <h3 className="text-text-subtle text-xs font-medium">{t('invite')}</h3>
              <InvitePanel roomId={roomId} />
            </section>
          ) : null}

          <section className="border-border-base flex flex-col items-start border-t pt-4">
            <LeaveRoom roomId={roomId} />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

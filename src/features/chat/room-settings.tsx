'use client'

import { Settings } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { LeaveRoom } from './leave-room'

/**
 * What can be done to the room, rather than said in it — behind a gear beside
 * the title.
 *
 * Leaving used to sit in the card under the conversation, a plain button a
 * finger scrolling the transcript could reach. A room is left once and never
 * unleft, so it belongs one deliberate tap further away than the things done
 * every day.
 *
 * `drawer` because that is where this app reads and edits one record: a
 * centred box would read as a question being asked, and nothing here is being
 * asked.
 */
export function RoomSettings({ roomId }: { roomId: string }) {
  const t = useTranslations('chat')

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="iconSm" title={t('roomSettings')} aria-label={t('roomSettings')}>
          <Settings className="size-4" />
        </Button>
      </DialogTrigger>

      <DialogContent layout="drawer" title={t('roomSettings')}>
        <div className="flex flex-col items-start gap-2">
          <LeaveRoom roomId={roomId} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

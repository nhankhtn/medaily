import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { notFound } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { RoomSettings } from '@/features/chat/room-settings'
import { RoomView } from '@/features/chat/room-view'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { chatEnabled } from '@/lib/chat/provider'
import { PATHS } from '@/lib/paths'
import { loadRoom } from '@/server/actions/chat'

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  if (!chatEnabled()) notFound()

  const { id } = await params
  const [t, userId, loaded] = await Promise.all([
    getTranslations('chat'),
    getCurrentUserId(),
    loadRoom(id),
  ])
  // Somebody who is not in the room is told the room is not there, rather than
  // that it exists and is none of their business.
  if (!loaded.ok) notFound()

  const owner = loaded.room.createdBy === userId
  const members = Object.keys(loaded.speakers).length

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {/*
           * An arrow, and one a thumb can hit. The way back used to be the
           * word "Nhắn tin" in the smallest type on the page, sitting where a
           * breadcrumb goes — which reads as a label for the screen you are
           * on rather than a door out of it. Sized like the other things a
           * finger has to find rather than read.
           */}
          <Button variant="ghost" size="icon" asChild aria-label={t('backToRooms')}>
            <Link href={PATHS.chat}>
              <ArrowLeft className="size-5" />
            </Link>
          </Button>

          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">
              {loaded.room.title ?? t('untitled')}
            </h1>
            <p className="text-text-subtle mt-0.5 text-xs">{t('members', { count: members })}</p>
          </div>
        </div>

        {/* Beside the title, not under the transcript: it is about the room,
            and it is where the eye already is on arriving. */}
        <RoomSettings roomId={loaded.room.id} owner={owner} />
      </div>

      <Card className="p-4">
        <RoomView
          room={loaded.room}
          me={userId}
          initialPage={loaded.page}
          initialSpeakers={loaded.speakers}
        />
      </Card>

      {/* Not behind the gear with the rest: this one says what happens to
          what you type, and a disclosure nobody opens is not a disclosure.
          No card either — a single line of small print never needed one. */}
    </div>
  )
}

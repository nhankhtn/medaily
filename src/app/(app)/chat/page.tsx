import { MessageSquare } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { NewRoom } from '@/features/chat/new-room'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { chatEnabled } from '@/lib/chat/provider'
import { PATHS } from '@/lib/paths'
import { listRooms } from '@/server/services/chat'

export default async function ChatPage() {
  // Chat cannot half work: a room you can open but not write to is worse than
  // no room at all, so without a database the page is simply not there.
  if (!chatEnabled()) notFound()

  const [t, userId] = await Promise.all([getTranslations('chat'), getCurrentUserId()])
  const rooms = await listRooms(userId)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>

      <Card className="p-4">
        <NewRoom />
      </Card>

      {rooms.length === 0 ? (
        <p className="text-text-subtle text-sm">{t('empty')}</p>
      ) : (
        <ul className="space-y-2">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link href={PATHS.chatRoom(room.id)} className="block">
                <Card className="hover:bg-surface-2 flex items-center gap-3 p-4 transition-colors">
                  <MessageSquare className="text-text-subtle size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {room.title ?? t('untitled')}
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Avatar } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { InviteDialog } from '@/features/chat/invite-dialog'
import { NewRoom } from '@/features/chat/new-room'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { canSeal } from '@/lib/chat/message-crypto'
import { chatEnabled } from '@/lib/chat/provider'
import { PATHS } from '@/lib/paths'
import { cn } from '@/lib/utils'
import { listRooms, unreadByRoom } from '@/server/services/chat'

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ join?: string }>
}) {
  // Chat cannot half work: a room you can open but not write to is worse than
  // no room at all, so without a database the page is simply not there.
  if (!chatEnabled()) notFound()

  const [t, userId, params] = await Promise.all([
    getTranslations('chat'),
    getCurrentUserId(),
    searchParams,
  ])
  const [rooms, unread] = await Promise.all([listRooms(userId), unreadByRoom(userId)])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <NewRoom encryptionAvailable={canSeal()} />
      </div>

      {/* An invite arrives as a question over the list, not as a page. */}
      {params.join ? <InviteDialog code={params.join} /> : null}

      {rooms.length === 0 ? (
        <p className="text-text-subtle text-sm">{t('empty')}</p>
      ) : (
        <ul className="space-y-2">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link href={PATHS.chatRoom(room.id)} className="block">
                <Card className="hover:bg-surface-2 flex items-center gap-3 p-4 transition-colors">
                  <Avatar name={room.title ?? t('untitled')} src={room.avatarUrl} />
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-sm',
                      // A room with something waiting reads heavier, so the
                      // list can be scanned without reading the numbers.
                      unread[room.id] ? 'font-semibold' : 'font-medium',
                    )}
                  >
                    {room.title ?? t('untitled')}
                  </span>
                  {unread[room.id] ? (
                    <span
                      className="bg-accent text-accent-text flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-medium tabular-nums"
                      aria-label={t('unread', { count: unread[room.id]! })}
                    >
                      {unread[room.id]! > 99 ? '99+' : unread[room.id]}
                    </span>
                  ) : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

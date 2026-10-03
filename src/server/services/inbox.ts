import { getLocale, getTranslations } from 'next-intl/server'
import { presentNotification } from '@/lib/notifications'
import {
  countUnreadNotifications,
  listNotifications,
} from '@/server/repositories/notifications'

/** What the bell renders. Dates are strings so the client and the action agree. */
export type InboxItem = {
  id: string
  title: string
  body: string
  url: string
  readAt: string | null
  createdAt: string
}

export async function readInbox(userId: string): Promise<{ items: InboxItem[]; unread: number }> {
  const [rows, unread, locale, t] = await Promise.all([
    listNotifications([userId]),
    countUnreadNotifications([userId]),
    getLocale(),
    getTranslations('inbox'),
  ])
  return {
    unread,
    items: rows.map((row) => {
      // Words are chosen here, from the kind, so a later kind does not need a column.
      const shown = presentNotification(row.kind, row.payload, locale, t)
      return {
        id: row.id,
        title: shown.title,
        body: shown.body,
        url: shown.url,
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      }
    }),
  }
}

'use client'

import { Bell } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  loadInbox,
  markEveryNotificationRead,
  markNotificationRead,
} from '@/server/actions/notifications'
import type { InboxItem } from '@/server/services/inbox'

/**
 * The bell in the header, and the list it opens.
 *
 * The count arrives with the page. Opening the panel asks again, because a
 * grant can land while the tab is sitting there and the badge would otherwise
 * stay at whatever the last navigation saw.
 */
export function NotificationBell({
  initial,
}: {
  initial: { items: InboxItem[]; unread: number }
}) {
  const t = useTranslations('inbox')
  const format = useFormatter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState(initial.items)
  const [unread, setUnread] = useState(initial.unread)

  const refresh = () => {
    void loadInbox().then((next) => {
      setItems(next.items)
      setUnread(next.unread)
    })
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) refresh()
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('open')}
          className="text-text-muted hover:bg-surface-2 hover:text-text relative flex size-9 items-center justify-center rounded-full"
        >
          <Bell className="size-4" />
          {unread > 0 ? (
            <span className="bg-accent text-accent-text absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-medium">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <p className="text-sm font-medium">{t('title')}</p>
          {unread > 0 ? (
            <button
              type="button"
              className="text-accent text-xs font-medium"
              onClick={() => {
                const now = new Date().toISOString()
                setItems((rows) => rows.map((row) => ({ ...row, readAt: row.readAt ?? now })))
                setUnread(0)
                void markEveryNotificationRead()
              }}
            >
              {t('markAllRead')}
            </button>
          ) : null}
        </div>
        {items.length === 0 ? (
          <p className="text-text-subtle px-3 pt-2 pb-6 text-center text-sm">{t('empty')}</p>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {items.map((item) => {
              const fresh = item.readAt === null
              return (
                <li key={item.id} className="border-border-base border-t">
                  <Link
                    href={item.url}
                    onClick={() => {
                      setOpen(false)
                      if (!fresh) return
                      setItems((rows) =>
                        rows.map((row) =>
                          row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row,
                        ),
                      )
                      setUnread((count) => Math.max(0, count - 1))
                      void markNotificationRead(item.id)
                    }}
                    className={cn(
                      'hover:bg-surface-2 block px-3 py-2.5',
                      fresh && 'bg-accent-soft/40',
                    )}
                  >
                    <span className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          'mt-1.5 size-2 shrink-0 rounded-full',
                          fresh ? 'bg-accent' : 'bg-transparent',
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-sm', fresh ? 'font-medium' : 'text-text-muted')}>
                          {item.title}
                        </span>
                        {item.body ? (
                          <span className="text-text-muted mt-0.5 block text-xs">{item.body}</span>
                        ) : null}
                        <span className="text-text-subtle mt-1 block text-[11px]">
                          {format.relativeTime(new Date(item.createdAt))}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

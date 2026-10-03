'use client'

import { History } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import type { ActivityChange, ActivityEntry, ActivityFeed } from '@/lib/activity/types'
import { useCursorPage } from '@/lib/hooks/use-cursor-page'
import { loadActivityPage } from '@/server/actions/activity'

/**
 * The trail, behind a button.
 *
 * A dialog rather than a panel on the page: this is something you go and look
 * at when you want to know what happened to a number, not something to read
 * past every time Settings is opened.
 *
 * The first page is rendered on the server and handed in, so opening it shows
 * the rows immediately; only older pages are fetched.
 */
export function ActivityDialog({ initialPage, days }: { initialPage: ActivityFeed; days: number }) {
  const t = useTranslations('activity')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const { items, hasMore, loadingMore, loadMore } = useCursorPage<ActivityEntry>({
    initialPage,
    queryKey: '',
    fetchPage: (cursor) => (cursor ? loadActivityPage({ cursor }) : Promise.resolve({ ok: false })),
    getId: (row) => row.id,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {/* No label beside it, so the name has to be carried by `aria-label`
            or the button reads as nothing at all to a screen reader. */}
        <Button variant="ghost" size="icon" aria-label={t('open')} title={t('open')}>
          <History className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent title={t('title')} description={t('body', { days })} layout="drawer">
        {items.length === 0 ? (
          <p className="text-text-subtle py-6 text-sm">{t('empty')}</p>
        ) : (
          <ul className="divide-border-base divide-y">
            {items.map((row) => (
              <Row key={row.id} entry={row} />
            ))}
          </ul>
        )}

        {hasMore ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => void loadMore()}
            disabled={loadingMore}
          >
            {loadingMore ? tc('loading') : tc('showMore')}
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Row({ entry }: { entry: ActivityEntry }) {
  const t = useTranslations('activity')

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
        <span className="text-text-subtle shrink-0 text-xs tabular-nums">{formatAt(entry.at)}</span>
        {/* `action` is already `<entity>.<verb>`, which is the path next-intl
            nests these under — a dot in a key of its own is refused, and
            refused loudly enough to take the whole app down with it. */}
        <span className="font-medium">{t(`actions.${entry.action}`)}</span>
      </div>
      {entry.label ? <p className="text-text-muted mt-0.5 text-sm break-words">{entry.label}</p> : null}

      {entry.changes.length > 0 ? (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
          {entry.changes.map((change) => (
            <Change key={change.field} change={change} />
          ))}
        </dl>
      ) : null}
    </li>
  )
}

/**
 * One field, and what happened to it. A create shows only the new value and a
 * delete only the old one — the line above already says which it was, so an
 * arrow pointing at nothing would be saying it twice.
 */
function Change({ change }: { change: ActivityChange }) {
  const t = useTranslations('activity')
  const field = translate(t, 'fields', change.field) ?? change.field
  const from = change.from === null ? null : (translate(t, 'values', change.from) ?? change.from)
  const to = change.to === null ? null : (translate(t, 'values', change.to) ?? change.to)

  return (
    <div className="min-w-0">
      <dt className="text-text-subtle text-xs">{field}</dt>
      <dd className="text-xs break-words">
        {from !== null && to !== null ? (
          <>
            <span className="text-text-muted line-through">{from}</span>
            <span className="text-text-subtle mx-1.5">→</span>
            <span className="font-medium">{to}</span>
          </>
        ) : (
          <span className={to === null ? 'text-text-muted' : 'font-medium'}>
            {to ?? from ?? t('nothing')}
          </span>
        )}
      </dd>
    </div>
  )
}

/**
 * A stored token the message files have no entry for is shown as it is.
 *
 * Rows outlive deploys: one written when a habit could be `weekly` survives
 * the release that drops it, and next-intl throws on a key it cannot find. The
 * raw token is a worse label than a translated one and a far better one than a
 * dialog that will not open.
 */
function translate(
  t: ReturnType<typeof useTranslations<'activity'>>,
  group: 'fields' | 'values',
  token: string,
): string | null {
  const key = `${group}.${token}` as Parameters<typeof t.has>[0]
  return t.has(key) ? t(key as Parameters<typeof t>[0]) : null
}

/** `27/09 19:42` — the day and the minute, which is all a trail is read for. */
function formatAt(iso: string): string {
  const at = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(at.getDate())}/${pad(at.getMonth() + 1)} ${pad(at.getHours())}:${pad(at.getMinutes())}`
}

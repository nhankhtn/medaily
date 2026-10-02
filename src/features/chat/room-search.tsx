'use client'

import { Search } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { normalise } from '@/lib/chat/search'
import type { ChatMessage, Speaker } from '@/lib/chat/types'
import { searchMessages } from '@/server/actions/chat'

/** Long enough that typing a word is one request, not six. */
const SETTLE_MS = 350

/** Below this almost everything matches, and the scan is the expensive part. */
const SHORTEST = 2

/**
 * Finding something that was said.
 *
 * Asks the server rather than filtering what is on screen: the transcript
 * holds the last fifty lines and the thing being looked for is almost never
 * one of them — that is why somebody is searching.
 *
 * Results stand on their own, with who said it and when. Tapping one does not
 * move the transcript yet: the list is cursor-paged and windowed, so landing
 * on a message in the middle of a year of them is its own piece of work.
 */
export function RoomSearch({ roomId }: { roomId: string }) {
  const t = useTranslations('chat')
  const format = useFormatter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [found, setFound] = useState<ChatMessage[] | null>(null)
  const [who, setWho] = useState<Record<string, Speaker>>({})
  const [cursor, setCursor] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  /** Answers can land out of order; only the newest question is worth drawing. */
  const asked = useRef(0)

  const text = query.trim()
  const tooShort = text.length < SHORTEST
  /*
   * Derived rather than cleared in the effect. Emptying the box would
   * otherwise be a render that sets state, and keeping the last answer under
   * the new question also means no flash of nothing between two keystrokes.
   */
  const showing = tooShort ? null : found

  useEffect(() => {
    if (text.length < SHORTEST) return

    const mine = ++asked.current
    const timer = setTimeout(() => {
      setBusy(true)
      void searchMessages({ roomId, query: text }).then((result) => {
        if (mine !== asked.current) return
        setBusy(false)
        if (!result.ok) return setFound([])
        setFound(result.items)
        setWho(result.speakers)
        setCursor(result.cursor)
        setMore(result.more)
      })
    }, SETTLE_MS)

    return () => clearTimeout(timer)
  }, [text, roomId])

  const deeper = () => {
    setBusy(true)
    void searchMessages({ roomId, query: query.trim(), before: cursor }).then((result) => {
      setBusy(false)
      if (!result.ok) return
      setFound((shown) => [...(shown ?? []), ...result.items])
      setWho((known) => ({ ...known, ...result.speakers }))
      setCursor(result.cursor)
      setMore(result.more)
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('search')}
        title={t('search')}
        onClick={() => setOpen(true)}
      >
        <Search className="size-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t('search')}>
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('search')}
          />

          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {showing?.map((message) => (
              <div key={message.id} className="glass rounded-[var(--radius)] px-3 py-2">
                <p className="text-text-subtle flex gap-2 text-xs">
                  <span className="truncate font-medium">
                    {who[message.userId ?? '']?.name ?? t('formerMember')}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {format.dateTime(new Date(message.createdAt), 'dayMonthTime')}
                  </span>
                </p>
                <p className="text-text mt-0.5 text-sm break-words">
                  <Marked text={message.body} query={query} />
                </p>
              </div>
            ))}

            {showing?.length === 0 && !busy ? (
              <p className="text-text-subtle py-6 text-center text-sm">{t('searchEmpty')}</p>
            ) : null}

            {more && showing && showing.length > 0 ? (
              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={deeper}>
                {t('searchMore')}
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * The matched run, picked out of the line it was found in.
 *
 * Located on the normalised text and sliced out of the original, so the words
 * keep their marks on screen while still having been found without them.
 */
function Marked({ text, query }: { text: string; query: string }) {
  const needle = normalise(query)
  // Normalising is per character here — `đ` is the one letter that becomes a
  // different letter rather than losing a mark, and it is still one character,
  // so offsets line up either way.
  const at = needle === '' ? -1 : normalise(text).indexOf(needle)
  if (at < 0) return <>{text}</>

  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-accent-soft text-accent rounded px-0.5">
        {text.slice(at, at + needle.length)}
      </mark>
      {text.slice(at + needle.length)}
    </>
  )
}

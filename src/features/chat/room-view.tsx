'use client'

import { Send, Trash2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { VirtualInfiniteList } from '@/components/ui/virtual-infinite-list'
import type { ChatMessage, ChatRoom, MessagePage, Speaker } from '@/lib/chat/types'
import { ringRoom, useRoomLive } from '@/lib/hooks/use-room-live'
import { useTyping } from '@/lib/hooks/use-typing'
import { realtimeEnabled } from '@/lib/realtime/provider'
import { cn } from '@/lib/utils'
import {
  deleteMessage,
  loadNewMessages,
  loadOlderMessages,
  markRoomRead,
  sendMessage,
} from '@/server/actions/chat'

const ROW_ESTIMATE = 68

/**
 * A message on screen, which is not quite a message in the database: one that
 * has been typed but not yet acknowledged is standing there under its client
 * id, waiting to be swapped for the stored row.
 */
type Shown = ChatMessage & { pending?: boolean }

export function RoomView({
  room,
  me,
  initialPage,
  initialSpeakers,
}: {
  room: ChatRoom
  me: string
  initialPage: MessagePage
  initialSpeakers: Record<string, Speaker>
}) {
  const t = useTranslations('chat')
  const format = useFormatter()

  const [messages, setMessages] = useState<Shown[]>(initialPage.items)
  const [speakers, setSpeakers] = useState(initialSpeakers)
  const [older, setOlder] = useState<string | null>(
    initialPage.more ? (initialPage.items[0]?.id ?? null) : null,
  )
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const newest = useRef<string | null>(initialPage.items.at(-1)?.id ?? null)
  const catchingUp = useRef(false)

  /**
   * Keeps asking while the server says there is more.
   *
   * Stopping at the first page would move the cursor past messages that were
   * never shown, and nothing would ever go back for them — a hole in the
   * middle of the conversation that no amount of scrolling repairs.
   */
  const catchUp = useCallback(async () => {
    if (catchingUp.current) return
    catchingUp.current = true
    try {
      let more = true
      while (more) {
        const result = await loadNewMessages({ roomId: room.id, after: newest.current })
        if (!result.ok) return
        if (result.items.length > 0) {
          newest.current = result.cursor
          setSpeakers((known) => ({ ...known, ...result.speakers }))
          setMessages((shown) => {
            const seen = new Set(shown.map((m) => m.id))
            return [...shown, ...result.items.filter((m) => !seen.has(m.id))]
          })
          void markRoomRead({ roomId: room.id, messageId: result.cursor! })
        }
        more = result.more
      }
    } finally {
      catchingUp.current = false
    }
  }, [room.id])

  useRoomLive(room.doorbellKey, () => void catchUp())

  // My own uid comes from the roster rather than from Firebase directly: the
  // roster is what the names are drawn from, so if the two ever disagree the
  // indicator should follow the one the UI uses.
  const myUid = speakers[me]?.firebaseUid ?? null
  const { typists, announce, stop } = useTyping(room.doorbellKey, myUid)

  /**
   * Names for the uids that are typing, in roster order.
   *
   * A uid with no member behind it is dropped rather than shown as "former
   * member": the doorbell key is all it takes to make a claim, and an
   * unrecognised claimant is exactly the case not worth drawing.
   */
  const typingNames = typists
    .map((uid) => Object.values(speakers).find((speaker) => speaker.firebaseUid === uid)?.name)
    .filter((name): name is string => Boolean(name))

  const loadOlder = useCallback(async () => {
    if (!older || loadingOlder) return
    setLoadingOlder(true)
    try {
      const result = await loadOlderMessages({ roomId: room.id, before: older })
      if (!result.ok) return
      setMessages((shown) => {
        const seen = new Set(shown.map((m) => m.id))
        return [...result.items.filter((m) => !seen.has(m.id)), ...shown]
      })
      setOlder(result.more ? (result.items[0]?.id ?? null) : null)
    } finally {
      setLoadingOlder(false)
    }
  }, [older, loadingOlder, room.id])

  /**
   * Shows the message at once, then lets the server correct it.
   *
   * A round trip to a serverless function and a database is a few hundred
   * milliseconds, and watching your own sentence hang in the box for that long
   * reads as the app being broken rather than as the network being slow. The
   * row goes up immediately under the client id, and the answer swaps it for
   * the stored one — or takes it away and gives the words back to the box.
   */
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const body = draft.trim()
    if (body === '' || sending) return

    const clientId = crypto.randomUUID()
    const optimistic: Shown = {
      id: clientId,
      roomId: room.id,
      userId: me,
      body,
      // Left blank rather than guessed: the time a message was sent is the
      // server's to say, and the row is not showing a clock until it has.
      createdAt: '',
      deletedAt: null,
      pending: true,
    }

    setSending(true)
    setDraft('')
    setMessages((shown) => [...shown, optimistic])
    // Before the request, not after: the name should go the moment the words
    // do, not a round trip later.
    stop()

    const result = await sendMessage({ roomId: room.id, body, clientId })
    setSending(false)

    if (!result.ok) {
      setMessages((shown) => shown.filter((m) => m.id !== clientId))
      setDraft(body)
      toast.error(t(result.error === 'rate_limited' ? 'tooFast' : 'sendFailed'))
      return
    }

    setMessages((shown) => {
      // The doorbell can bring the stored row back before this reply arrives,
      // so the placeholder is removed first and the real one added only if it
      // is not already standing there.
      const without = shown.filter((m) => m.id !== clientId)
      return without.some((m) => m.id === result.message.id)
        ? without
        : [...without, result.message]
    })
    newest.current = result.message.id
    // Told after it is saved, so nobody is sent looking for something that is
    // not there yet.
    void ringRoom(result.doorbellKey)
  }

  const recall = async (message: ChatMessage) => {
    const result = await deleteMessage({ roomId: room.id, messageId: message.id })
    if (!result.ok) return
    setMessages((shown) =>
      // `deletedAt` only has to be non-null for the row to read as recalled,
      // and the server's own time arrives on the next page either way.
      shown.map((m) => (m.id === message.id ? { ...m, body: '', deletedAt: result.at } : m)),
    )
    void ringRoom(room.doorbellKey)
  }

  return (
    <div className="space-y-3">
      {!realtimeEnabled() ? <p className="text-text-subtle text-xs">{t('liveOff')}</p> : null}

      <VirtualInfiniteList
        items={messages}
        getKey={(message) => message.id}
        estimateSize={ROW_ESTIMATE}
        maxVisibleRows={{ base: 7, sm: 9 }}
        hasMore={Boolean(older)}
        loadingMore={loadingOlder}
        onLoadMore={() => void loadOlder()}
        loadMorePosition="start"
        stickToBottom
        loadingMoreLabel={t('loadOlder')}
        listClassName="divide-border-base divide-y"
        empty={<p className="text-text-subtle py-8 text-center text-sm">{t('emptyRoom')}</p>}
        renderItem={(message) => {
          const mine = message.userId === me
          const speaker = message.userId ? speakers[message.userId] : undefined
          return (
            <div className="group px-1 py-2">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium">
                  {mine ? t('you') : (speaker?.name ?? t('formerMember'))}
                </span>
                {message.pending ? null : (
                  <span className="text-text-subtle text-xs tabular-nums">
                    {format.dateTime(new Date(message.createdAt), 'clock')}
                  </span>
                )}
                {mine && !message.deletedAt && !message.pending ? (
                  <button
                    type="button"
                    onClick={() => void recall(message)}
                    aria-label={t('recall')}
                    className="text-text-subtle hover:text-bad ml-auto opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <p
                className={cn(
                  'mt-0.5 text-sm break-words whitespace-pre-wrap',
                  message.deletedAt && 'text-text-subtle italic',
                  // Faded until the server has it. Showing it as though it
                  // had landed would be a lie on the one occasion it matters:
                  // when the send is about to fail.
                  message.pending && 'opacity-60',
                )}
              >
                {message.deletedAt ? t('recalled') : message.body}
              </p>
            </div>
          )
        }}
      />

      {/* Between the transcript and the box, and it reserves no space: a
          permanent empty line under a conversation is a worse trade than the
          layout shifting by one row for four seconds. */}
      {typingNames.length > 0 ? (
        <p aria-live="polite" className="text-text-subtle px-1 text-xs">
          {typingNames.length === 1
            ? t('typing', { name: typingNames[0]! })
            : t('typingMany', { count: typingNames.length })}
        </p>
      ) : null}

      <form onSubmit={submit} className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            // Throttled inside the hook — every announcement is a write.
            announce()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) void submit(event)
          }}
          rows={1}
          maxLength={4000}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          className="glass border-border-base min-h-10 flex-1 resize-none rounded-[var(--radius)] px-3 py-2 text-base sm:min-h-11 sm:text-sm"
        />
        <Button type="submit" disabled={sending || draft.trim() === ''}>
          <Send className="size-4" />
          {t('send')}
        </Button>
      </form>
    </div>
  )
}

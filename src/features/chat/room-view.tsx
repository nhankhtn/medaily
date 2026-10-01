'use client'

import { Send, SmilePlus, Trash2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { VirtualInfiniteList } from '@/components/ui/virtual-infinite-list'
import type { ChatMessage, ChatRoom, MessageKind, MessagePage, Speaker } from '@/lib/chat/types'
import { ringRoom, useRoomLive } from '@/lib/hooks/use-room-live'
import { isSticker, REACTIONS } from '@/lib/chat/stickers'
import { onlyEmoji } from '@/lib/chat/only-emoji'
import { EmojiPicker, StickerPicker } from './pickers'
import { StickerArt } from './sticker-art'
import { useTyping } from '@/lib/hooks/use-typing'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import {
  deleteMessage,
  loadNewMessages,
  loadRecentMessages,
  toggleReaction,
  loadOlderMessages,
  markRoomRead,
  sendMessage,
} from '@/server/actions/chat'

/**
 * A bubble row: the name where there is one, the bubble, the time. Mine has
 * no name and comes out shorter, so this sits between the two rather than on
 * either — the list corrects itself once rows are measured, and the estimate
 * only has to keep the scrollbar honest before that.
 */
const ROW_ESTIMATE = 60

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
  const router = useRouter()
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
        }
        more = result.more
      }

      // Paging forward only ever brings what did not exist before. A recall or
      // a reaction on something already on screen has to be fetched again, or
      // the other people in the room keep reading words that were taken back.
      const recent = await loadRecentMessages(room.id)
      if (recent.ok) {
        const changed = new Map(recent.items.map((m) => [m.id, m]))
        setMessages((shown) => shown.map((m) => changed.get(m.id) ?? m))
      }
    } finally {
      catchingUp.current = false
    }
  }, [room.id])

  useRoomLive(room.doorbellKey, () => void catchUp())

  /**
   * Having the room open is having read it.
   *
   * This used to happen only while catching up, so opening a room full of
   * unread messages marked none of them — the badge stayed up until somebody
   * sent one more. Pending rows are skipped: their id is the client's, and
   * storing one as the place somebody had read up to would make the next
   * count start from nowhere.
   */
  const lastSeen = [...messages].reverse().find((message) => !message.pending)?.id ?? null
  useEffect(() => {
    if (!lastSeen) return
    // The badge is drawn by the layout, which is already on screen by the time
    // a room is opened — the server marking its own cache stale changes
    // nothing a person can see until something asks for the route again.
    void markRoomRead({ roomId: room.id, messageId: lastSeen }).then((result) => {
      if (result.ok) router.refresh()
    })
  }, [room.id, lastSeen, router])

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
    await send('text', draft.trim())
  }

  const send = async (kind: MessageKind, body: string) => {
    if (body === '' || sending) return

    const clientId = crypto.randomUUID()
    const optimistic: Shown = {
      id: clientId,
      roomId: room.id,
      userId: me,
      kind,
      body,
      reactions: {},
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

    const result = await sendMessage({ roomId: room.id, kind, body, clientId })
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

  /**
   * Adding and removing are the same tap, so the row is corrected before the
   * server answers and put back if it disagrees — a reaction that lags behind
   * the finger reads as a button that did not work.
   */
  const react = async (message: Shown, emoji: string) => {
    if (message.pending) return

    const mine = (message.reactions[emoji] ?? []).includes(me)
    setMessages((shown) => shown.map((m) => (m.id === message.id ? withReaction(m, emoji, me) : m)))

    const result = await toggleReaction({ roomId: room.id, messageId: message.id, emoji })
    if (!result.ok) {
      setMessages((shown) =>
        shown.map((m) => (m.id === message.id ? withReaction(m, emoji, me) : m)),
      )
      return
    }
    // Told so everybody else's screen picks the change up on its next ring.
    void ringRoom(result.doorbellKey)
    void mine
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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <VirtualInfiniteList
        fill
        items={messages}
        getKey={(message) => message.id}
        estimateSize={ROW_ESTIMATE}
        // Kept for the estimate the virtualiser starts from; `fill` is what
        // decides the height once the parent has one.
        maxVisibleRows={{ base: 7, sm: 9 }}
        hasMore={Boolean(older)}
        loadingMore={loadingOlder}
        onLoadMore={() => void loadOlder()}
        loadMorePosition="start"
        stickToBottom
        loadingMoreLabel={t('loadOlder')}
        listClassName="space-y-1"
        empty={<p className="text-text-subtle py-8 text-center text-sm">{t('emptyRoom')}</p>}
        renderItem={(message) => {
          const mine = message.userId === me
          const speaker = message.userId ? speakers[message.userId] : undefined
          const recallable = mine && !message.deletedAt && !message.pending

          /*
           * Side says who, so the name does not have to. Mine on the right in
           * the accent, everyone else's on the left — the arrangement every
           * chat app has trained people to read at a glance, which is why the
           * name above the bubble is only drawn for other people. Reading
           * "Bạn" over every second line is repeating what the side already
           * said.
           */
          return (
            <div className={cn('group flex px-1 py-0.5', mine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'flex max-w-[80%] min-w-0 flex-col gap-0.5 sm:max-w-[70%]',
                  mine ? 'items-end' : 'items-start',
                )}
              >
                {mine ? null : (
                  <span className="text-text-subtle px-1 text-xs font-medium">
                    {speaker?.name ?? t('formerMember')}
                  </span>
                )}

                <div className="flex min-w-0 items-end gap-1.5">
                  {/* Only for other people, as every chat app does it: your own
                      face beside your own words tells you nothing you did not
                      already know, and it costs a column of width. */}
                  {mine ? null : (
                    <Avatar
                      name={speaker?.name ?? t('formerMember')}
                      src={speaker?.imageUrl}
                      className="size-6"
                    />
                  )}
                  {/* Outside the bubble and before it, so it never covers a
                      word and never moves the text when it appears. */}
                  {recallable ? (
                    <button
                      type="button"
                      onClick={() => void recall(message)}
                      aria-label={t('recall')}
                      className="text-text-subtle hover:text-bad shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}

                  {message.kind === 'sticker' && !message.deletedAt && isSticker(message.body) ? (
                    // No bubble: a sticker is the message, and a coloured box
                    // round it would only fight the disc it is drawn on.
                    <span className={cn('px-1', message.pending && 'opacity-60')}>
                      <StickerArt id={message.body} size={96} />
                    </span>
                  ) : (
                    <p
                      className={cn(
                        'min-w-0 rounded-2xl px-3 py-1.5 text-sm break-words whitespace-pre-wrap',
                        mine ? 'bg-accent text-accent-text' : 'bg-surface-2',
                        message.deletedAt && 'text-text-subtle bg-surface-2 italic',
                        // Faded until the server has it. Showing it as though
                        // it had landed would be a lie on the one occasion it
                        // matters: when the send is about to fail.
                        message.pending && 'opacity-60',
                        // A message that is only emoji is the message, so it
                        // is drawn at the size somebody meant it to be read at.
                        onlyEmoji(message.body) && 'bg-transparent px-1 text-4xl leading-tight',
                      )}
                    >
                      {message.deletedAt ? t('recalled') : message.body}
                    </p>
                  )}
                  {message.pending ? null : (
                    <ReactionBar
                      reactions={message.reactions}
                      me={me}
                      mine={mine}
                      onToggle={(emoji) => void react(message, emoji)}
                    />
                  )}
                </div>

                {message.pending ? null : (
                  <span className="text-text-subtle px-1 text-[11px] tabular-nums">
                    {format.dateTime(new Date(message.createdAt), 'clock')}
                  </span>
                )}
              </div>
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
      <form onSubmit={submit} className="flex items-end gap-1 sm:gap-2">
        <EmojiPicker onPick={(emoji) => setDraft((was) => was + emoji)} />
        <StickerPicker onPick={(id) => void send('sticker', id)} />
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
        {/*
          * A square on a phone, where the word costs more room than it buys —
          * the arrow beside a box you have just typed into is not ambiguous.
          * `sr-only` rather than dropping the text, so it stays in the
          * accessible tree and the button keeps its name.
          */}
        <Button
          type="submit"
          size="icon"
          className="shrink-0 sm:w-auto sm:px-5"
          disabled={sending || draft.trim() === ''}
        >
          <Send className="size-4" />
          <span className="sr-only sm:not-sr-only">{t('send')}</span>
        </Button>
      </form>
    </div>
  )
}

/** One tap, both directions — the same shape the server settles on. */
function withReaction(message: Shown, emoji: string, me: string): Shown {
  const who = message.reactions[emoji] ?? []
  const next = { ...message.reactions }

  if (who.includes(me)) {
    const left = who.filter((id) => id !== me)
    if (left.length === 0) delete next[emoji]
    else next[emoji] = left
  } else {
    next[emoji] = [...who, me]
  }

  return { ...message, reactions: next }
}

/**
 * What is already on a message, plus a way to add to it.
 *
 * The row of choices only appears on hover or focus: six emoji under every
 * line would be louder than the conversation.
 */
/**
 * What is already on a message, and a way to add to it.
 *
 * The row of choices floats over the conversation rather than taking a line in
 * it, which is what a reaction picker looks like everywhere. That means
 * escaping the transcript: it is a scroll box, and anything positioned inside
 * one is cut off at its edge. So the panel is rendered into the document and
 * placed in viewport coordinates against the button that opened it.
 */
function ReactionBar({
  reactions,
  me,
  mine,
  onToggle,
}: {
  reactions: Record<string, string[]>
  me: string
  /** Your own messages sit against the right margin, and so does this. */
  mine: boolean
  onToggle: (emoji: string) => void
}) {
  const t = useTranslations('chat')
  const trigger = useRef<HTMLButtonElement>(null)
  const [at, setAt] = useState<{ bottom: number; left?: number; right?: number } | null>(null)
  const chosen = Object.entries(reactions).filter(([, who]) => who.length > 0)

  const open = () => {
    const box = trigger.current?.getBoundingClientRect()
    if (!box) return
    setAt({
      // Anchored by its bottom edge, so the panel needs no measured height to
      // sit just above the button.
      bottom: window.innerHeight - box.top + 8,
      ...(mine
        ? { right: Math.max(8, window.innerWidth - box.right) }
        : { left: Math.max(8, box.left) }),
    })
  }

  return (
    <>
      <Button
        ref={trigger}
        type="button"
        variant="ghost"
        size="iconSm"
        aria-label={t('react')}
        aria-expanded={at !== null}
        onClick={() => (at ? setAt(null) : open())}
        // Always there on a phone, where there is no hovering to reveal it;
        // out of the way on a pointer, where a button under every line would
        // be louder than the conversation.
        className={cn(
          'shrink-0 opacity-100 transition-opacity sm:opacity-0',
          'sm:group-hover:opacity-100 sm:focus-visible:opacity-100',
          at && 'sm:opacity-100',
        )}
      >
        <SmilePlus className="size-4" />
      </Button>

      {at ? (
        <FloatingReactions
          at={at}
          onClose={() => setAt(null)}
          onPick={(emoji) => {
            onToggle(emoji)
            setAt(null)
          }}
        />
      ) : null}

      {chosen.length > 0 ? (
        <span className="flex flex-wrap items-center gap-1">
          {chosen.map(([emoji, who]) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onToggle(emoji)}
              aria-pressed={who.includes(me)}
              className={cn(
                'border-border-base flex h-7 shrink-0 items-center gap-1 rounded-full border px-2 text-sm',
                who.includes(me) ? 'border-accent bg-accent/10' : 'bg-surface-2',
              )}
            >
              <span>{emoji}</span>
              <span className="text-text-subtle text-xs tabular-nums">{who.length}</span>
            </button>
          ))}
        </span>
      ) : null}
    </>
  )
}

/**
 * The six choices, over everything.
 *
 * Closed by a scroll as well as by a tap elsewhere: the coordinates were taken
 * once, and a panel that stayed put while the conversation moved under it
 * would end up pointing at the wrong message.
 */
function FloatingReactions({
  at,
  onPick,
  onClose,
}: {
  at: { bottom: number; left?: number; right?: number }
  onPick: (emoji: string) => void
  onClose: () => void
}) {
  const t = useTranslations('chat')
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const away = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node)) onClose()
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    // Capture, because the transcript scrolls rather than the window.
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', key)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={panel}
      style={at}
      className="glass border-border-base fixed z-50 flex items-center gap-0.5 rounded-full border p-0.5 shadow-lg"
    >
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-label={t('reactWith', { emoji })}
          onClick={() => onPick(emoji)}
          className="hover:bg-surface-2 flex size-9 items-center justify-center rounded-full text-lg"
        >
          {emoji}
        </button>
      ))}
    </div>,
    document.body,
  )
}

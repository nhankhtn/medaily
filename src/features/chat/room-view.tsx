'use client'

import { Copy, CornerUpLeft, Send, SmilePlus, Trash2, X } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { VirtualInfiniteList } from '@/components/ui/virtual-infinite-list'
import {
  previewOf,
  type ChatMessage,
  type ChatRoom,
  type MessageKind,
  type MessagePage,
  type ReplyPreview,
  type Speaker,
} from '@/lib/chat/types'
import { ringRoom, useRoomLive } from '@/lib/hooks/use-room-live'
import { isSticker, REACTIONS } from '@/lib/chat/stickers'
import { onlyEmoji } from '@/lib/chat/only-emoji'
import { dayKeyOf, layoutAt } from '@/lib/chat/grouping'
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
/** Long enough not to fire on a tap, short enough not to feel stuck. */
const HOLD_MS = 450

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

  const [menu, setMenu] = useState<{ at: Anchor; message: Shown } | null>(null)
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heldFrom = useRef<{ x: number; y: number } | null>(null)
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
  /*
   * The clock the transcript is laid out against.
   *
   * Two things read it: a message with no server time yet, which was typed a
   * moment ago by definition, and the date separators deciding what counts as
   * today. The second is why it ticks rather than being taken once — a room
   * left open across midnight would keep calling yesterday "today", and the
   * separator is the one thing on screen whose whole job is to say which day
   * it is. A minute is far finer than the question needs.
   */
  /** The message the box is currently answering, or nothing. */
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null)

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(tick)
  }, [])

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
      // Drawn from what is on screen, not fetched: the message being answered
      // is the one the finger just touched, and asking the server to describe
      // a row already standing there would be a round trip to learn nothing.
      replyTo: replyingTo ? previewOf(replyingTo) : null,
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

    const answering = replyingTo
    setReplyingTo(null)

    const result = await sendMessage({
      roomId: room.id,
      kind,
      body,
      clientId,
      ...(answering ? { replyToId: answering.id } : {}),
    })
    setSending(false)

    if (!result.ok) {
      setMessages((shown) => shown.filter((m) => m.id !== clientId))
      setDraft(body)
      // The quote comes back with the words. Losing it would make the retry a
      // different message from the one that failed.
      setReplyingTo(answering)
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

  const copy = async (body: string) => {
    try {
      await navigator.clipboard.writeText(body)
      toast.success(t('copied'))
    } catch {
      // Blocked, or an insecure origin. Saying nothing would read as a copy
      // that worked, and the next paste would be the wrong thing.
      toast.error(t('copyFailed'))
    }
  }

  /*
   * A press and hold on a phone, a right-click on a pointer.
   *
   * The message is what is being acted on, so the message is what you reach
   * for — and it leaves the button beside the bubble doing one thing, which
   * is the thing it is drawn as.
   */
  const openMenu = (clientX: number, clientY: number, message: Shown) => {
    if (message.pending || message.deletedAt) return
    setMenu({
      message,
      at: {
        bottom: window.innerHeight - clientY + 8,
        // Away from whichever edge it was opened near, so a menu asked for in
        // the right-hand margin does not open off the screen.
        ...(clientX > window.innerWidth / 2
          ? { right: Math.max(8, window.innerWidth - clientX) }
          : { left: Math.max(8, clientX) }),
      },
    })
  }

  const endHold = () => {
    if (hold.current) clearTimeout(hold.current)
    hold.current = null
    heldFrom.current = null
  }

  const holdProps = (message: Shown) => ({
    onContextMenu: (event: React.MouseEvent) => {
      event.preventDefault()
      openMenu(event.clientX, event.clientY, message)
    },
    onPointerDown: (event: React.PointerEvent) => {
      // A mouse already has a button for this, and holding one down is how
      // somebody selects text.
      if (event.pointerType === 'mouse') return
      const { clientX, clientY } = event
      heldFrom.current = { x: clientX, y: clientY }
      hold.current = setTimeout(() => openMenu(clientX, clientY, message), HOLD_MS)
    },
    onPointerMove: (event: React.PointerEvent) => {
      const from = heldFrom.current
      if (!from) return
      // A thumb that travelled is a scroll, not a hold.
      if (Math.abs(event.clientX - from.x) > 10 || Math.abs(event.clientY - from.y) > 10) endHold()
    },
    onPointerUp: endHold,
    onPointerCancel: endHold,
  })

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
        listClassName=""
        /*
         * Fills, because an empty list drops the scroll box entirely and
         * returns this node bare — so without a `flex-1` here the composer
         * climbs to meet the line of text and sits halfway up an empty room.
         */
        empty={
          <p className="text-text-subtle flex min-h-0 flex-1 items-center justify-center text-center text-sm">
            {t('emptyRoom')}
          </p>
        }
        renderItem={(message, index) => {
          const mine = message.userId === me
          const speaker = message.userId ? speakers[message.userId] : undefined
          const { startsRun, endsRun, startsDay } = layoutAt(messages, index, now)
          const bare =
            (message.kind === 'sticker' && !message.deletedAt && isSticker(message.body)) ||
            (!message.deletedAt && onlyEmoji(message.body))

          /*
           * Side says who, so the name does not have to. Mine on the right in
           * the accent, everyone else's on the left — the arrangement every
           * chat app has trained people to read at a glance.
           *
           * Runs are what make it a conversation rather than a log. Five
           * messages from one person say the name once, wear one face, and sit
           * two pixels apart; the next run starts sixteen pixels down. The gap
           * between runs has to beat the gap inside one by enough to be read
           * as a break rather than a wobble — at eight it did not, and a
           * screen of messages five minutes apart, each its own run, came out
           * as one undifferentiated column. The corners follow: the tail
           * corner is square only on the last of a run, so a stack reads as
           * one block of speech.
           */
          // `index`, not `first:` — the virtualiser gives every row its own
          // `<li>`, so each wrapper is the first child of its own parent and a
          // `first:mt-0` matched all of them. The gap between runs was zero
          // however large the class said it was.
          return (
            <div className={cn(index === 0 ? 'mt-0' : startsRun ? 'mt-4' : 'mt-0.5')}>
              {startsDay ? <DaySeparator at={message.createdAt} now={now} /> : null}

              <div className={cn('group flex px-1', mine ? 'justify-end' : 'justify-start')}>
                <div className={cn('flex max-w-[85%] items-end gap-1.5 sm:max-w-[70%]', mine && 'flex-row-reverse')}>
                  {/*
                    Only for other people, and only on the last of a run: a face
                    beside every line of one person talking is five copies of
                    the same information. The empty box keeps the stack above it
                    aligned, which is the whole reason it is drawn at all.
                  */}
                  {mine ? null : endsRun ? (
                    <Avatar
                      name={speaker?.name ?? t('formerMember')}
                      src={speaker?.imageUrl}
                      className="size-7 shrink-0"
                    />
                  ) : (
                    <span aria-hidden className="size-7 shrink-0" />
                  )}

                  {bare ? (
                    // No bubble: a sticker or a line of nothing but emoji is
                    // the message, and a coloured box round it would only fight
                    // what is drawn inside.
                    <span
                      {...holdProps(message)}
                      className={cn(
                        'flex flex-col max-sm:[-webkit-touch-callout:none] max-sm:select-none',
                        mine ? 'items-end' : 'items-start',
                        message.pending && 'opacity-60',
                      )}
                    >
                      {/* Asked again here rather than trusted from `bare`:
                          `isSticker` is what narrows the body to an id, and a
                          cast in its place would be the same check written so
                          it cannot fail. */}
                      {isSticker(message.body) ? (
                        <StickerArt id={message.body} size={96} />
                      ) : (
                        <span className="px-1 text-4xl leading-tight">{message.body}</span>
                      )}
                      <ReactionPills
                        reactions={message.reactions}
                        me={me}
                        onToggle={(emoji) => void react(message, emoji)}
                      />
                      {message.pending ? null : (
                        <span className="text-text-subtle px-1 text-[10px] tabular-nums">
                          {format.dateTime(new Date(message.createdAt), 'clock')}
                        </span>
                      )}
                    </span>
                  ) : (
                    <div
                      {...holdProps(message)}
                      className={cn(
                        'relative min-w-0 rounded-2xl px-3 py-1.5 text-sm',
                        // A hold is the way into the menu here, so it must not
                        // also be the way into a text selection.
                        'max-sm:[-webkit-touch-callout:none] max-sm:select-none',
                        // Room kept for the clock sitting in the corner, so the
                        // last word never runs under it. Telegram reserves the
                        // same gap, which is why a one-word bubble there is
                        // wider than the word.
                        'pr-14',
                        mine ? 'bg-accent text-accent-text' : 'bg-surface-2',
                        // Square on the tail side except at the end of the run.
                        mine
                          ? endsRun
                            ? 'rounded-br-md'
                            : 'rounded-r-md'
                          : endsRun
                            ? 'rounded-bl-md'
                            : 'rounded-l-md',
                        !startsRun && (mine ? 'rounded-tr-md' : 'rounded-tl-md'),
                        message.deletedAt && 'text-text-subtle bg-surface-2 italic',
                        // Faded until the server has it. Showing it as though
                        // it had landed would be a lie on the one occasion it
                        // matters: when the send is about to fail.
                        message.pending && 'opacity-60',
                      )}
                    >
                      {/* Inside the bubble and only once per run, which is
                          where every chat app puts it — above it, the name was
                          a line of its own competing with the words. */}
                      {mine || !startsRun ? null : (
                        /*
                         * Takes back the gutter the clock is holding. `pr-14`
                         * keeps a last line of words clear of a clock sitting
                         * in the bottom corner — but the name is the first
                         * line and the clock is nowhere near it, and paying
                         * 3.5rem for that on a phone is what sent a name of
                         * four short words onto two, with the room to its
                         * right empty.
                         */
                        <span className="text-accent -mr-11 block text-xs font-semibold">
                          {speaker?.name ?? t('formerMember')}
                        </span>
                      )}

                      {message.replyTo && !message.deletedAt ? (
                        <Quote preview={message.replyTo} speakers={speakers} mine={mine} />
                      ) : null}

                      <span className="block break-words whitespace-pre-wrap">
                        {message.deletedAt ? t('recalled') : message.body}
                      </span>

                      <ReactionPills
                        reactions={message.reactions}
                        me={me}
                        onToggle={(emoji) => void react(message, emoji)}
                      />

                      {message.pending ? null : (
                        <span
                          className={cn(
                            'absolute right-2.5 bottom-1 text-[10px] tabular-nums',
                            mine ? 'text-accent-text/70' : 'text-text-subtle',
                          )}
                        >
                          {format.dateTime(new Date(message.createdAt), 'clock')}
                        </span>
                      )}
                    </div>
                  )}

                  {/* One control beside the bubble, not three. Reply and
                      recall live in the panel it opens: a row of icons under
                      every line was louder than the conversation, and on a
                      phone — where nothing hides behind a hover — it was all
                      anyone saw. */}
                  {message.pending || message.deletedAt ? null : (
                    <MessageActions mine={mine} onReact={(emoji) => void react(message, emoji)} />
                  )}
                </div>
              </div>
            </div>
          )
        }}
      />

      {menu ? (
        <MessageMenu
          at={menu.at}
          onClose={() => setMenu(null)}
          onReply={() => {
            setReplyingTo(menu.message)
            setMenu(null)
          }}
          onCopy={
            isSticker(menu.message.body)
              ? undefined
              : () => {
                  void copy(menu.message.body)
                  setMenu(null)
                }
          }
          onRecall={
            menu.message.userId === me
              ? () => {
                  void recall(menu.message)
                  setMenu(null)
                }
              : undefined
          }
        />
      ) : null}

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
      {replyingTo ? (
        <div className="glass flex items-center gap-2 rounded-[var(--radius)] px-2 py-1.5">
          <CornerUpLeft className="text-text-subtle size-3.5 shrink-0" />
          <div className="min-w-0 flex-1 border-l-2 border-accent pl-2">
            <p className="text-accent truncate text-xs font-medium">
              {replyingTo.userId === me
                ? t('you')
                : (speakers[replyingTo.userId ?? '']?.name ?? t('formerMember'))}
            </p>
            <p className="text-text-muted truncate text-xs">
              {previewOf(replyingTo).body || t('recalled')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            aria-label={t('cancelReply')}
            className="text-text-subtle hover:text-text flex size-7 shrink-0 items-center justify-center rounded-full"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      <form onSubmit={submit} className="flex items-end gap-1 sm:gap-2">
        <StickerPicker onPick={(id) => void send('sticker', id)} />
        <div className="relative flex-1">
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
            // The right padding is what keeps the last word off the emoji
            // button sitting over the box: 32px of button plus its inset.
            className="glass border-border-base block min-h-10 w-full resize-none rounded-[var(--radius)] py-2 pr-11 pl-3 text-base sm:min-h-11 sm:pr-12 sm:text-sm"
          />
          {/*
            * Inside the box rather than beside it, which is where every chat
            * app people already use keeps it. `bottom-1` rather than centred
            * so it stays put if the box ever grows a second line.
            */}
          <EmojiPicker
            onPick={(emoji) => setDraft((was) => was + emoji)}
            size="iconSm"
            align="right"
            className="absolute right-1 bottom-1"
          />
        </div>
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

/**
 * The day a run of messages belongs to, as a line across the conversation.
 *
 * Without it a transcript is one unbroken column and "15:50" could be today or
 * three weeks ago. Centred and small on purpose: it is punctuation, not a
 * heading.
 */
function DaySeparator({ at, now }: { at: string; now: number }) {
  const t = useTranslations('common')
  const format = useFormatter()

  const when = at === '' ? new Date(now) : new Date(at)
  const today = dayKeyOf({ userId: null, createdAt: '' }, now)
  const key = dayKeyOf({ userId: null, createdAt: when.toISOString() }, now)
  const yesterday = dayKeyOf(
    { userId: null, createdAt: new Date(now - 24 * 60 * 60 * 1000).toISOString() },
    now,
  )

  const label =
    key === today ? t('today') : key === yesterday ? t('yesterday') : format.dateTime(when, 'weekdayDayMonth')

  return (
    <div className="flex justify-center py-2">
      <span className="glass text-text-subtle rounded-full px-2.5 py-0.5 text-[11px] font-medium">
        {label}
      </span>
    </div>
  )
}

/**
 * The message an answer is answering, drawn above it.
 *
 * A bar down the left rather than a box: it has to read as something quoted
 * from elsewhere, not as a second message nested inside this one. The colour
 * follows the bubble it sits in, because the accent that reads as a quote on a
 * grey bubble disappears entirely on an accent-coloured one.
 */
function Quote({
  preview,
  speakers,
  mine,
}: {
  preview: ReplyPreview
  speakers: Record<string, Speaker>
  mine: boolean
}) {
  const t = useTranslations('chat')
  const who = preview.userId ? speakers[preview.userId]?.name : null

  return (
    <span
      className={cn(
        'mb-1 block min-w-0 border-l-2 pl-2',
        mine ? 'border-accent-text/50' : 'border-accent',
      )}
    >
      <span
        className={cn(
          'block truncate text-xs font-medium',
          mine ? 'text-accent-text/80' : 'text-accent',
        )}
      >
        {who ?? t('formerMember')}
      </span>
      <span
        className={cn('block truncate text-xs', mine ? 'text-accent-text/70' : 'text-text-muted')}
      >
        {preview.deleted
          ? t('recalled')
          : preview.kind === 'sticker'
            ? t('stickerQuote')
            : preview.body}
      </span>
    </span>
  )
}

/**
 * One tap, both directions — the same shape the server settles on.
 *
 * Off everything first, because there is one reaction per person: tapping a
 * second emoji moves yours rather than adding to it. The screen has to agree
 * with the store on that or the optimistic row shows two of yours for the
 * length of a round trip and then one of them vanishes.
 */
function withReaction(message: Shown, emoji: string, me: string): Shown {
  const had = (message.reactions[emoji] ?? []).includes(me)

  const next: Record<string, string[]> = {}
  for (const [key, who] of Object.entries(message.reactions)) {
    const left = who.filter((id) => id !== me)
    if (left.length > 0) next[key] = left
  }

  if (!had) next[emoji] = [...(next[emoji] ?? []), me]
  return { ...message, reactions: next }
}

/** Where a floating panel sits, in viewport coordinates. */
export type Anchor = { bottom: number; left?: number; right?: number }

/**
 * Reacting, behind one button.
 *
 * Only the six faces. Everything that is *done* to a message — replying,
 * copying, taking it back — answers to the message itself now: a right-click
 * on a pointer, a press and hold on a phone. A button that opened a menu of
 * everything made the common case, which is a reaction, two steps deep.
 */
function MessageActions({
  mine,
  onReact,
}: {
  /** Your own messages sit against the right margin, and so does this. */
  mine: boolean
  onReact: (emoji: string) => void
}) {
  const t = useTranslations('chat')
  const trigger = useRef<HTMLButtonElement>(null)
  const [at, setAt] = useState<Anchor | null>(null)

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
        <FloatingPanel at={at} onClose={() => setAt(null)}>
          <div className="flex items-center gap-0.5">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={t('reactWith', { emoji })}
                onClick={() => {
                  onReact(emoji)
                  setAt(null)
                }}
                className="hover:bg-surface-2 flex size-9 items-center justify-center rounded-full text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
        </FloatingPanel>
      ) : null}
    </>
  )
}

/**
 * The shell both panels float in.
 *
 * Escaping the transcript is the whole reason it exists: that is a scroll box,
 * and anything positioned inside one is cut off at its edge. So this renders
 * into the document and is placed in viewport coordinates.
 *
 * Closed by a scroll as well as by a tap elsewhere — the coordinates were
 * taken once, and a panel that stayed put while the conversation moved under
 * it would end up pointing at the wrong message.
 */
function FloatingPanel({
  at,
  onClose,
  children,
}: {
  at: Anchor
  onClose: () => void
  children: React.ReactNode
}) {
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
      className="glass border-border-base fixed z-50 flex flex-col gap-0.5 rounded-2xl border p-0.5 shadow-lg"
    >
      {children}
    </div>,
    document.body,
  )
}

/**
 * What is done to a message, opened from the message.
 *
 * One of these for the whole transcript rather than one per row: only one can
 * be open, and a menu per message is a hundred listeners for the one that is
 * showing.
 */
function MessageMenu({
  at,
  onClose,
  onReply,
  onCopy,
  onRecall,
}: {
  at: Anchor
  onClose: () => void
  onReply: () => void
  /** Absent when there are no words to take — a sticker is an id, not text. */
  onCopy?: () => void
  /** Absent when the message is not yours to take back. */
  onRecall?: () => void
}) {
  const t = useTranslations('chat')
  const item =
    'hover:bg-surface-2 flex h-9 w-full items-center gap-2 rounded-xl px-3 text-left text-sm'

  return (
    <FloatingPanel at={at} onClose={onClose}>
      <div className="flex w-40 flex-col gap-0.5">
        <button type="button" onClick={onReply} className={item}>
          <CornerUpLeft className="size-4" />
          {t('reply')}
        </button>
        {onCopy ? (
          <button type="button" onClick={onCopy} className={item}>
            <Copy className="size-4" />
            {t('copy')}
          </button>
        ) : null}
        {onRecall ? (
          <button type="button" onClick={onRecall} className={`${item} text-bad`}>
            <Trash2 className="size-4" />
            {t('recall')}
          </button>
        ) : null}
      </div>
    </FloatingPanel>
  )
}

/**
 * What is already on a message, drawn in the bubble's own footprint.
 *
 * Beside the bubble they were a second object competing with it for the 85%
 * a message is allowed, and a long sentence with three reactions ended up
 * narrower than the same sentence without them. Inside, they hang off the end
 * of the words the way they do everywhere else, and the bubble grows to hold
 * them instead of shrinking to make room.
 */
function ReactionPills({
  reactions,
  me,
  onToggle,
}: {
  reactions: Record<string, string[]>
  me: string
  onToggle: (emoji: string) => void
}) {
  const chosen = Object.entries(reactions).filter(([, who]) => who.length > 0)
  if (chosen.length === 0) return null

  return (
    <span className="mt-1 flex flex-wrap items-center gap-1">
      {chosen.map(([emoji, who]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onToggle(emoji)}
          aria-pressed={who.includes(me)}
          className={cn(
            'flex h-6 shrink-0 items-center gap-1 rounded-full px-1.5 text-xs',
            who.includes(me)
              ? 'bg-accent/15 ring-accent/50 ring-1'
              : 'bg-text/10',
          )}
        >
          <span className="text-sm leading-none">{emoji}</span>
          <span className="tabular-nums">{who.length}</span>
        </button>
      ))}
    </span>
  )
}

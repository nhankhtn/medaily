'use client'

import { useVirtualizer } from '@tanstack/react-virtual'
import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

const DEFAULT_ESTIMATE = 56
const DEFAULT_OVERSCAN = 8
const DEFAULT_LOAD_MARGIN = '120px'

export type VirtualInfiniteListProps<T> = {
  items: T[]
  getKey: (item: T) => string
  renderItem: (item: T, index: number) => ReactNode
  /** Estimated row height in px; also drives `maxVisibleRows` height. */
  estimateSize?: number
  /**
   * Phone row height, when a row stacks there and is taller than `estimateSize`.
   * Without it `maxVisibleRows.base` counts desktop rows, and the phone list is
   * cut off part-way down one.
   */
  phoneEstimateSize?: number
  overscan?: number
  /**
   * How many rows fit in the scroll viewport before overflow.
   * Heights = `estimateSize * count` (base = phone, `sm` = desktop).
   */
  maxVisibleRows?: { base: number; sm: number }
  /**
   * Take whatever height the parent gives instead of capping at
   * `maxVisibleRows`. For the one list that is the page rather than a panel
   * on it: a conversation should end where the window does, not a fixed
   * number of rows up from wherever it happens to start.
   *
   * The parent has to be a flex column with a bounded height for this to mean
   * anything — `h-full` against an unbounded parent is just `auto`.
   */
  fill?: boolean
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  /**
   * Which end asks for more. `end` is a feed that grows downwards; `start` is
   * a conversation, where the newest is at the bottom and older is above.
   */
  loadMorePosition?: 'end' | 'start'
  /**
   * Keeps the view at the newest row: on first paint, and afterwards only
   * while the reader was already there. Scrolling up to read must not be
   * yanked back by somebody else typing.
   */
  stickToBottom?: boolean
  /**
   * Changing this goes to the newest row whatever the reader was doing.
   *
   * For the one case where that is right: they just sent something. Nobody
   * writes a message in order to stay where they were, and every chat app
   * jumps to it — so this is not the pin being overridden, it is the reader
   * having asked for the bottom in the plainest way there is.
   */
  pinSignal?: number
  /** IntersectionObserver rootMargin before the sentinel. */
  loadMoreMargin?: string
  loadingMoreLabel?: ReactNode
  /**
   * A row to bring into view, by its key.
   *
   * For arriving somewhere rather than reading: landing on a search result
   * means the view has to move to a row that may be a hundred above the
   * bottom. Setting it also lets go of the pin — otherwise the next thing to
   * change the height would yank the view straight back to the newest line,
   * which is exactly where somebody has just asked not to be.
   */
  scrollToKey?: string | null
  className?: string
  listClassName?: string
  empty?: ReactNode
}

/**
 * Windowed list with optional infinite scroll.
 *
 * Row markup is client-only. SSR (and the first client paint) render an empty
 * shell of the same size so TanStack Virtual / locale-formatted cells cannot
 * hydrate-mismatch the server HTML.
 */
export function VirtualInfiniteList<T>({
  items,
  getKey,
  renderItem,
  estimateSize = DEFAULT_ESTIMATE,
  phoneEstimateSize,
  overscan = DEFAULT_OVERSCAN,
  maxVisibleRows = { base: 5, sm: 10 },
  fill = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  loadMorePosition = 'end',
  stickToBottom = false,
  pinSignal,
  loadMoreMargin = DEFAULT_LOAD_MARGIN,
  loadingMoreLabel,
  scrollToKey,
  className,
  listClassName,
  empty,
}: VirtualInfiniteListProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  /*
   * State, not a ref: the list is two different elements — the windowed one
   * and the plain one — and React swaps the node when it moves between them.
   * A ref would leave the observer below watching a node that is no longer in
   * the document, which is silent and looks exactly like a resize that never
   * happens.
   */
  const [list, setList] = useState<HTMLUListElement | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const firstKey = items[0] ? getKey(items[0]) : null
  /**
   * Whether to keep the newest line in view.
   *
   * Only a hand turns this off. The earlier version worked it out from the
   * scroll position on every scroll event — but the pin below scrolls, and so
   * does the browser when it clamps a position that no longer exists, and
   * both arrive as ordinary scroll events. One of those in an intermediate
   * state read as "not at the bottom", and from then on nothing ever pinned
   * again: a conversation opened at the top and stayed there.
   *
   * So the gestures turn it off and only reaching the bottom turns it back
   * on. Scrolling up to read still stops the yanking, which is the whole
   * point of having the flag.
   */
  const pinned = useRef(true)
  const previous = useRef({ count: 0, firstKey: null as string | null, height: 0, top: 0 })
  /*
   * The observer below outlives any one render, and what it has to do depends
   * on how many rows there are now. Reached through a box that is refilled on
   * every render, so it can never act on a count that has moved on.
   */
  const pin = useRef<() => void>(() => {})

  const viewportHeight = estimateSize * maxVisibleRows.sm

  const shellStyle = {
    ['--vil-h']: `${(phoneEstimateSize ?? estimateSize) * maxVisibleRows.base}px`,
    ['--vil-h-sm']: `${viewportHeight}px`,
  } as CSSProperties

  const shellClass = cn(
    'overflow-y-auto',
    fill ? 'h-full min-h-0' : 'max-h-[var(--vil-h)] sm:max-h-[var(--vil-h-sm)]',
    className,
  )

  // TanStack Virtual returns unstable function identities; React Compiler skips this component.
  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer
  const virtualizer = useVirtualizer({
    count: mounted ? items.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan,
    initialRect: { width: 1, height: viewportHeight },
  })

  useEffect(() => {
    if (pinSignal === undefined || !mounted) return
    pinned.current = true
    pin.current()
  }, [pinSignal, mounted])

  useEffect(() => {
    if (!scrollToKey || !mounted) return
    const index = items.findIndex((item) => getKey(item) === scrollToKey)
    if (index < 0) return

    pinned.current = false
    // Centred, because a row landing against the top or bottom edge gives no
    // sense of what it sits between — which is most of why somebody jumped.
    virtualizer.scrollToIndex(index, { align: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `virtualizer` and `getKey` are new on every render; this must run when the key changes
  }, [scrollToKey, mounted, items])

  /**
   * The changes that arrive without a render.
   *
   * A picture finishing its download, a font swapping in, the box itself
   * settling once the flex parent has a height — none of those are a React
   * update, so the layout effect above never runs for them, and each one
   * moves the bottom out from under wherever the view is sitting.
   */
  useEffect(() => {
    const element = scrollRef.current
    if (!mounted || !stickToBottom || !element) return

    const observer = new ResizeObserver(() => pin.current())
    observer.observe(element)
    if (list) observer.observe(list)
    return () => observer.disconnect()
  }, [mounted, stickToBottom, list])

  /**
   * Ask the virtualiser for the last row rather than setting `scrollTop` to
   * `scrollHeight`.
   *
   * The rows go in at `estimateSize` and are measured only once they have
   * been drawn, so until then `scrollHeight` is a guess — scrolling to it
   * lands wherever the guess was wrong, which for a conversation means part
   * way up it. `scrollToIndex` is the one that knows: it scrolls, lets the
   * rows it uncovered measure themselves, and corrects until the row it was
   * asked for really is at the bottom.
   */
  const toBottom = (element: HTMLElement) => {
    if (items.length > 0) virtualizer.scrollToIndex(items.length - 1, { align: 'end' })
    else element.scrollTop = element.scrollHeight
  }

  /**
   * Older messages arriving at the top push everything down by however tall
   * they are, which would throw the reader back to a line they had already
   * passed. Nothing tells us which end grew, so it is worked out: the count
   * went up *and* a different row is now first.
   */
  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element || !mounted) return

    const before = previous.current
    const prepended =
      items.length > before.count && firstKey !== before.firstKey && before.count > 0

    if (prepended) element.scrollTop = element.scrollHeight - before.height + before.top
    else if (stickToBottom && pinned.current) toBottom(element)

    previous.current = {
      count: items.length,
      firstKey,
      height: element.scrollHeight,
      top: element.scrollTop,
    }
    pin.current = () => {
      if (stickToBottom && pinned.current) toBottom(element)
    }
    // Every render, deliberately: the render that finally settles the height
    // is not one any dependency list here could name.
  })

  useEffect(() => {
    if (!mounted || !hasMore || !onLoadMore || loadingMore) return
    const root = scrollRef.current
    const target = sentinelRef.current
    if (!root || !target) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore()
      },
      { root, rootMargin: loadMoreMargin },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [mounted, hasMore, loadingMore, loadMoreMargin, onLoadMore, items.length])

  if (items.length === 0) {
    return empty ? <>{empty}</> : null
  }

  /*
   * Same empty shell on server and on the client's first paint.
   *
   * A filling list keeps filling here too. Pinning it to `--vil-h` meant the
   * shell came out of the server a fixed nine rows tall whatever box it was
   * in, so anything under it — the chat composer — rendered partway up the
   * card and then dropped to the bottom when hydration swapped in `h-full`.
   * One visible jump on every room opened, and no amount of loading state
   * above it helps, because the jump happens after the data has arrived.
   */
  if (!mounted) {
    return (
      <div
        className={cn(shellClass, !fill && 'h-[var(--vil-h)] sm:h-[var(--vil-h-sm)]')}
        style={shellStyle}
        aria-hidden
      />
    )
  }

  const virtualItems = virtualizer.getVirtualItems()
  const useVirtual = virtualItems.length > 0

  const sentinel = <div ref={sentinelRef} className="h-1" aria-hidden />
  const busy =
    loadingMore && loadingMoreLabel ? (
      <div className="text-text-subtle py-2 text-center text-xs">{loadingMoreLabel}</div>
    ) : null

  return (
    <div
      ref={scrollRef}
      className={shellClass}
      style={shellStyle}
      /*
       * The gestures that mean "I am looking at something else", and only
       * those. A press is not one of them: `pointerDown` was in this list for
       * the scrollbar, and it caught every tap on a message as well — one tap
       * anywhere in the transcript and nothing ever scrolled to a new message
       * again. Dragging a scrollbar is the case this gives up on, and a yank
       * back there is a smaller harm than a conversation that stops following
       * itself after a single touch.
       */
      onWheel={() => void (pinned.current = false)}
      onTouchMove={() => void (pinned.current = false)}
      onKeyDown={() => void (pinned.current = false)}
      onScroll={(event) => {
        // Only ever takes the pin back up: a scroll this component caused
        // must not be read as the reader asking to be left alone. A few
        // pixels of slack, because a rounded scrollHeight rarely lands exact.
        const element = event.currentTarget
        if (element.scrollHeight - element.scrollTop - element.clientHeight < 24) {
          pinned.current = true
        }
      }}
    >
      {loadMorePosition === 'start' ? (
        <>
          {sentinel}
          {busy}
        </>
      ) : null}
      {useVirtual ? (
        <ul
          ref={setList}
          className={cn('relative w-full', listClassName)}
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualItems.map((virtualRow) => {
            const item = items[virtualRow.index]
            if (!item) return null
            return (
              <li
                key={getKey(item)}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                {renderItem(item, virtualRow.index)}
              </li>
            )
          })}
        </ul>
      ) : (
        <ul ref={setList} className={cn('w-full', listClassName)}>
          {items.map((item, index) => (
            <li key={getKey(item)}>{renderItem(item, index)}</li>
          ))}
        </ul>
      )}
      {loadMorePosition === 'end' ? (
        <>
          {sentinel}
          {busy}
        </>
      ) : null}
    </div>
  )
}

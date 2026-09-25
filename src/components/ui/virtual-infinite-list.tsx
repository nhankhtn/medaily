'use client'

import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useState, useRef, type CSSProperties, type ReactNode } from 'react'
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
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  /** IntersectionObserver rootMargin before the sentinel. */
  loadMoreMargin?: string
  loadingMoreLabel?: ReactNode
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
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  loadMoreMargin = DEFAULT_LOAD_MARGIN,
  loadingMoreLabel,
  className,
  listClassName,
  empty,
}: VirtualInfiniteListProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const viewportHeight = estimateSize * maxVisibleRows.sm

  const shellStyle = {
    ['--vil-h']: `${(phoneEstimateSize ?? estimateSize) * maxVisibleRows.base}px`,
    ['--vil-h-sm']: `${viewportHeight}px`,
  } as CSSProperties

  const shellClass = cn(
    'max-h-[var(--vil-h)] overflow-y-auto sm:max-h-[var(--vil-h-sm)]',
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

  // Same empty shell on server and on the client's first paint.
  if (!mounted) {
    return (
      <div
        className={cn(shellClass, 'h-[var(--vil-h)] sm:h-[var(--vil-h-sm)]')}
        style={shellStyle}
        aria-hidden
      />
    )
  }

  const virtualItems = virtualizer.getVirtualItems()
  const useVirtual = virtualItems.length > 0

  return (
    <div ref={scrollRef} className={shellClass} style={shellStyle}>
      {useVirtual ? (
        <ul
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
        <ul className={cn('w-full', listClassName)}>
          {items.map((item, index) => (
            <li key={getKey(item)}>{renderItem(item, index)}</li>
          ))}
        </ul>
      )}
      <div ref={sentinelRef} className="h-1" aria-hidden />
      {loadingMore && loadingMoreLabel ? (
        <div className="text-text-subtle py-2 text-center text-xs">{loadingMoreLabel}</div>
      ) : null}
    </div>
  )
}

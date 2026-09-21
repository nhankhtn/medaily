'use client'

import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
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
 * Windowed list with optional infinite scroll. Owns scroll container,
 * virtualizer, and bottom sentinel — callers only render each row.
 */
export function VirtualInfiniteList<T>({
  items,
  getKey,
  renderItem,
  estimateSize = DEFAULT_ESTIMATE,
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

  // TanStack Virtual returns unstable function identities; React Compiler skips this component.
  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan,
  })

  useEffect(() => {
    if (!hasMore || !onLoadMore || loadingMore) return
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
  }, [hasMore, loadingMore, loadMoreMargin, onLoadMore, items.length])

  if (items.length === 0) {
    return empty ? <>{empty}</> : null
  }

  return (
    <div
      ref={scrollRef}
      className={cn(
        'max-h-[var(--vil-h)] overflow-y-auto sm:max-h-[var(--vil-h-sm)]',
        className,
      )}
      style={
        {
          contain: 'strict',
          ['--vil-h']: `${estimateSize * maxVisibleRows.base}px`,
          ['--vil-h-sm']: `${estimateSize * maxVisibleRows.sm}px`,
        } as CSSProperties
      }
    >
      <ul
        className={cn('relative w-full', listClassName)}
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
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
      <div ref={sentinelRef} className="h-1" aria-hidden />
      {loadingMore && loadingMoreLabel ? (
        <div className="text-text-subtle py-2 text-center text-xs">{loadingMoreLabel}</div>
      ) : null}
    </div>
  )
}

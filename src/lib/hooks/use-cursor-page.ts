'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type CursorPage<T> = {
  items: T[]
  nextCursor: string | null
}

export type CursorFetchResult<T> =
  | ({ ok: true } & CursorPage<T>)
  | { ok: false }

/**
 * Cursor-paged list state: replace on query change, append on load more,
 * and adopt an SSR first page when the query is idle.
 */
export function useCursorPage<T>({
  initialPage,
  /** Stable string for the active filter set; empty means “no filters”. */
  queryKey,
  fetchPage,
  getId,
}: {
  initialPage: CursorPage<T>
  queryKey: string
  fetchPage: (cursor: string | null) => Promise<CursorFetchResult<T>>
  getId: (item: T) => string
}) {
  const [items, setItems] = useState<T[]>(initialPage.items)
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage.nextCursor)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const skipFirstFetch = useRef(true)
  const loadMoreLock = useRef(false)
  const prevPageKey = useRef('')
  const pageKey = `${initialPage.nextCursor ?? ''}:${initialPage.items[0] ? getId(initialPage.items[0]) : ''}:${initialPage.items.length}:${initialPage.items.at(-1) ? getId(initialPage.items.at(-1)!) : ''}`
  const [seenPageKey, setSeenPageKey] = useState(pageKey)
  const [wasIdle, setWasIdle] = useState(true)

  const idle = queryKey === ''

  // Adopt SSR first page when filters are idle (React: adjust state during render).
  if (idle !== wasIdle) {
    setWasIdle(idle)
    if (idle) {
      setItems(initialPage.items)
      setNextCursor(initialPage.nextCursor)
      setSeenPageKey(pageKey)
    }
  } else if (idle && pageKey !== seenPageKey) {
    setSeenPageKey(pageKey)
    setItems(initialPage.items)
    setNextCursor(initialPage.nextCursor)
  }

  useEffect(() => {
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false
      if (idle) return
    }

    let cancelled = false
    setLoading(true)
    void fetchPage(null).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setItems(result.items)
        setNextCursor(result.nextCursor)
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [queryKey, idle, fetchPage])

  // While filters are active, a save/delete refreshes SSR — reload page one.
  useEffect(() => {
    if (idle) {
      prevPageKey.current = pageKey
      return
    }
    const bumped = prevPageKey.current !== pageKey
    prevPageKey.current = pageKey
    if (!bumped) return

    let cancelled = false
    void fetchPage(null).then((result) => {
      if (cancelled || !result.ok) return
      setItems(result.items)
      setNextCursor(result.nextCursor)
    })
    return () => {
      cancelled = true
    }
  }, [pageKey, idle, fetchPage])

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading || loadingMore || loadMoreLock.current) return
    loadMoreLock.current = true
    setLoadingMore(true)
    try {
      const result = await fetchPage(nextCursor)
      if (!result.ok) return
      setItems((current) => {
        const seen = new Set(current.map(getId))
        return [...current, ...result.items.filter((row) => !seen.has(getId(row)))]
      })
      setNextCursor(result.nextCursor)
    } finally {
      loadMoreLock.current = false
      setLoadingMore(false)
    }
  }, [fetchPage, getId, loading, loadingMore, nextCursor])

  const removeItem = useCallback(
    (id: string) => {
      setItems((current) => current.filter((row) => getId(row) !== id))
    },
    [getId],
  )

  return {
    items,
    setItems,
    nextCursor,
    loading,
    loadingMore,
    hasMore: Boolean(nextCursor),
    loadMore,
    removeItem,
  }
}

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
  const [loadingMore, setLoadingMore] = useState(false)
  const loadMoreLock = useRef(false)
  const prevPageKey = useRef('')
  const fetchPageRef = useRef(fetchPage)
  const getIdRef = useRef(getId)
  // Kept current from an effect rather than the render body, which would be a
  // write during render. Both are called from callbacks, never while rendering.
  useEffect(() => {
    fetchPageRef.current = fetchPage
    getIdRef.current = getId
  })

  const pageKey = `${initialPage.nextCursor ?? ''}:${initialPage.items[0] ? getId(initialPage.items[0]) : ''}:${initialPage.items.length}:${initialPage.items.at(-1) ? getId(initialPage.items.at(-1)!) : ''}`
  const [seenPageKey, setSeenPageKey] = useState(pageKey)
  const [wasIdle, setWasIdle] = useState(true)

  const idle = queryKey === ''

  /*
   * Derived rather than a flag set when the fetch starts. An effect cannot set
   * state synchronously, and the flag was a render behind anyway: the query had
   * already changed while `loading` still said false, so the list showed the
   * old filter's rows as though they were the answer.
   */
  // Starts empty, not at `queryKey`: seeding it with the key would claim that
  // key had already been loaded before anything loaded it, so a caller that
  // mounts with filters already set would show no loading state at all. Empty
  // is safe for the idle case, which `!idle` answers first anyway.
  const [loadedKey, setLoadedKey] = useState('')
  const loading = !idle && loadedKey !== queryKey

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

  // Only refetch when the filter key changes — not when fetchPage identity churns.
  useEffect(() => {
    if (idle) return

    let cancelled = false
    void fetchPageRef.current(null).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setItems(result.items)
        setNextCursor(result.nextCursor)
      }
      setLoadedKey(queryKey)
    })

    return () => {
      cancelled = true
    }
  }, [queryKey, idle])

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
    void fetchPageRef.current(null).then((result) => {
      if (cancelled || !result.ok) return
      setItems(result.items)
      setNextCursor(result.nextCursor)
    })
    return () => {
      cancelled = true
    }
  }, [pageKey, idle])

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading || loadingMore || loadMoreLock.current) return
    loadMoreLock.current = true
    setLoadingMore(true)
    try {
      const result = await fetchPageRef.current(nextCursor)
      if (!result.ok) return
      const idOf = getIdRef.current
      setItems((current) => {
        const seen = new Set(current.map(idOf))
        return [...current, ...result.items.filter((row) => !seen.has(idOf(row)))]
      })
      setNextCursor(result.nextCursor)
    } finally {
      loadMoreLock.current = false
      setLoadingMore(false)
    }
  }, [loading, loadingMore, nextCursor])

  const removeItem = useCallback((id: string) => {
    const idOf = getIdRef.current
    setItems((current) => current.filter((row) => idOf(row) !== id))
  }, [])

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

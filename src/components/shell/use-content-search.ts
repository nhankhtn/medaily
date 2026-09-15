'use client'

import { useEffect, useState } from 'react'
import { MIN_QUERY_LENGTH } from '@/lib/search'
import { searchContent } from '@/server/actions/search'
import type { SearchHit } from '@/server/repositories/search'

/** Long enough that typing a word does not fire a query per letter. */
const DEBOUNCE_MS = 220

type Result = { query: string; hits: SearchHit[] }

/**
 * Content search for the command palette, debounced.
 *
 * The result carries the query it belongs to, so `searching` is derived rather
 * than stored: the moment what you typed differs from what the result answers,
 * the palette is waiting. That also makes a slow reply for an old query
 * harmless — it can never be shown under a newer one.
 */
export function useContentSearch(query: string, enabled: boolean) {
  const trimmed = query.trim()
  const eligible = enabled && trimmed.length >= MIN_QUERY_LENGTH
  const [result, setResult] = useState<Result>({ query: '', hits: [] })

  useEffect(() => {
    if (!eligible) return

    let cancelled = false
    const timer = setTimeout(async () => {
      const hits = await searchContent(trimmed).catch(() => [])
      if (!cancelled) setResult({ query: trimmed, hits })
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmed, eligible])

  const answered = result.query === trimmed

  return {
    hits: eligible && answered ? result.hits : [],
    searching: eligible && !answered,
    eligible,
  }
}

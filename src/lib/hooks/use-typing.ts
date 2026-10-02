'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { pickTypingChannel } from '@/lib/realtime/provider'
import type { TypingChannel } from '@/lib/realtime/signal'
import {
  activeTypists,
  shouldAnnounce,
  TYPING_TTL_MS,
  type TypingEntry,
} from '@/lib/realtime/typing'

/** How often the list is re-checked for claims that have gone stale. */
const SWEEP_MS = 1_000

/**
 * Returns Firebase uids; the caller holds the roster that turns them into
 * names. Two clocks, because a claim *expiring* fires no snapshot — without
 * the sweep the last person to stop would type forever.
 */
export function useTyping(channel: string | null, me: string | null) {
  const [entries, setEntries] = useState<TypingEntry[]>([])
  const [typists, setTypists] = useState<string[]>([])

  const transport = useRef<TypingChannel | null>(null)
  const lastAnnounced = useRef<number | null>(null)

  useEffect(() => {
    if (!channel) return

    let stopped = false
    let stopWatching: (() => void) | null = null

    void pickTypingChannel().then((picked) => {
      if (stopped) return
      transport.current = picked
      stopWatching = picked.watch(channel, setEntries)
    })

    return () => {
      stopped = true
      // Best effort: a closed tab has no time for a round trip, which is what
      // the TTL is for. Navigating away does.
      if (lastAnnounced.current !== null) void transport.current?.retract(channel).catch(() => {})
      transport.current = null
      lastAnnounced.current = null
      stopWatching?.()
      setEntries([])
    }
  }, [channel])

  // On a timer too: "nobody is typing any more" has no arrival to hang off.
  useEffect(() => {
    const recompute = () => setTypists(activeTypists(entries, Date.now(), me))
    recompute()
    const sweep = setInterval(recompute, SWEEP_MS)
    return () => clearInterval(sweep)
  }, [entries, me])

  /** Throttled here, not by the caller: every announcement is a write. */
  const announce = useCallback(() => {
    if (!channel) return
    const now = Date.now()
    if (!shouldAnnounce(lastAnnounced.current, now)) return

    lastAnnounced.current = now
    // Silent: not being seen to type is smaller than a toast about it.
    void transport.current?.announce(channel).catch(() => {})
  }, [channel])

  /**
   * A real retraction, not just forgetting `lastAnnounced`: otherwise the other
   * screen keeps the name up beside the message that already arrived.
   */
  const stop = useCallback(() => {
    if (!channel) return
    lastAnnounced.current = null
    void transport.current?.retract(channel).catch(() => {})
  }, [channel])

  return { typists, announce, stop, ttlMs: TYPING_TTL_MS }
}

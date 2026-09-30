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
 * Who else is typing in this room, and how to say that you are.
 *
 * Returns Firebase uids rather than names. The caller is the one holding the
 * room's speakers, and a hook that resolved names would need the roster passed
 * in only to hand it straight back.
 *
 * Two clocks, not one. Claims arrive on a snapshot, but a claim *expiring* is
 * the passage of time and fires no event — without the sweep, the last person
 * to stop typing would appear to be typing until somebody else started.
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
      // Best effort — closing a tab gives no time for a round trip, which is
      // what the TTL is ultimately for. Navigating away does have time.
      if (lastAnnounced.current !== null) void transport.current?.retract(channel).catch(() => {})
      transport.current = null
      lastAnnounced.current = null
      stopWatching?.()
      setEntries([])
    }
  }, [channel])

  // Re-derived on a timer as well as on arrival, because the interesting
  // transition — nobody is typing any more — has no arrival to hang off.
  useEffect(() => {
    const recompute = () => setTypists(activeTypists(entries, Date.now(), me))
    recompute()
    const sweep = setInterval(recompute, SWEEP_MS)
    return () => clearInterval(sweep)
  }, [entries, me])

  /**
   * Called on every keystroke and throttled here rather than by the caller:
   * every announcement is a Firestore write, and the caller has no reason to
   * know that.
   */
  const announce = useCallback(() => {
    if (!channel) return
    const now = Date.now()
    if (!shouldAnnounce(lastAnnounced.current, now)) return

    lastAnnounced.current = now
    // Failure is silent and deliberate: not being seen to type is a smaller
    // problem than a toast about it.
    void transport.current?.announce(channel).catch(() => {})
  }, [channel])

  /**
   * Sending a message takes the claim back at once.
   *
   * Not just forgetting `lastAnnounced` — that would only let the next
   * keystroke announce sooner, while the other screen kept the name up for the
   * rest of the TTL, next to the message that had already arrived.
   */
  const stop = useCallback(() => {
    if (!channel) return
    lastAnnounced.current = null
    void transport.current?.retract(channel).catch(() => {})
  }, [channel])

  return { typists, announce, stop, ttlMs: TYPING_TTL_MS }
}

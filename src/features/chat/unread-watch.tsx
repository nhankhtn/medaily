'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { pickRealtimeSignal } from '@/lib/realtime/provider'

/** Several rooms can ring at once; one refresh answers all of them. */
const SETTLE_MS = 800

/**
 * The same floor the room has: without it, the password path — which has no
 * Firebase session — would show a number that never changed.
 */
const FLOOR_MS = 60_000

/**
 * Stretched, not skipped, for a hidden tab: the tab title exists precisely for
 * the window nobody is looking at, so "never" left it with no fallback. Twenty
 * asks an hour instead of sixty.
 */
const HIDDEN_FLOOR_MS = 180_000

/** Whether enough has passed to ask again, given where the tab is. */
export function floorDue({ hidden, since }: { hidden: boolean; since: number }): boolean {
  return since >= (hidden ? HIDDEN_FLOOR_MS : FLOOR_MS)
}

/**
 * Listens to every room's doorbell rather than a channel of its own: a
 * per-person channel would have to be rung by the sender, who would then need
 * everybody else's key — and a key other people hold is not a key.
 *
 * A ring only asks the route to render again, so this costs no extra writes.
 */
export function UnreadWatch({ channels }: { channels: string[] }) {
  const router = useRouter()
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Joined into a string so the effect compares what it is listening to rather
  // than the identity of the array the server handed it.
  const key = channels.join(',')

  useEffect(() => {
    const rooms = key === '' ? [] : key.split(',')

    let stopped = false
    const stops: (() => void)[] = []

    // Every path that asks goes through here, so the floor measures time since
    // the last answer rather than since the last tick — a doorbell that just
    // rang should not be followed by a poll a second later.
    let asked = Date.now()
    const refresh = () => {
      asked = Date.now()
      router.refresh()
    }

    const ask = () => {
      if (settle.current) clearTimeout(settle.current)
      settle.current = setTimeout(refresh, SETTLE_MS)
    }

    void pickRealtimeSignal().then((signal) => {
      if (stopped) return
      for (const room of rooms) stops.push(signal.listen(room, ask))
    })

    const floor = setInterval(() => {
      const hidden = document.visibilityState !== 'visible'
      if (floorDue({ hidden, since: Date.now() - asked })) refresh()
    }, FLOOR_MS)

    // Coming back to the tab is the most common way to have missed something.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      stopped = true
      if (settle.current) clearTimeout(settle.current)
      clearInterval(floor)
      document.removeEventListener('visibilitychange', onVisible)
      for (const stop of stops) stop()
    }
  }, [key, router])

  return null
}

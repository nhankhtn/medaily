'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { pickRealtimeSignal } from '@/lib/realtime/provider'

/** Several rooms can ring at once; one refresh answers all of them. */
const SETTLE_MS = 800

/**
 * How long the badge waits before asking anyway.
 *
 * The same floor the room itself has, and for the same reason: the doorbell is
 * an optimisation. Without it, anybody signed in with a password — who has no
 * Firebase session to listen with — would have a number that never changed
 * until they navigated, which is indistinguishable from a broken count.
 */
const FLOOR_MS = 60_000

/**
 * The same floor for a tab nobody is looking at, stretched.
 *
 * This used to be "never": the floor checked for a visible tab and did nothing
 * otherwise, which is the right instinct — a forgotten tab polling every
 * minute for the rest of the day is a cost nobody agreed to. But the tab title
 * exists precisely for the window somebody is *not* looking at, so skipping it
 * there left the one feature that needs it with no fallback at all, depending
 * entirely on the doorbell.
 *
 * Three minutes is the compromise: a tab left open overnight asks twenty times
 * an hour instead of sixty, and somebody who looks across at it after a few
 * minutes away sees the right thing even where Firestore never reached them.
 */
const HIDDEN_FLOOR_MS = 180_000

/** Whether enough has passed to ask again, given where the tab is. */
export function floorDue({ hidden, since }: { hidden: boolean; since: number }): boolean {
  return since >= (hidden ? HIDDEN_FLOOR_MS : FLOOR_MS)
}

/**
 * Keeps the unread badge current without anybody reloading.
 *
 * It listens to the doorbell of every room this person is in, rather than to a
 * channel of their own. A per-person channel would mean one listener instead
 * of a handful, but somebody would have to ring it for them — and the only
 * client that knows a message was sent is the sender's, which would then need
 * everybody else's key. A key that other people hold is not a key.
 *
 * Counting is the server's job, so a ring only asks the route to render again.
 * Nothing about what changed travels here, which is also why it costs no extra
 * Firestore writes: these are the same channels the rooms already ring.
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

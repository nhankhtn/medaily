'use client'

import { useCallback, useEffect, useRef } from 'react'
import { pickRealtimeSignal } from '@/lib/realtime/provider'
import type { RealtimeSignal } from '@/lib/realtime/signal'

/** Rings arrive in bursts while somebody types; one ask covers the burst. */
const DEBOUNCE_MS = 400

/**
 * How long a room waits before asking anyway.
 *
 * This is the floor that makes the doorbell an optimisation rather than a
 * dependency. Without it, a sender whose browser died between saving the
 * message and ringing would leave everyone else looking at a stale screen for
 * as long as they kept it open.
 */
const FLOOR_MS = 45_000

/**
 * Watches one room and calls back when there may be something new.
 *
 * `onRing` is never told *what* changed — the caller asks the server, which is
 * the only thing that knows who may see what. That is also why a poisoned or
 * forged payload cannot do anything here: nothing reads it.
 */
export function useRoomLive(channel: string | null, onRing: () => void) {
  // Kept current from an effect rather than from the render body, which would
  // be a write during render — the same shape `one-tap.tsx` uses next door.
  const latest = useRef(onRing)
  useEffect(() => {
    latest.current = onRing
  })

  const ask = useCallback(() => latest.current(), [])

  useEffect(() => {
    if (!channel) return

    let stopped = false
    let stopListening: (() => void) | null = null
    let debounce: ReturnType<typeof setTimeout> | null = null

    const ring = () => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(ask, DEBOUNCE_MS)
    }

    void pickRealtimeSignal().then((signal: RealtimeSignal) => {
      if (stopped) return
      stopListening = signal.listen(channel, ring)
    })

    const floor = setInterval(() => {
      if (document.visibilityState === 'visible') ask()
    }, FLOOR_MS)

    // Coming back to the tab is the most common way to have missed something.
    const onVisible = () => {
      if (document.visibilityState === 'visible') ask()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      stopped = true
      if (debounce) clearTimeout(debounce)
      clearInterval(floor)
      document.removeEventListener('visibilitychange', onVisible)
      stopListening?.()
    }
  }, [channel, ask])
}

/** Tells the room something happened. Failure is silent: the floor covers it. */
export async function ringRoom(channel: string | null): Promise<void> {
  if (!channel) return
  try {
    const signal = await pickRealtimeSignal()
    await signal.ring(channel)
  } catch {
    /* Offline or refused. Everyone else finds out on the slow timer. */
  }
}

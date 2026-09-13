'use client'

import { useEffect, useSyncExternalStore } from 'react'
import type { RunningTimer } from '@/server/services/timer'

const subscribeToSecond = (onTick: () => void) => {
  const id = setInterval(onTick, 1000)
  return () => clearInterval(id)
}

const subscribeToNothing = () => () => {}

/**
 * Seconds on the clock, ticking once a second while the run is going.
 *
 * The server value is the authority at every render, and the client only counts
 * on from the start of the current stretch between them. It can never read
 * lower than what the server said, so a device whose clock lags cannot make a
 * run appear to go backwards.
 */
export function useElapsedSeconds(timer: RunningTimer | null): number {
  const running = timer !== null && timer.pausedAt === null
  const nowSeconds = useSyncExternalStore(
    running ? subscribeToSecond : subscribeToNothing,
    () => Math.floor(Date.now() / 1000),
    () => null,
  )

  if (!timer) return 0
  if (!running || nowSeconds === null) return timer.elapsedSeconds

  const startedAt = Math.floor(new Date(timer.startedAt).getTime() / 1000)
  return Math.max(timer.elapsedSeconds, timer.accumulatedSeconds + (nowSeconds - startedAt))
}

/**
 * The wall clock, to the second. The server snapshot is null, so the first
 * paint has no time in it to disagree with the client's.
 */
export function useNow(): Date | null {
  const millis = useSyncExternalStore(
    subscribeToSecond,
    () => Math.floor(Date.now() / 1000) * 1000,
    () => null,
  )

  return millis === null ? null : new Date(millis)
}

/** Keeps the screen awake while a run is going; a workout is not a reason to tap. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let released = false

    const request = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen')
      } catch {
        // Denied, or the tab is hidden. Nothing to do; the timer is server-side.
      }
    }

    // A hidden tab drops the lock, so take it again when the user comes back.
    const onVisible = () => {
      if (!released && document.visibilityState === 'visible') void request()
    }

    void request()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release().catch(() => {})
    }
  }, [active])
}

/** A short two-tone chime, synthesised so there is no asset to ship. */
export function chime(): void {
  try {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const context = new Ctor()

    for (const [index, frequency] of [880, 1320].entries()) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const at = context.currentTime + index * 0.18

      oscillator.frequency.value = frequency
      oscillator.connect(gain)
      gain.connect(context.destination)
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.2, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16)
      oscillator.start(at)
      oscillator.stop(at + 0.18)
    }

    setTimeout(() => void context.close().catch(() => {}), 800)
  } catch {
    // No audio available; the visual state still says the countdown is done.
  }
}

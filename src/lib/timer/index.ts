/** A run in flight, as the database stores it. */
export type TimerRun = {
  startedAt: Date
  pausedAt: Date | null
  accumulatedSeconds: number
}

export const TIMER_PRESETS_MINUTES = [15, 25, 45, 60] as const

/** A run left going overnight is a forgotten run, not a 14-hour day. */
export const MAX_RUN_SECONDS = 8 * 60 * 60

export const isPaused = (run: TimerRun): boolean => run.pausedAt !== null

/** Seconds on the clock: banked stretches plus the one still running. */
export function elapsedSeconds(run: TimerRun, now: Date = new Date()): number {
  const current = run.pausedAt
    ? 0
    : Math.floor((now.getTime() - run.startedAt.getTime()) / 1000)
  return Math.max(0, run.accumulatedSeconds + Math.max(0, current))
}

/** What is left of a countdown; negative once it has overrun. */
export function remainingSeconds(
  run: TimerRun,
  targetSeconds: number,
  now: Date = new Date(),
): number {
  return targetSeconds - elapsedSeconds(run, now)
}

/** Banks the running stretch and stops the clock. */
export function pausedRun(run: TimerRun, now: Date = new Date()): TimerRun {
  if (run.pausedAt) return run
  return { startedAt: run.startedAt, pausedAt: now, accumulatedSeconds: elapsedSeconds(run, now) }
}

/** Starts a fresh stretch from now, keeping what was banked. */
export function resumedRun(run: TimerRun, now: Date = new Date()): TimerRun {
  if (!run.pausedAt) return run
  return { startedAt: now, pausedAt: null, accumulatedSeconds: run.accumulatedSeconds }
}

/**
 * What a run is worth once stopped. Under a minute is not a session — the
 * modules that receive it store whole minutes and refuse a zero.
 */
export function minutesOf(seconds: number): number {
  const capped = Math.min(Math.max(0, seconds), MAX_RUN_SECONDS)
  return Math.round(capped / 60)
}

export const wasCapped = (seconds: number): boolean => seconds > MAX_RUN_SECONDS

/** `h:mm:ss` once past an hour, `mm:ss` below it, with a sign for an overrun. */
export function formatDuration(seconds: number): string {
  const sign = seconds < 0 ? '-' : ''
  const total = Math.abs(Math.trunc(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60

  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0
    ? `${sign}${hours}:${pad(minutes)}:${pad(rest)}`
    : `${sign}${pad(minutes)}:${pad(rest)}`
}

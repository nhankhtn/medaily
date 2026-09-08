import type { ISODate } from '@/lib/dates'

export type DayStatus = 'hit' | 'miss' | 'pending' | 'not_scheduled'

export type StreakDay = { date: ISODate; status: DayStatus }

export type StreakResult = {
  current: number
  best: number
  /** True when today is still unlogged: the streak is displayed, not broken. */
  pendingToday: boolean
  /** True when a grace freeze is currently holding the streak together. */
  frozen: boolean
  /** Date the current streak started, for "since …" copy. */
  startedOn: ISODate | null
}

const FREEZE_WINDOW_DAYS = 7

/**
 * Spec 20.3. Days must be ordered oldest → newest and include every scheduled
 * day in the window; `not_scheduled` days are skipped entirely so a
 * three-times-a-week habit is never punished for its off days.
 *
 * Grace rule (default on): one miss inside a rolling 7-day window pauses the
 * streak instead of breaking it. Two consecutive misses always break it.
 */
export function computeStreak(days: StreakDay[], graceEnabled = true): StreakResult {
  const relevant = days.filter((d) => d.status !== 'not_scheduled')
  const pendingToday = relevant.at(-1)?.status === 'pending'

  const current = walkCurrent(relevant, graceEnabled)
  const best = walkBest(relevant, graceEnabled)

  return {
    current: current.length,
    best: Math.max(best, current.length),
    pendingToday,
    frozen: current.frozen,
    startedOn: current.startedOn,
  }
}

function walkCurrent(
  days: StreakDay[],
  graceEnabled: boolean,
): { length: number; frozen: boolean; startedOn: ISODate | null } {
  let length = 0
  let frozen = false
  let startedOn: ISODate | null = null
  let freezeUsedIndex: number | null = null
  let previousWasMiss = false

  // Walk newest → oldest; `pending` (today, unlogged) never breaks a streak.
  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i]
    if (!day) break

    if (day.status === 'pending') {
      previousWasMiss = false
      continue
    }

    if (day.status === 'hit') {
      length += 1
      startedOn = day.date
      previousWasMiss = false
      continue
    }

    // miss
    if (!graceEnabled) break
    if (previousWasMiss) break
    if (freezeUsedIndex !== null && freezeUsedIndex - i < FREEZE_WINDOW_DAYS) break

    freezeUsedIndex = i
    frozen = true
    previousWasMiss = true
  }

  return { length, frozen, startedOn }
}

function walkBest(days: StreakDay[], graceEnabled: boolean): number {
  let best = 0
  let run = 0
  let freezeUsedIndex: number | null = null
  let previousWasMiss = false

  for (let i = 0; i < days.length; i++) {
    const day = days[i]
    if (!day) continue

    if (day.status === 'pending') {
      previousWasMiss = false
      continue
    }

    if (day.status === 'hit') {
      run += 1
      best = Math.max(best, run)
      previousWasMiss = false
      continue
    }

    const canFreeze =
      graceEnabled &&
      !previousWasMiss &&
      (freezeUsedIndex === null || i - freezeUsedIndex >= FREEZE_WINDOW_DAYS)

    if (canFreeze) {
      freezeUsedIndex = i
      previousWasMiss = true
    } else {
      run = 0
      freezeUsedIndex = null
      previousWasMiss = false
    }
  }

  return best
}

/** Streak hit conditions for the built-in metric streaks (spec 20.3). */
export type StreakKind = 'logging' | 'study' | 'deep_work' | 'exercise' | 'reading'

export type StreakSourceDay = {
  date: ISODate
  logged: boolean
  studyMinutes: number | null
  deepWorkMinutes: number | null
  exerciseMinutes: number | null
  readingMinutes: number | null
}

export function statusFor(
  kind: StreakKind,
  day: StreakSourceDay,
  thresholds: { studyMinutes: number; deepWorkMinutes: number; readingMinutes: number },
  isToday: boolean,
): DayStatus {
  if (!day.logged) return isToday ? 'pending' : 'miss'

  const hit = (() => {
    switch (kind) {
      case 'logging':
        return true
      case 'study':
        return (day.studyMinutes ?? 0) >= thresholds.studyMinutes
      case 'deep_work':
        return (day.deepWorkMinutes ?? 0) >= thresholds.deepWorkMinutes
      case 'exercise':
        return (day.exerciseMinutes ?? 0) > 0
      case 'reading':
        return (day.readingMinutes ?? 0) >= thresholds.readingMinutes
    }
  })()

  if (hit) return 'hit'
  // A logged day that misses the bar today is still open until the day ends.
  return isToday ? 'pending' : 'miss'
}

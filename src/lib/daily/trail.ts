import { addDays, eachDay, type ISODate } from '@/lib/dates'
import { computeStreak, type StreakResult } from '@/lib/streaks'

export type TrailState = 'logged' | 'missed' | 'frozen' | 'pending'

export type TrailDay = { date: ISODate; state: TrailState }

export type LoggingStreak = Pick<StreakResult, 'current' | 'best' | 'frozen' | 'pendingToday'> & {
  /** The last `trailDays` days, oldest first, ending today. */
  trail: TrailDay[]
}

/**
 * The logging streak and the strip of recent days the daily page draws under
 * its date picker, from one list of logged dates.
 *
 * A missed day inside the current streak is the one the grace rule held, so it
 * is drawn as frozen rather than missed — the strip and the number agree.
 */
export function loggingStreak({
  logged,
  start,
  today,
  graceEnabled,
  trailDays = 7,
}: {
  logged: ReadonlySet<ISODate>
  start: ISODate
  today: ISODate
  graceEnabled: boolean
  trailDays?: number
}): LoggingStreak {
  const days = eachDay({ start, end: today }).map((date) => ({
    date,
    status: logged.has(date)
      ? ('hit' as const)
      : date === today
        ? ('pending' as const)
        : ('miss' as const),
  }))
  const streak = computeStreak(days, graceEnabled)

  const trail = eachDay({ start: addDays(today, -(trailDays - 1)), end: today }).map(
    (date): TrailDay => {
      if (logged.has(date)) return { date, state: 'logged' }
      if (date === today) return { date, state: 'pending' }
      const held = streak.startedOn !== null && date > streak.startedOn
      return { date, state: held ? 'frozen' : 'missed' }
    },
  )

  return {
    current: streak.current,
    best: streak.best,
    frozen: streak.frozen,
    pendingToday: streak.pendingToday,
    trail,
  }
}

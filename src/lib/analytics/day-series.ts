import { addDays, eachDay, type DateRange, type ISODate } from '@/lib/dates'
import { computeCompletion, isScheduledOn, type HabitSchedule } from '@/lib/habits/schedule'
import { computeDayScore, type DayScore } from '@/lib/scoring'
import type { EffectiveDailyLog, ScoreTargets, ScoreWeights } from '@/lib/types'

export type SeriesHabit = HabitSchedule & { id: string; name: string }

export type DaySeriesEntry = {
  date: ISODate
  log: EffectiveDailyLog | null
  logged: boolean
  score: DayScore | null
  habitsScheduled: number
  habitsCompleted: number
  exerciseDaysLast7: number
  /** Study and deep work after session precedence, in minutes. */
  studyMinutes: number | null
  deepWorkMinutes: number | null
  focusMinutes: number | null
}

/**
 * One pass over a date range that resolves everything the dashboard, analytics
 * and insight rules read: the day's log, its habit obligations, and its score.
 * Building this once avoids every caller re-deriving the same numbers.
 */
export function buildDaySeries({
  range,
  logs,
  habits,
  habitCounts,
  weights,
  targets,
}: {
  range: DateRange
  logs: EffectiveDailyLog[]
  habits: SeriesHabit[]
  /** habitId → (date → count) */
  habitCounts: Map<string, Map<ISODate, number>>
  /** Accepted for call-site symmetry; weekly habits are scored by `weeklyHabitCompletion`. */
  weekStart?: 'monday' | 'sunday'
  weights: ScoreWeights
  targets: ScoreTargets
}): DaySeriesEntry[] {
  const logByDate = new Map(logs.map((log) => [log.logDate, log]))
  const dates = eachDay(range)

  // Trailing exercise-day count, for rest-day credit (spec 19.2).
  const exerciseDays = new Map<ISODate, number>()
  for (const date of dates) {
    let count = 0
    for (let back = 1; back <= 7; back++) {
      const previous = logByDate.get(addDays(date, -back))
      if ((previous?.exerciseMinutes ?? 0) > 0) count += 1
    }
    exerciseDays.set(date, count)
  }

  return dates.map((date) => {
    const log = logByDate.get(date) ?? null
    const studyMinutes = log ? log.effectiveStudyMinutes : null
    const deepWorkMinutes = log ? log.effectiveDeepWorkMinutes : null

    let scheduled = 0
    let completed = 0
    for (const habit of habits) {
      if (!isScheduledOn(habit, date)) continue
      if (habit.frequencyType === 'weekly') {
        // A weekly habit is one obligation per week, evaluated over its week —
        // counting it every day would drown the daily habits component.
        continue
      }
      scheduled += 1
      const count = habitCounts.get(habit.id)?.get(date) ?? 0
      if (count >= habit.targetCount) completed += 1
    }

    const score = log
      ? computeDayScore(
          {
            studyMinutes,
            deepWorkMinutes,
            sleepHours: log.sleepHours,
            exerciseMinutes: log.exerciseMinutes,
            readingMinutes: log.readingMinutes,
            entertainmentMinutes: log.entertainmentMinutes,
            habitsScheduled: scheduled > 0 ? scheduled : null,
            habitsCompleted: scheduled > 0 ? completed : null,
            exerciseDaysLast7: exerciseDays.get(date) ?? 0,
          },
          weights,
          targets,
        )
      : null

    return {
      date,
      log,
      logged: log !== null,
      score,
      habitsScheduled: scheduled,
      habitsCompleted: completed,
      exerciseDaysLast7: exerciseDays.get(date) ?? 0,
      studyMinutes,
      deepWorkMinutes,
      focusMinutes:
        studyMinutes === null && deepWorkMinutes === null
          ? null
          : (studyMinutes ?? 0) + (deepWorkMinutes ?? 0),
    }
  })
}

/** Weekly habits are scored over their own period, not per day. */
export function weeklyHabitCompletion(
  habits: SeriesHabit[],
  range: DateRange,
  habitCounts: Map<string, Map<ISODate, number>>,
  weekStart: 'monday' | 'sunday',
) {
  return habits
    .filter((habit) => habit.frequencyType === 'weekly')
    .map((habit) => ({
      habit,
      completion: computeCompletion(
        habit,
        range,
        habitCounts.get(habit.id) ?? new Map(),
        weekStart,
      ),
    }))
}

export type Totals = {
  daysLogged: number
  avgEnergy: number | null
  avgMood: number | null
  avgSleepHours: number | null
  totalStudyMinutes: number
  totalDeepWorkMinutes: number
  totalReadingMinutes: number
  totalEntertainmentMinutes: number
  totalExerciseMinutes: number
  exerciseDays: number
  habitsScheduled: number
  habitsCompleted: number
}

export function totalsOf(series: DaySeriesEntry[]): Totals {
  const logged = series.filter((entry) => entry.logged)
  const avg = (values: (number | null)[]) => {
    const present = values.filter((v): v is number => v !== null)
    return present.length ? present.reduce((a, b) => a + b, 0) / present.length : null
  }

  return {
    daysLogged: logged.length,
    avgEnergy: avg(logged.map((e) => e.log?.energy ?? null)),
    avgMood: avg(logged.map((e) => e.log?.mood ?? null)),
    avgSleepHours: avg(logged.map((e) => e.log?.sleepHours ?? null)),
    totalStudyMinutes: logged.reduce((sum, e) => sum + (e.studyMinutes ?? 0), 0),
    totalDeepWorkMinutes: logged.reduce((sum, e) => sum + (e.deepWorkMinutes ?? 0), 0),
    totalReadingMinutes: logged.reduce((sum, e) => sum + (e.log?.readingMinutes ?? 0), 0),
    totalEntertainmentMinutes: logged.reduce(
      (sum, e) => sum + (e.log?.entertainmentMinutes ?? 0),
      0,
    ),
    totalExerciseMinutes: logged.reduce((sum, e) => sum + (e.log?.exerciseMinutes ?? 0), 0),
    exerciseDays: logged.filter((e) => (e.log?.exerciseMinutes ?? 0) > 0).length,
    habitsScheduled: series.reduce((sum, e) => sum + e.habitsScheduled, 0),
    habitsCompleted: series.reduce((sum, e) => sum + e.habitsCompleted, 0),
  }
}

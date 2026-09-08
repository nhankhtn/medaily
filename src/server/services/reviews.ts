import { cache } from 'react'
import { buildDaySeries, totalsOf, type DaySeriesEntry } from '@/lib/analytics/day-series'
import {
  addDays,
  addMonthsISO,
  eachDay,
  monthEndOf,
  monthStartOf,
  today as todayOf,
  weekStartOf,
  yearOf,
  type DateRange,
  type ISODate,
} from '@/lib/dates'
import { WEEK_SCORE_MIN_COVERAGE } from '@/lib/defaults'
import { computePeriodScore } from '@/lib/scoring'
import type { ReviewMetricsSnapshot } from '@/lib/types'
import { findEffectiveRange } from '@/server/repositories/daily'
import { findHabitLogsInRange, findHabits } from '@/server/repositories/habits'
import { findRecentReviews, findReview, type ReviewPeriod, type ReviewRow } from '@/server/repositories/reviews'
import { dayContextOf, getSettings } from '@/server/services/settings'

export const SNAPSHOT_VERSION = 1

export type ReviewView = {
  period: ReviewPeriod
  key: string
  range: DateRange
  label: string
  /** Live numbers while the review is a draft; the frozen snapshot once finalized. */
  metrics: ReviewMetricsSnapshot
  live: ReviewMetricsSnapshot
  finalized: boolean
  row: ReviewRow | null
  /** Seeds for the written fields, quoted from the period's own daily entries. */
  suggestedWins: string[]
  suggestedProblems: string[]
  previousPriority: string | null
  previousKey: string
  nextKey: string | null
}

export function rangeOf(period: ReviewPeriod, key: string): DateRange {
  if (period === 'weekly') return { start: key, end: addDays(key, 6) }
  if (period === 'monthly') return { start: key, end: monthEndOf(key) }
  const year = Number(key)
  return { start: `${year}-01-01`, end: `${year}-12-31` }
}

export function currentKey(period: ReviewPeriod, date: ISODate, weekStart: 'monday' | 'sunday') {
  if (period === 'weekly') return weekStartOf(date, weekStart)
  if (period === 'monthly') return monthStartOf(date)
  return String(yearOf(date))
}

export function previousKey(period: ReviewPeriod, key: string): string {
  if (period === 'weekly') return addDays(key, -7)
  if (period === 'monthly') return addMonthsISO(key, -1)
  return String(Number(key) - 1)
}

export function nextKeyOf(period: ReviewPeriod, key: string, latest: string): string | null {
  const next =
    period === 'weekly' ? addDays(key, 7) : period === 'monthly' ? addMonthsISO(key, 1) : String(Number(key) + 1)
  return next > latest ? null : next
}

/**
 * Spec 17.3 — a draft recomputes from raw logs every time it is opened, and
 * finalizing freezes the numbers so a review read a year later still shows what
 * it showed then.
 */
export const getReviewView = cache(async (
  period: ReviewPeriod,
  requestedKey?: string,
): Promise<ReviewView> => {
  const settings = await getSettings()
  const today = todayOf(dayContextOf(settings))
  const latestKey = currentKey(period, today, settings.weekStart)
  const key = requestedKey ?? currentKey(period, previousPeriodDate(period, today), settings.weekStart)

  const range = rangeOf(period, key)
  const [row, live] = await Promise.all([
    findReview(settings.userId, period, key),
    computeMetrics(range, today),
  ])

  const seeds = await collectSeeds(range)

  const previous = previousKey(period, key)
  const previousRow = await findReview(settings.userId, period, previous)

  return {
    period,
    key,
    range,
    label: key,
    metrics: row?.finalizedAt && row.metricsSnapshot ? row.metricsSnapshot : live,
    live,
    finalized: Boolean(row?.finalizedAt),
    row,
    suggestedWins: seeds.wins,
    suggestedProblems: seeds.problems,
    previousPriority: previousRow?.topPriority ?? null,
    previousKey: previous,
    nextKey: nextKeyOf(period, key, latestKey),
  }
})

function previousPeriodDate(period: ReviewPeriod, today: ISODate): ISODate {
  if (period === 'weekly') return addDays(today, -7)
  if (period === 'monthly') return addMonthsISO(today, -1)
  return addDays(today, -365)
}

export const getReviewList = cache(async (period: ReviewPeriod) => {
  const settings = await getSettings()
  return findRecentReviews(settings.userId, period)
})

async function buildSeries(range: DateRange): Promise<DaySeriesEntry[]> {
  const settings = await getSettings()

  const [logs, habitRows, habitLogRows] = await Promise.all([
    findEffectiveRange(settings.userId, range),
    findHabits(settings.userId),
    findHabitLogsInRange(settings.userId, range),
  ])

  const habitCounts = new Map<string, Map<ISODate, number>>()
  for (const log of habitLogRows) {
    const perHabit = habitCounts.get(log.habitId) ?? new Map<ISODate, number>()
    perHabit.set(log.logDate, (perHabit.get(log.logDate) ?? 0) + log.count)
    habitCounts.set(log.habitId, perHabit)
  }

  return buildDaySeries({
    range,
    logs,
    habits: habitRows.map((habit) => ({
      id: habit.id,
      name: habit.name,
      frequencyType: habit.frequencyType,
      targetCount: habit.targetCount,
      weekdays: habit.weekdays ?? null,
      intervalDays: habit.intervalDays ?? null,
      startDate: habit.startDate,
      endDate: habit.endDate,
    })),
    habitCounts,
    weights: settings.scoreWeights,
    targets: settings.scoreTargets,
  })
}

export async function computeMetrics(
  range: DateRange,
  today: ISODate,
): Promise<ReviewMetricsSnapshot> {
  const series = await buildSeries(range)
  const totals = totalsOf(series)

  // A period still in progress is measured over the days that have happened.
  const elapsedDays = eachDay(range).filter((date) => date <= today).length
  const periodScore = computePeriodScore(
    series.map((entry) => entry.score?.score ?? null),
    elapsedDays,
    Math.min(WEEK_SCORE_MIN_COVERAGE, Math.max(1, Math.floor(elapsedDays * 0.4))),
  )

  const scored = series
    .filter((entry) => entry.score?.score !== null && entry.score?.score !== undefined)
    .map((entry) => ({ date: entry.date, score: entry.score?.score as number }))
    .sort((a, b) => b.score - a.score)

  return {
    computedAt: new Date().toISOString(),
    periodStart: range.start,
    periodEnd: range.end,
    daysLogged: totals.daysLogged,
    avgEnergy: round1(totals.avgEnergy),
    avgMood: round1(totals.avgMood),
    avgSleepHours: round1(totals.avgSleepHours),
    totalStudyMinutes: totals.totalStudyMinutes,
    totalDeepWorkMinutes: totals.totalDeepWorkMinutes,
    exerciseDays: totals.exerciseDays,
    totalExerciseMinutes: totals.totalExerciseMinutes,
    totalReadingMinutes: totals.totalReadingMinutes,
    totalEntertainmentMinutes: totals.totalEntertainmentMinutes,
    habitCompletionRate:
      totals.habitsScheduled > 0 ? totals.habitsCompleted / totals.habitsScheduled : null,
    periodScore: periodScore.score,
    bestDay: scored[0] ?? null,
    worstDay: scored.length > 1 ? (scored.at(-1) ?? null) : null,
  }
}

/** The written fields open pre-seeded from the period's own wins and problems. */
async function collectSeeds(range: DateRange): Promise<{ wins: string[]; problems: string[] }> {
  const settings = await getSettings()
  const logs = await findEffectiveRange(settings.userId, range)

  return {
    wins: logs.map((log) => log.dailyWin).filter((win): win is string => Boolean(win?.trim())),
    problems: logs
      .map((log) => log.dailyProblem)
      .filter((problem): problem is string => Boolean(problem?.trim())),
  }
}

const round1 = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10)

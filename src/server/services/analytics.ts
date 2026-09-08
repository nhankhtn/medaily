import { cache } from 'react'
import { type AnalyticsRange } from '@/lib/analytics/ranges'
import { buildDaySeries, totalsOf, type DaySeriesEntry } from '@/lib/analytics/day-series'
import { compareBuckets, type ComparisonResult } from '@/lib/analytics/correlation'
import { movingAverage } from '@/lib/analytics/stats'
import {
  previousRange,
  rangeOfLastDays,
  today as todayOf,
  type DateRange,
  type ISODate,
} from '@/lib/dates'
import { findEffectiveRange } from '@/server/repositories/daily'
import { findHabitLogsInRange, findHabits } from '@/server/repositories/habits'
import { dayContextOf, getSettings } from '@/server/services/settings'

export { ANALYTICS_RANGES, type AnalyticsRange } from '@/lib/analytics/ranges'

export type MetricSeries = {
  key: string
  points: { date: ISODate; value: number | null; average: number | null }[]
  average: number | null
  total: number | null
  /** Change against the equal-length window immediately before. */
  delta: number | null
}

/** The comparisons the product ships, each with its natural threshold. */
export const COMPARISONS = [
  { key: 'sleepEnergy', driver: 'sleep_hours', outcome: 'energy', threshold: 7, outcomeRange: 9 },
  { key: 'sleepStudy', driver: 'sleep_hours', outcome: 'focus_minutes', threshold: 7, outcomeRange: 240 },
  { key: 'exerciseEnergy', driver: 'exercise_minutes', outcome: 'energy', threshold: 1, outcomeRange: 9 },
  {
    key: 'entertainmentStudy',
    driver: 'entertainment_minutes',
    outcome: 'focus_minutes',
    threshold: 120,
    outcomeRange: 240,
  },
  { key: 'sleepMood', driver: 'sleep_hours', outcome: 'mood', threshold: 7, outcomeRange: 9 },
] as const

export type ComparisonView = (typeof COMPARISONS)[number] & { result: ComparisonResult }

export type AnalyticsData = {
  today: ISODate
  range: AnalyticsRange
  dateRange: DateRange
  totals: ReturnType<typeof totalsOf>
  previousTotals: ReturnType<typeof totalsOf>
  series: MetricSeries[]
  comparisons: ComparisonView[]
  timeAllocation: { key: string; minutes: number }[]
}

const METRIC_KEYS = [
  'energy',
  'mood',
  'sleep_hours',
  'focus_minutes',
  'technical_study_minutes',
  'deep_work_minutes',
  'exercise_minutes',
  'reading_minutes',
  'entertainment_minutes',
] as const

export const getAnalyticsData = cache(
  async (range: AnalyticsRange = 30): Promise<AnalyticsData> => {
    const settings = await getSettings()
    const today = todayOf(dayContextOf(settings))

    const dateRange = rangeOfLastDays(today, range)
    const priorRange = previousRange(dateRange)
    const fullRange = { start: priorRange.start, end: dateRange.end }

    const [logs, habitRows, habitLogRows] = await Promise.all([
      findEffectiveRange(settings.userId, fullRange),
      findHabits(settings.userId),
      findHabitLogsInRange(settings.userId, fullRange),
    ])

    const habits = habitRows.map((habit) => ({
      id: habit.id,
      name: habit.name,
      frequencyType: habit.frequencyType,
      targetCount: habit.targetCount,
      weekdays: habit.weekdays ?? null,
      intervalDays: habit.intervalDays ?? null,
      startDate: habit.startDate,
      endDate: habit.endDate,
    }))

    const habitCounts = new Map<string, Map<ISODate, number>>()
    for (const log of habitLogRows) {
      const perHabit = habitCounts.get(log.habitId) ?? new Map<ISODate, number>()
      perHabit.set(log.logDate, (perHabit.get(log.logDate) ?? 0) + log.count)
      habitCounts.set(log.habitId, perHabit)
    }

    const fullSeries = buildDaySeries({
      range: fullRange,
      logs,
      habits,
      habitCounts,
      weekStart: settings.weekStart,
      weights: settings.scoreWeights,
      targets: settings.scoreTargets,
    })

    const current = fullSeries.filter((entry) => entry.date >= dateRange.start)
    const prior = fullSeries.filter((entry) => entry.date < dateRange.start)

    const series = METRIC_KEYS.map((key) => buildSeries(key, current, prior))

    // Correlations read the current window only: mixing in the comparison
    // window would silently double the sample the user is told about.
    const comparisons: ComparisonView[] = COMPARISONS.map((comparison) => {
      const pairs = current
        .map((entry) => ({
          x: metricValue(comparison.driver, entry),
          y: metricValue(comparison.outcome, entry),
        }))
        .filter((pair): pair is { x: number; y: number } => pair.x !== null && pair.y !== null)

      return {
        ...comparison,
        result: compareBuckets({
          pairs,
          threshold: comparison.threshold,
          outcomeRange: comparison.outcomeRange,
        }),
      }
    })

    const totals = totalsOf(current)

    return {
      today,
      range,
      dateRange,
      totals,
      previousTotals: totalsOf(prior),
      series,
      comparisons,
      timeAllocation: [
        { key: 'study', minutes: totals.totalStudyMinutes },
        { key: 'deepWork', minutes: totals.totalDeepWorkMinutes },
        { key: 'exercise', minutes: totals.totalExerciseMinutes },
        { key: 'reading', minutes: totals.totalReadingMinutes },
        { key: 'entertainment', minutes: totals.totalEntertainmentMinutes },
      ].filter((slice) => slice.minutes > 0),
    }
  },
)

function metricValue(key: string, entry: DaySeriesEntry): number | null {
  switch (key) {
    case 'energy':
      return entry.log?.energy ?? null
    case 'mood':
      return entry.log?.mood ?? null
    case 'sleep_hours':
      return entry.log?.sleepHours ?? null
    case 'focus_minutes':
      return entry.focusMinutes
    case 'technical_study_minutes':
      return entry.studyMinutes
    case 'deep_work_minutes':
      return entry.deepWorkMinutes
    case 'exercise_minutes':
      return entry.log ? (entry.log.exerciseMinutes ?? 0) : null
    case 'reading_minutes':
      return entry.log ? (entry.log.readingMinutes ?? 0) : null
    case 'entertainment_minutes':
      return entry.log ? (entry.log.entertainmentMinutes ?? 0) : null
    default:
      return null
  }
}

const SUMMED_METRICS = new Set([
  'focus_minutes',
  'technical_study_minutes',
  'deep_work_minutes',
  'exercise_minutes',
  'reading_minutes',
  'entertainment_minutes',
])

function buildSeries(
  key: string,
  current: DaySeriesEntry[],
  prior: DaySeriesEntry[],
): MetricSeries {
  const values = current.map((entry) => metricValue(key, entry))
  const averages = movingAverage(values, 7)
  const present = values.filter((value): value is number => value !== null)
  const priorPresent = prior
    .map((entry) => metricValue(key, entry))
    .filter((value): value is number => value !== null)

  const average = present.length ? present.reduce((a, b) => a + b, 0) / present.length : null
  const priorAverage = priorPresent.length
    ? priorPresent.reduce((a, b) => a + b, 0) / priorPresent.length
    : null

  const summed = SUMMED_METRICS.has(key)
  const total = summed ? present.reduce((a, b) => a + b, 0) : null
  const priorTotal = summed ? priorPresent.reduce((a, b) => a + b, 0) : null

  const delta = summed
    ? total !== null && priorTotal !== null
      ? total - priorTotal
      : null
    : average !== null && priorAverage !== null
      ? Math.round((average - priorAverage) * 10) / 10
      : null

  return {
    key,
    points: current.map((entry, index) => ({
      date: entry.date,
      value: values[index] ?? null,
      average: averages[index] ?? null,
    })),
    average: average === null ? null : Math.round(average * 10) / 10,
    total,
    delta,
  }
}

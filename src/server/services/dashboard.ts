import { cache } from 'react'
import { buildDaySeries, totalsOf, weeklyHabitCompletion, type DaySeriesEntry, type SeriesHabit } from '@/lib/analytics/day-series'
import {
  addDays,
  eachDay,
  monthStartOf,
  rangeOfLastDays,
  today as todayOf,
  weekEndOf,
  weekStartOf,
  type DateRange,
  type ISODate,
} from '@/lib/dates'
import { WEEK_SCORE_MIN_COVERAGE } from '@/lib/defaults'
import { computeGoalProgress, type GoalProgress } from '@/lib/goals/progress'
import { computeCompletion, isScheduledOn } from '@/lib/habits/schedule'
import {
  generateInsights,
  selectForDashboard,
  type GeneratedInsight,
} from '@/lib/insights/rules'
import { computePeriodScore, type DayScore, type PeriodScore } from '@/lib/scoring'
import { computeStreak, statusFor, type StreakKind, type StreakResult } from '@/lib/streaks'
import type { EffectiveDailyLog, InsightPayload } from '@/lib/types'
import { findEffectiveRange } from '@/server/repositories/daily'
import { findHabitLogsInRange, findHabits } from '@/server/repositories/habits'
import {
  aggregateMetric,
  findGoals,
  findMilestonesFor,
  isMetricKey,
} from '@/server/repositories/goals'
import { findActiveInsights, recordInsights } from '@/server/repositories/insights'
import { dayContextOf, getSettings } from '@/server/services/settings'

/** How much history the dashboard reads: enough for 30-day trends and streaks. */
const SERIES_DAYS = 120

export type DashboardTodayCard = {
  date: ISODate
  logged: boolean
  log: EffectiveDailyLog | null
  score: DayScore | null
  /** Same-metric value for the previous logged day, for the delta chips. */
  previous: EffectiveDailyLog | null
}

export type DashboardStreak = StreakResult & { kind: StreakKind }

export type DashboardGoal = {
  id: string
  name: string
  category: string
  status: string
  progress: GoalProgress
  metricKey: string | null
  metricPeriod: string | null
}

export type DashboardHabit = {
  id: string
  name: string
  scheduledToday: boolean
  completedToday: boolean
  derived: boolean
  currentStreak: number
  monthlyRate: number | null
}

export type DashboardInsight = {
  id: string | null
  kind: string
  severity: 'low' | 'medium' | 'high' | 'win'
  payload: InsightPayload
}

export type TrendPoint = {
  date: ISODate
  focusMinutes: number | null
  sleepHours: number | null
  energy: number | null
  entertainmentMinutes: number | null
  score: number | null
}

export type DashboardData = {
  today: ISODate
  weekRange: DateRange
  todayCard: DashboardTodayCard
  weekScore: PeriodScore
  weekTotals: ReturnType<typeof totalsOf>
  previousWeekTotals: ReturnType<typeof totalsOf>
  streaks: DashboardStreak[]
  insights: DashboardInsight[]
  trends: TrendPoint[]
  goals: DashboardGoal[]
  habits: DashboardHabit[]
  weeklyHabits: { id: string; name: string; completed: number; target: number }[]
  pendingReviewWeek: ISODate | null
}

/**
 * Spec 28 — one call, one round of queries, everything the dashboard needs.
 * All reads go through `v_daily_effective`, so what the dashboard shows always
 * matches what a habit or a goal computed from the same day.
 */
export const getDashboardData = cache(async (): Promise<DashboardData> => {
  const settings = await getSettings()
  const ctx = dayContextOf(settings)
  const today = todayOf(ctx)

  const seriesRange = rangeOfLastDays(today, SERIES_DAYS)
  const weekRange = {
    start: weekStartOf(today, settings.weekStart),
    end: weekEndOf(today, settings.weekStart),
  }

  const [logs, habitRows, habitLogRows, goalRows] = await Promise.all([
    findEffectiveRange(settings.userId, seriesRange),
    findHabits(settings.userId),
    findHabitLogsInRange(settings.userId, seriesRange),
    findGoals(settings.userId),
  ])

  const milestones = await findMilestonesFor(goalRows.map((goal) => goal.id))

  const habits: SeriesHabit[] = habitRows.map((habit) => ({
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

  const series = buildDaySeries({
    range: seriesRange,
    logs,
    habits,
    habitCounts,
    weekStart: settings.weekStart,
    weights: settings.scoreWeights,
    targets: settings.scoreTargets,
  })

  const byDate = new Map(series.map((entry) => [entry.date, entry]))
  const todayEntry = byDate.get(today) ?? null
  const previousLogged = [...series]
    .reverse()
    .find((entry) => entry.date < today && entry.logged)?.log ?? null

  // Only the days of the week that have already happened count towards coverage.
  const weekDates = eachDay(weekRange).filter((date) => date <= today)
  const weekEntries = weekDates.map((date) => byDate.get(date)).filter(isEntry)
  const weekScore = computePeriodScore(
    weekEntries.map((entry) => entry.score?.score ?? null),
    weekDates.length,
    Math.min(WEEK_SCORE_MIN_COVERAGE, weekDates.length),
  )

  const previousWeekRange = {
    start: addDays(weekRange.start, -7),
    end: addDays(weekRange.start, -1),
  }
  const previousWeekEntries = eachDay(previousWeekRange)
    .map((date) => byDate.get(date))
    .filter(isEntry)

  const streaks = buildStreaks(series, today, settings)
  const goals = await buildGoals({
    goalRows,
    milestones,
    today,
    weekStart: settings.weekStart,
    userId: settings.userId,
  })
  const dashboardHabits = buildHabits({
    habitRows,
    habits,
    habitCounts,
    today,
    weekStart: settings.weekStart,
  })

  const weekTotals = totalsOf(weekEntries)
  const previousWeekTotals = totalsOf(previousWeekEntries)

  // Best week of the last 12, for the "best week" win.
  const bestWeekScore = bestWeekOf(series, settings.weekStart, weekRange.start)

  const generated = generateInsights({
    series,
    today,
    thresholds: settings.insightThresholds,
    goals: goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      percent: goal.progress.percent,
      daysRemaining: goal.progress.daysRemaining,
      status: goal.status,
    })),
    habits: weeklyHabitSignals(habitRows, habitCounts, today, settings.weekStart, dashboardHabits),
    streaks: streaks.map((streak) => ({
      kind: streak.kind,
      current: streak.current,
      pendingToday: streak.pendingToday,
      isBest: streak.current > 0 && streak.current >= streak.best,
    })),
    weekScore: weekScore.score,
    bestWeekScore,
  })

  const insights = await resolveInsights(settings.userId, generated, today)

  return {
    today,
    weekRange,
    todayCard: {
      date: today,
      logged: todayEntry?.logged ?? false,
      log: todayEntry?.log ?? null,
      score: todayEntry?.score ?? null,
      previous: previousLogged,
    },
    weekScore,
    weekTotals,
    previousWeekTotals,
    streaks,
    insights,
    trends: series.slice(-30).map((entry) => ({
      date: entry.date,
      focusMinutes: entry.focusMinutes,
      sleepHours: entry.log?.sleepHours ?? null,
      energy: entry.log?.energy ?? null,
      entertainmentMinutes: entry.log?.entertainmentMinutes ?? null,
      score: entry.score?.score ?? null,
    })),
    goals: goals.filter((goal) => goal.status === 'active').slice(0, 5),
    habits: dashboardHabits,
    weeklyHabits: weeklyHabitCompletion(habits, weekRange, habitCounts, settings.weekStart).map(
      ({ habit, completion }) => ({
        id: habit.id,
        name: habit.name,
        completed: completion.completedPeriods,
        target: habit.targetCount,
      }),
    ),
    pendingReviewWeek: addDays(weekRange.start, -7),
  }
})

function isEntry(entry: DaySeriesEntry | undefined): entry is DaySeriesEntry {
  return entry !== undefined
}

function buildStreaks(
  series: DaySeriesEntry[],
  today: ISODate,
  settings: Awaited<ReturnType<typeof getSettings>>,
): DashboardStreak[] {
  const kinds: StreakKind[] = ['logging', 'study', 'exercise', 'reading']
  return kinds.map((kind) => {
    const days = series.map((entry) => ({
      date: entry.date,
      status: statusFor(
        kind,
        {
          date: entry.date,
          logged: entry.logged,
          studyMinutes: entry.studyMinutes,
          deepWorkMinutes: entry.deepWorkMinutes,
          exerciseMinutes: entry.log?.exerciseMinutes ?? null,
          readingMinutes: entry.log?.readingMinutes ?? null,
        },
        settings.streakThresholds,
        entry.date === today,
      ),
    }))
    return { kind, ...computeStreak(days, settings.streakGraceEnabled) }
  })
}

async function buildGoals({
  goalRows,
  milestones,
  today,
  weekStart,
  userId,
}: {
  goalRows: Awaited<ReturnType<typeof findGoals>>
  milestones: Awaited<ReturnType<typeof findMilestonesFor>>
  today: ISODate
  weekStart: 'monday' | 'sunday'
  userId: string
}): Promise<DashboardGoal[]> {
  return Promise.all(
    goalRows.map(async (goal) => {
      const goalMilestones = milestones.filter((milestone) => milestone.goalId === goal.id)

      let metricActual: number | null = null
      if (goal.progressMode === 'metric' && goal.metricKey && isMetricKey(goal.metricKey)) {
        const range = metricRange(goal.metricPeriod, goal.startDate, today, weekStart)
        metricActual = await aggregateMetric(
          userId,
          goal.metricKey,
          goal.metricAggregation ?? 'sum',
          range,
        )
      }

      const progress = computeGoalProgress(
        {
          progressMode: goal.progressMode,
          progressManual: goal.progressManual === null ? null : Number(goal.progressManual),
          metricTarget: goal.metricTarget === null ? null : Number(goal.metricTarget),
          metricDirection: goal.metricDirection,
          metricActual,
          milestones: goalMilestones.map((milestone) => ({
            completed: milestone.completedAt !== null,
            weight: Number(milestone.weight),
          })),
          startDate: goal.startDate,
          targetDate: goal.targetDate,
        },
        today,
      )

      return {
        id: goal.id,
        name: goal.name,
        category: goal.category,
        status: goal.status,
        progress,
        metricKey: goal.metricKey,
        metricPeriod: goal.metricPeriod,
      }
    }),
  )
}

/** A metric goal's window: this week, this month, or everything since it began. */
function metricRange(
  period: string | null,
  startDate: ISODate,
  today: ISODate,
  weekStart: 'monday' | 'sunday',
): DateRange {
  switch (period) {
    case 'weekly':
      return { start: weekStartOf(today, weekStart), end: today }
    case 'monthly':
      return { start: monthStartOf(today), end: today }
    default:
      return { start: startDate, end: today }
  }
}

function buildHabits({
  habitRows,
  habits,
  habitCounts,
  today,
  weekStart,
}: {
  habitRows: Awaited<ReturnType<typeof findHabits>>
  habits: SeriesHabit[]
  habitCounts: Map<string, Map<ISODate, number>>
  today: ISODate
  weekStart: 'monday' | 'sunday'
}): DashboardHabit[] {
  const monthRange = { start: monthStartOf(today), end: today }

  return habitRows.map((row) => {
    const schedule = habits.find((habit) => habit.id === row.id)
    const counts = habitCounts.get(row.id) ?? new Map<ISODate, number>()
    const completion = schedule
      ? computeCompletion(schedule, monthRange, counts, weekStart)
      : { rate: null, completedPeriods: 0, scheduledPeriods: 0 }

    const days = eachDay({ start: addDays(today, -120), end: today }).map((date) => {
      const scheduled = schedule ? isScheduled(schedule, date) : false
      const count = counts.get(date) ?? 0
      return {
        date,
        status: !scheduled
          ? ('not_scheduled' as const)
          : count >= row.targetCount
            ? ('hit' as const)
            : date === today
              ? ('pending' as const)
              : ('miss' as const),
      }
    })

    return {
      id: row.id,
      name: row.name,
      scheduledToday: schedule ? isScheduled(schedule, today) : false,
      completedToday: (counts.get(today) ?? 0) >= row.targetCount,
      derived: row.linkedMetric !== null,
      currentStreak: computeStreak(days, true).current,
      monthlyRate: completion.rate,
    }
  })
}

/** Weekly habits have no per-day obligation; they surface as a week target. */
function isScheduled(schedule: SeriesHabit, date: ISODate): boolean {
  if (schedule.frequencyType === 'weekly') return false
  return isScheduledOn(schedule, date)
}

function weeklyHabitSignals(
  habitRows: Awaited<ReturnType<typeof findHabits>>,
  habitCounts: Map<string, Map<ISODate, number>>,
  today: ISODate,
  weekStart: 'monday' | 'sunday',
  dashboardHabits: DashboardHabit[],
) {
  const start = weekStartOf(today, weekStart)
  const end = weekEndOf(today, weekStart)

  return habitRows
    .filter((row) => row.frequencyType === 'weekly')
    .map((row) => {
      const counts = habitCounts.get(row.id) ?? new Map<ISODate, number>()
      const doneThisWeek = eachDay({ start, end }).reduce(
        (sum, date) => sum + (counts.get(date) ?? 0),
        0,
      )
      const remainingDays = eachDay({ start: today, end }).length
      return {
        id: row.id,
        name: row.name,
        remainingDays,
        remainingNeeded: Math.max(0, row.targetCount - doneThisWeek),
        monthlyRate: dashboardHabits.find((habit) => habit.id === row.id)?.monthlyRate ?? null,
      }
    })
}

function bestWeekOf(
  series: DaySeriesEntry[],
  weekStart: 'monday' | 'sunday',
  currentWeekStart: ISODate,
): number | null {
  const byWeek = new Map<ISODate, number[]>()
  for (const entry of series) {
    if (entry.score?.score === null || entry.score?.score === undefined) continue
    const key = weekStartOf(entry.date, weekStart)
    if (key === currentWeekStart) continue
    const scores = byWeek.get(key) ?? []
    scores.push(entry.score.score)
    byWeek.set(key, scores)
  }

  let best: number | null = null
  for (const scores of byWeek.values()) {
    if (scores.length < WEEK_SCORE_MIN_COVERAGE) continue
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length
    if (best === null || mean > best) best = mean
  }
  return best
}

async function resolveInsights(
  userId: string,
  generated: GeneratedInsight[],
  today: ISODate,
): Promise<DashboardInsight[]> {
  await recordInsights(userId, generated)

  const active = await findActiveInsights(
    userId,
    generated.map((insight) => insight.dedupeKey),
    today,
  )
  const activeByKey = new Map(active.map((row) => [row.dedupeKey, row]))

  // Dismissed and snoozed rows are simply absent from `active`, which is what
  // keeps a dismissal from coming back on the next regeneration.
  const survivors = generated.filter((insight) => activeByKey.has(insight.dedupeKey))

  return selectForDashboard(survivors).map((insight) => ({
    id: activeByKey.get(insight.dedupeKey)?.id ?? null,
    kind: insight.kind,
    severity: insight.severity,
    payload: insight.payload,
  }))
}

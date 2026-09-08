import { cache } from 'react'
import { monthStartOf, today as todayOf, weekStartOf, type DateRange, type ISODate } from '@/lib/dates'
import { computeGoalProgress, type GoalProgress } from '@/lib/goals/progress'
import {
  aggregateMetric,
  findGoals,
  findMilestonesFor,
  isMetricKey,
} from '@/server/repositories/goals'
import { dayContextOf, getSettings } from '@/server/services/settings'

export type GoalView = {
  id: string
  name: string
  description: string | null
  category: string
  status: 'active' | 'completed' | 'paused' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  progressMode: 'manual' | 'metric' | 'milestones'
  metricKey: string | null
  metricPeriod: string | null
  metricDirection: 'at_least' | 'at_most' | null
  startDate: ISODate
  targetDate: ISODate | null
  progress: GoalProgress
  milestones: { id: string; title: string; completed: boolean; dueDate: ISODate | null }[]
}

export const getGoalsView = cache(async (): Promise<{ today: ISODate; goals: GoalView[] }> => {
  const settings = await getSettings()
  const today = todayOf(dayContextOf(settings))

  const rows = await findGoals(settings.userId)
  const milestones = await findMilestonesFor(rows.map((row) => row.id))

  const goals = await Promise.all(
    rows.map(async (row): Promise<GoalView> => {
      const own = milestones.filter((milestone) => milestone.goalId === row.id)

      let metricActual: number | null = null
      if (row.progressMode === 'metric' && row.metricKey && isMetricKey(row.metricKey)) {
        metricActual = await aggregateMetric(
          settings.userId,
          row.metricKey,
          row.metricAggregation ?? 'sum',
          periodRange(row.metricPeriod, row.startDate, today, settings.weekStart),
        )
      }

      return {
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category,
        status: row.status,
        priority: row.priority,
        progressMode: row.progressMode,
        metricKey: row.metricKey,
        metricPeriod: row.metricPeriod,
        metricDirection: row.metricDirection,
        startDate: row.startDate,
        targetDate: row.targetDate,
        progress: computeGoalProgress(
          {
            progressMode: row.progressMode,
            progressManual: row.progressManual === null ? null : Number(row.progressManual),
            metricTarget: row.metricTarget === null ? null : Number(row.metricTarget),
            metricDirection: row.metricDirection,
            metricActual,
            milestones: own.map((milestone) => ({
              completed: milestone.completedAt !== null,
              weight: Number(milestone.weight),
            })),
            startDate: row.startDate,
            targetDate: row.targetDate,
          },
          today,
        ),
        milestones: own.map((milestone) => ({
          id: milestone.id,
          title: milestone.title,
          completed: milestone.completedAt !== null,
          dueDate: milestone.dueDate,
        })),
      }
    }),
  )

  return { today, goals }
})

function periodRange(
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

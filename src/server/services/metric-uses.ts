import { findGoals } from '@/server/repositories/goals'
import { findHabits } from '@/server/repositories/habits'

/** How many habits and goals read a metric, so a field can say what it feeds. */
export type MetricUse = Record<string, { habits: number; goals: number }>

/**
 * What reads each metric.
 *
 * Switching a daily field off is reversible and harmless on its own, but a
 * habit bound to that field stops ticking and says nothing about why. This is
 * what lets the toggle warn first.
 */
export async function getMetricUses(userId: string): Promise<MetricUse> {
  const [habits, goals] = await Promise.all([findHabits(userId), findGoals(userId)])

  const uses: MetricUse = {}
  const note = (key: string | null, kind: 'habits' | 'goals') => {
    if (!key) return
    uses[key] ??= { habits: 0, goals: 0 }
    uses[key][kind] += 1
  }
  for (const habit of habits) note(habit.linkedMetric, 'habits')
  for (const goal of goals) note(goal.metricKey, 'goals')

  return uses
}

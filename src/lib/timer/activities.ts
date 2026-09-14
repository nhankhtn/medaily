/**
 * What the timer can time, and where each one is filed when it stops.
 *
 * Anything the daily log measures in minutes belongs here — timing it and
 * typing it should be the same fact, not two places to keep in step. Adding
 * one is an entry here plus its label; the column it writes to is named on the
 * entry, so nothing else needs to know.
 *
 *   focus   → a focus session, which `v_daily_effective` resolves into the day
 *   workout → a workouts row, which back-fills the day's exercise minutes
 *   daily   → added straight onto that day's column
 */

/** Daily-log columns that hold minutes and have no table of their own. */
export type DailyMinutesColumn = 'readingMinutes' | 'entertainmentMinutes' | 'englishMinutes'

export type FocusKind = 'learning' | 'deep_work' | 'project'

export type TimedActivity =
  | { id: FocusKind; sink: 'focus'; kind: FocusKind }
  | { id: 'exercise'; sink: 'workout' }
  | { id: 'reading' | 'entertainment' | 'english'; sink: 'daily'; column: DailyMinutesColumn }

export const TIMED_ACTIVITIES: readonly TimedActivity[] = [
  { id: 'learning', sink: 'focus', kind: 'learning' },
  { id: 'deep_work', sink: 'focus', kind: 'deep_work' },
  { id: 'project', sink: 'focus', kind: 'project' },
  { id: 'english', sink: 'daily', column: 'englishMinutes' },
  { id: 'reading', sink: 'daily', column: 'readingMinutes' },
  { id: 'exercise', sink: 'workout' },
  // Tracked to be seen, not to be encouraged — but it is minutes like the rest.
  { id: 'entertainment', sink: 'daily', column: 'entertainmentMinutes' },
] as const

export type ActivityId = TimedActivity['id']

export const ACTIVITY_IDS = TIMED_ACTIVITIES.map((activity) => activity.id)

export const DEFAULT_ACTIVITY: ActivityId = 'learning'

export const isActivityId = (value: unknown): value is ActivityId =>
  typeof value === 'string' && (ACTIVITY_IDS as readonly string[]).includes(value)

export const activityOf = (id: ActivityId): TimedActivity =>
  TIMED_ACTIVITIES.find((activity) => activity.id === id) ?? TIMED_ACTIVITIES[0]!

/** Only a focus run can be attributed to a topic or a project. */
export const takesTopicAndProject = (id: ActivityId): boolean => activityOf(id).sink === 'focus'

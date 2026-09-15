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
 *   custom  → added onto a metric the user invented, by its id
 */

/** Daily-log columns that hold minutes and have no table of their own. */
export type DailyMinutesColumn = 'readingMinutes' | 'entertainmentMinutes' | 'englishMinutes'

export type FocusKind = 'learning' | 'deep_work' | 'project'

/**
 * A metric the user invented, addressed by its own id. The id travels inside
 * the activity id, so resolving one needs no lookup and `activityOf` can stay
 * a pure function the client calls too.
 */
export const CUSTOM_PREFIX = 'custom:'

export type CustomActivityId = `${typeof CUSTOM_PREFIX}${string}`

export type TimedActivity =
  | { id: FocusKind; sink: 'focus'; kind: FocusKind }
  | { id: 'exercise'; sink: 'workout' }
  | { id: 'reading' | 'entertainment' | 'english'; sink: 'daily'; column: DailyMinutesColumn }
  | { id: CustomActivityId; sink: 'custom'; metricId: string }

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

/** The built-in ids only; a custom one is not in any list. */
export const ACTIVITY_IDS = TIMED_ACTIVITIES.map((activity) => activity.id)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const customActivityId = (metricId: string): CustomActivityId =>
  `${CUSTOM_PREFIX}${metricId}`

export const isCustomActivityId = (value: string): value is CustomActivityId =>
  value.startsWith(CUSTOM_PREFIX) && UUID.test(value.slice(CUSTOM_PREFIX.length))

export const DEFAULT_ACTIVITY: ActivityId = 'learning'

export const isActivityId = (value: unknown): value is ActivityId =>
  typeof value === 'string' &&
  ((ACTIVITY_IDS as readonly string[]).includes(value) || isCustomActivityId(value))

export function activityOf(id: ActivityId): TimedActivity {
  if (isCustomActivityId(id)) {
    return { id, sink: 'custom', metricId: id.slice(CUSTOM_PREFIX.length) }
  }
  return TIMED_ACTIVITIES.find((activity) => activity.id === id) ?? TIMED_ACTIVITIES[0]!
}

/** Only a focus run can be attributed to a topic or a project. */
export const takesTopicAndProject = (id: ActivityId): boolean => activityOf(id).sink === 'focus'

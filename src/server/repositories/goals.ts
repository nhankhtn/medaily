import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { goalMilestones, goals } from '@/lib/db/schema'
import type { Goal, GoalInsert, GoalMilestone } from '@/lib/db/schema'
import type { DateRange } from '@/lib/dates'
import type { MetricKey } from '@/lib/types'

export async function findGoals(
  userId: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<Goal[]> {
  return db
    .select()
    .from(goals)
    .where(
      includeArchived
        ? eq(goals.userId, userId)
        : and(eq(goals.userId, userId), isNull(goals.archivedAt)),
    )
    .orderBy(asc(goals.status), asc(goals.createdAt))
}

export async function findGoal(userId: string, goalId: string): Promise<Goal | null> {
  const rows = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.id, goalId)))
    .limit(1)
  return rows[0] ?? null
}

export async function findMilestonesFor(goalIds: string[]): Promise<GoalMilestone[]> {
  if (goalIds.length === 0) return []
  return db
    .select()
    .from(goalMilestones)
    .where(inArray(goalMilestones.goalId, goalIds))
    .orderBy(asc(goalMilestones.sortOrder))
}

export async function insertGoal(values: GoalInsert): Promise<Goal> {
  const rows = await db.insert(goals).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert goal')
  return row
}

export async function updateGoal(
  userId: string,
  goalId: string,
  patch: Partial<GoalInsert>,
): Promise<Goal> {
  const rows = await db
    .update(goals)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(goals.userId, userId), eq(goals.id, goalId)))
    .returning()
  const row = rows[0]
  if (!row) throw new Error('goal not found')
  return row
}

export async function upsertMilestone(
  values: typeof goalMilestones.$inferInsert & { id?: string },
): Promise<GoalMilestone> {
  if (values.id) {
    const rows = await db
      .update(goalMilestones)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(goalMilestones.id, values.id))
      .returning()
    const row = rows[0]
    if (!row) throw new Error('milestone not found')
    return row
  }
  const rows = await db.insert(goalMilestones).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert milestone')
  return row
}

/**
 * Metric columns a goal may aggregate. A whitelist, not string interpolation:
 * the metric key arrives from stored data and must never reach SQL directly.
 */
const METRIC_COLUMNS: Record<MetricKey, string> = {
  energy: 'energy',
  mood: 'mood',
  sleep_hours: 'sleep_hours',
  technical_study_minutes: 'effective_study_minutes',
  deep_work_minutes: 'effective_deep_work_minutes',
  focus_minutes: 'COALESCE(effective_study_minutes, 0) + COALESCE(effective_deep_work_minutes, 0)',
  exercise_minutes: 'exercise_minutes',
  reading_minutes: 'reading_minutes',
  reading_pages: 'reading_pages',
  entertainment_minutes: 'entertainment_minutes',
  english_minutes: 'english_minutes',
}

export function isMetricKey(value: string): value is MetricKey {
  return value in METRIC_COLUMNS
}

/**
 * Aggregates a metric over a date range, reading `v_daily_effective` so goals
 * agree with the dashboard. `count_days` counts days where the metric is
 * present and non-zero; NULL days never become zeros (spec 38.5).
 */
export async function aggregateMetric(
  userId: string,
  metricKey: MetricKey,
  aggregation: 'sum' | 'avg' | 'count_days' | 'latest',
  range: DateRange,
): Promise<number | null> {
  const column = METRIC_COLUMNS[metricKey]
  const expression = (() => {
    switch (aggregation) {
      case 'sum':
        return `COALESCE(SUM(${column}), 0)`
      case 'avg':
        return `AVG(${column})`
      case 'count_days':
        return `COUNT(*) FILTER (WHERE (${column}) IS NOT NULL AND (${column}) > 0)`
      case 'latest':
        return `(SELECT ${column} FROM v_daily_effective
                 WHERE user_id = $1 AND log_date BETWEEN $2 AND $3 AND (${column}) IS NOT NULL
                 ORDER BY log_date DESC LIMIT 1)`
    }
  })()

  const rows = await db.execute<{ value: string | null }>(
    sql.raw(`
      SELECT ${expression} AS value
      FROM v_daily_effective
      WHERE user_id = '${sanitizeUuid(userId)}'
        AND log_date BETWEEN '${sanitizeDate(range.start)}' AND '${sanitizeDate(range.end)}'
    `),
  )

  const raw = rows[0]?.value
  if (raw === null || raw === undefined) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

/**
 * `sql.raw` is required because the aggregate expression itself is dynamic, so
 * the two literals it interpolates are validated to be exactly a UUID and a
 * date. Anything else throws rather than reaching the database.
 */
function sanitizeUuid(value: string): string {
  if (!/^[0-9a-fA-F-]{36}$/.test(value)) throw new Error('invalid user id')
  return value
}

function sanitizeDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('invalid date')
  return value
}

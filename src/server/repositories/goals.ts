import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
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
    .orderBy(asc(goals.status), asc(goals.sortOrder), asc(goals.createdAt))
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

export type MilestoneValues = typeof goalMilestones.$inferInsert & { id?: string }

/**
 * Writes a whole list in one statement. A row without an id inserts; one with
 * an id updates, because the id is the primary key the conflict is on.
 *
 * `setWhere` keeps what the single-row version had: the goal id pins the
 * milestone to a goal the caller has already checked, so an id lifted from
 * somebody else's goal conflicts and then updates nothing.
 */
export async function upsertMilestones(
  values: MilestoneValues[],
  tx: DbOrTx = db,
): Promise<GoalMilestone[]> {
  if (values.length === 0) return []

  return tx
    .insert(goalMilestones)
    .values(values)
    .onConflictDoUpdate({
      target: goalMilestones.id,
      // `excluded` is the row this statement tried to insert, so each row in
      // the batch updates from its own values rather than from the first.
      set: {
        title: sql`excluded.title`,
        sortOrder: sql`excluded.sort_order`,
        weight: sql`excluded.weight`,
        completedAt: sql`excluded.completed_at`,
        dueDate: sql`excluded.due_date`,
        updatedAt: new Date(),
      },
      setWhere: eq(goalMilestones.goalId, sql`excluded.goal_id`),
    })
    .returning()
}

export async function upsertMilestone(values: MilestoneValues): Promise<GoalMilestone> {
  const row = (await upsertMilestones([values]))[0]
  if (!row) throw new Error(values.id ? 'milestone not found' : 'failed to insert milestone')
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
  // `in` would also accept `constructor` and `toString`, which then reach `sql.raw`.
  return Object.hasOwn(METRIC_COLUMNS, value)
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
  const owner = sanitizeUuid(userId)
  const from = sanitizeDate(range.start)
  const to = sanitizeDate(range.end)

  const expression = (() => {
    switch (aggregation) {
      case 'sum':
        return `COALESCE(SUM(${column}), 0)`
      case 'avg':
        return `AVG(${column})`
      case 'count_days':
        return `COUNT(*) FILTER (WHERE (${column}) IS NOT NULL AND (${column}) > 0)`
      case 'latest':
        // `sql.raw` sends no parameters, so `$1` here was never bound and the
        // query threw for every goal that asked for its latest value.
        return `(SELECT ${column} FROM v_daily_effective
                 WHERE user_id = '${owner}' AND log_date BETWEEN '${from}' AND '${to}'
                   AND (${column}) IS NOT NULL
                 ORDER BY log_date DESC LIMIT 1)`
    }
  })()

  const rows = await db.execute<{ value: string | null }>(
    sql.raw(`
      SELECT ${expression} AS value
      FROM v_daily_effective
      WHERE user_id = '${owner}'
        AND log_date BETWEEN '${from}' AND '${to}'
      LIMIT 1
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

/**
 * Writes a hand-arranged order in one statement: a list of ids becomes a list
 * of positions, and anything not in it is left alone. Scoped to the user, so
 * an id from somewhere else moves nothing.
 */
export async function reorderGoals(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return

  const positions = sql.join(
    // Both casts are load-bearing: parameters arrive as text, and `VALUES`
    // has no column to infer a type from.
    ids.map((id, index) => sql`(${id}::uuid, ${index}::int)`),
    sql`, `,
  )

  await db.execute(sql`
    UPDATE goals SET sort_order = ordering.position, updated_at = now()
    FROM (VALUES ${positions}) AS ordering(id, position)
    WHERE goals.id = ordering.id AND goals.user_id = ${userId}::uuid
  `)
}

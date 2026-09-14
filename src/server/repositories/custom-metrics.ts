import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { customMetrics, customMetricValues, dailyLogs } from '@/lib/db/schema'
import type { CustomMetric, CustomMetricInsert } from '@/lib/db/schema'
import type { DateRange, ISODate } from '@/lib/dates'

export async function findCustomMetrics(userId: string, tx: DbOrTx = db): Promise<CustomMetric[]> {
  return tx
    .select()
    .from(customMetrics)
    .where(and(eq(customMetrics.userId, userId), isNull(customMetrics.archivedAt)))
    .orderBy(asc(customMetrics.sortOrder), asc(customMetrics.labelEn))
}

export async function findCustomMetric(userId: string, id: string): Promise<CustomMetric | null> {
  const rows = await db
    .select()
    .from(customMetrics)
    .where(and(eq(customMetrics.userId, userId), eq(customMetrics.id, id)))
    .limit(1)
  return rows[0] ?? null
}

export async function insertCustomMetric(values: CustomMetricInsert): Promise<CustomMetric> {
  const rows = await db.insert(customMetrics).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert custom metric')
  return row
}

export async function updateCustomMetric(
  userId: string,
  id: string,
  patch: Partial<CustomMetricInsert>,
): Promise<CustomMetric> {
  const rows = await db
    .update(customMetrics)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(customMetrics.userId, userId), eq(customMetrics.id, id)))
    .returning()
  const row = rows[0]
  if (!row) throw new Error('custom metric not found')
  return row
}

export type CustomValue = {
  customMetricId: string
  valueNumeric: string | null
  valueBool: boolean | null
  valueText: string | null
}

export async function findCustomValues(
  dailyLogId: string,
  tx: DbOrTx = db,
): Promise<CustomValue[]> {
  return tx
    .select({
      customMetricId: customMetricValues.customMetricId,
      valueNumeric: customMetricValues.valueNumeric,
      valueBool: customMetricValues.valueBool,
      valueText: customMetricValues.valueText,
    })
    .from(customMetricValues)
    .where(eq(customMetricValues.dailyLogId, dailyLogId))
}

/**
 * Writes the day's custom values. A key the caller left out is untouched; one
 * it set to null is cleared, which is how a field is emptied rather than
 * remembered forever.
 */
export async function saveCustomValues(
  dailyLogId: string,
  values: Record<string, number | boolean | string | null>,
  tx: DbOrTx = db,
): Promise<void> {
  const ids = Object.keys(values)
  if (ids.length === 0) return

  const cleared = ids.filter((id) => values[id] === null)
  if (cleared.length > 0) {
    await tx
      .delete(customMetricValues)
      .where(
        and(
          eq(customMetricValues.dailyLogId, dailyLogId),
          inArray(customMetricValues.customMetricId, cleared),
        ),
      )
  }

  const rows = ids
    .filter((id) => values[id] !== null)
    .map((id) => {
      const value = values[id]
      return {
        dailyLogId,
        customMetricId: id,
        valueNumeric: typeof value === 'number' ? String(value) : null,
        valueBool: typeof value === 'boolean' ? value : null,
        valueText: typeof value === 'string' ? value : null,
      }
    })
  if (rows.length === 0) return

  await tx
    .insert(customMetricValues)
    .values(rows)
    .onConflictDoUpdate({
      target: [customMetricValues.dailyLogId, customMetricValues.customMetricId],
      set: {
        valueNumeric: sql`excluded.value_numeric`,
        valueBool: sql`excluded.value_bool`,
        valueText: sql`excluded.value_text`,
      },
    })
}

/** The day's custom numbers, keyed the way a habit or a goal names them. */
export async function customSnapshotFor(
  userId: string,
  date: ISODate,
  tx: DbOrTx = db,
): Promise<Record<string, number | null>> {
  const rows = await tx
    .select({
      key: customMetrics.key,
      valueNumeric: customMetricValues.valueNumeric,
      valueBool: customMetricValues.valueBool,
    })
    .from(customMetricValues)
    .innerJoin(dailyLogs, eq(dailyLogs.id, customMetricValues.dailyLogId))
    .innerJoin(customMetrics, eq(customMetrics.id, customMetricValues.customMetricId))
    .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.logDate, date)))

  const snapshot: Record<string, number | null> = {}
  for (const row of rows) {
    snapshot[row.key] =
      row.valueNumeric !== null
        ? Number(row.valueNumeric)
        : row.valueBool !== null
          ? Number(row.valueBool)
          : null
  }
  return snapshot
}

/**
 * A goal's aggregate over a custom metric. Built-in metrics read the
 * `v_daily_effective` view; these have no column there, so they aggregate
 * from the values table instead.
 */
export async function aggregateCustomMetric(
  userId: string,
  key: string,
  aggregation: 'sum' | 'avg' | 'count_days' | 'latest',
  range: DateRange,
): Promise<number | null> {
  const value = sql<
    string | null
  >`COALESCE(${customMetricValues.valueNumeric}, ${customMetricValues.valueBool}::int::numeric)`

  const expression =
    aggregation === 'sum'
      ? sql<string | null>`COALESCE(SUM(${value}), 0)`
      : aggregation === 'avg'
        ? sql<string | null>`AVG(${value})`
        : aggregation === 'count_days'
          ? sql<string | null>`COUNT(*) FILTER (WHERE ${value} IS NOT NULL AND ${value} > 0)`
          : sql<string | null>`(ARRAY_AGG(${value} ORDER BY ${dailyLogs.logDate} DESC))[1]`

  const rows = await db
    .select({ value: expression })
    .from(customMetricValues)
    .innerJoin(dailyLogs, eq(dailyLogs.id, customMetricValues.dailyLogId))
    .innerJoin(customMetrics, eq(customMetrics.id, customMetricValues.customMetricId))
    .where(
      and(
        eq(dailyLogs.userId, userId),
        eq(customMetrics.key, key),
        sql`${dailyLogs.logDate} BETWEEN ${range.start} AND ${range.end}`,
      ),
    )

  const raw = rows[0]?.value
  if (raw === null || raw === undefined) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

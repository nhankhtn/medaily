import { and, asc, between, desc, eq, gte, isNotNull, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { dailyEffective, dailyLogs } from '@/lib/db/schema'
import type { DailyLog } from '@/lib/db/schema'
import type { DateRange, ISODate } from '@/lib/dates'
import type { EffectiveDailyLog } from '@/lib/types'

/** Columns a user can write from the daily form. */
export type DailyLogPatch = Partial<
  Pick<
    DailyLog,
    | 'energy'
    | 'mood'
    | 'sleepHours'
    | 'bedtime'
    | 'wakeTime'
    | 'technicalStudyMinutes'
    | 'deepWorkMinutes'
    | 'exerciseMinutes'
    | 'exerciseType'
    | 'readingMinutes'
    | 'readingPages'
    | 'entertainmentMinutes'
    | 'englishMinutes'
    | 'dailyWin'
    | 'dailyProblem'
    | 'tomorrowPriority'
    | 'note'
    | 'source'
  >
>

export async function findRawLog(userId: string, date: ISODate): Promise<DailyLog | null> {
  const rows = await db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.logDate, date)))
    .limit(1)
  return rows[0] ?? null
}

function toEffective(row: typeof dailyEffective.$inferSelect): EffectiveDailyLog {
  return {
    id: row.id,
    logDate: row.logDate,
    energy: row.energy,
    mood: row.mood,
    sleepHours: row.sleepHours === null ? null : Number(row.sleepHours),
    technicalStudyMinutes: row.technicalStudyMinutes,
    deepWorkMinutes: row.deepWorkMinutes,
    effectiveStudyMinutes: row.effectiveStudyMinutes,
    effectiveDeepWorkMinutes: row.effectiveDeepWorkMinutes,
    exerciseMinutes: row.exerciseMinutes,
    exerciseType: row.exerciseType,
    readingMinutes: row.readingMinutes,
    readingPages: row.readingPages,
    entertainmentMinutes: row.entertainmentMinutes,
    englishMinutes: row.englishMinutes,
    dailyWin: row.dailyWin,
    dailyProblem: row.dailyProblem,
    tomorrowPriority: row.tomorrowPriority,
    note: row.note,
    sessionCount: row.sessionCount,
  }
}

export async function findEffectiveLog(
  userId: string,
  date: ISODate,
): Promise<EffectiveDailyLog | null> {
  const rows = await db
    .select()
    .from(dailyEffective)
    .where(and(eq(dailyEffective.userId, userId), eq(dailyEffective.logDate, date)))
    .limit(1)
  const row = rows[0]
  return row ? toEffective(row) : null
}

export async function findEffectiveRange(
  userId: string,
  range: DateRange,
): Promise<EffectiveDailyLog[]> {
  const rows = await db
    .select()
    .from(dailyEffective)
    .where(
      and(
        eq(dailyEffective.userId, userId),
        between(dailyEffective.logDate, range.start, range.end),
      ),
    )
    .orderBy(asc(dailyEffective.logDate))
  return rows.map(toEffective)
}

export async function findRecentLogDates(userId: string, limit = 30): Promise<ISODate[]> {
  const rows = await db
    .select({ logDate: dailyLogs.logDate })
    .from(dailyLogs)
    .where(eq(dailyLogs.userId, userId))
    .orderBy(desc(dailyLogs.logDate))
    .limit(limit)
  return rows.map((r) => r.logDate)
}

export async function findLatestLogBefore(
  userId: string,
  date: ISODate,
): Promise<DailyLog | null> {
  const rows = await db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), sql`${dailyLogs.logDate} < ${date}`))
    .orderBy(desc(dailyLogs.logDate))
    .limit(1)
  return rows[0] ?? null
}

/**
 * Upsert keyed on (user_id, log_date) — the database uniqueness constraint is
 * what makes a duplicate impossible, not application logic (spec 26.1).
 */
export async function upsertLog(
  userId: string,
  date: ISODate,
  patch: DailyLogPatch,
  tx: DbOrTx = db,
): Promise<DailyLog> {
  const rows = await tx
    .insert(dailyLogs)
    .values({ userId, logDate: date, ...patch })
    .onConflictDoUpdate({
      target: [dailyLogs.userId, dailyLogs.logDate],
      set: { ...patch, updatedAt: new Date() },
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('failed to upsert daily log')
  return row
}

export async function deleteLog(userId: string, date: ISODate): Promise<void> {
  await db.delete(dailyLogs).where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.logDate, date)))
}

export type MetricMedians = {
  sleepHours: number | null
  technicalStudyMinutes: number | null
  deepWorkMinutes: number | null
  exerciseMinutes: number | null
  readingMinutes: number | null
  entertainmentMinutes: number | null
  englishMinutes: number | null
}

/**
 * Medians power the ghost placeholders in the daily form (spec 6.4). NULLs are
 * excluded by `percentile_cont`, so a metric the user never fills stays empty
 * instead of collapsing to zero.
 */
export async function findMedians(userId: string, since: ISODate): Promise<MetricMedians> {
  const rows = await db.execute<{
    sleep_hours: string | null
    technical_study_minutes: string | null
    deep_work_minutes: string | null
    exercise_minutes: string | null
    reading_minutes: string | null
    entertainment_minutes: string | null
    english_minutes: string | null
  }>(sql`
    SELECT
      percentile_cont(0.5) WITHIN GROUP (ORDER BY sleep_hours)             AS sleep_hours,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY technical_study_minutes) AS technical_study_minutes,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY deep_work_minutes)       AS deep_work_minutes,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY exercise_minutes)        AS exercise_minutes,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY reading_minutes)         AS reading_minutes,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY entertainment_minutes)   AS entertainment_minutes,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY english_minutes)         AS english_minutes
    FROM daily_logs
    WHERE user_id = ${userId} AND log_date >= ${since}
  `)

  const row = rows[0]
  const num = (v: string | null | undefined) => {
    if (v === null || v === undefined) return null
    const n = Number(v)
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : null
  }

  return {
    sleepHours: num(row?.sleep_hours),
    technicalStudyMinutes: num(row?.technical_study_minutes),
    deepWorkMinutes: num(row?.deep_work_minutes),
    exerciseMinutes: num(row?.exercise_minutes),
    readingMinutes: num(row?.reading_minutes),
    entertainmentMinutes: num(row?.entertainment_minutes),
    englishMinutes: num(row?.english_minutes),
  }
}

/** Most-used exercise types, newest usage first — the suggestion chips (spec 5.2). */
export async function findExerciseTypes(userId: string, limit = 8): Promise<string[]> {
  const rows = await db
    .select({ type: dailyLogs.exerciseType, count: sql<number>`count(*)::int` })
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), isNotNull(dailyLogs.exerciseType)))
    .groupBy(dailyLogs.exerciseType)
    .orderBy(desc(sql`count(*)`))
    .limit(limit)
  return rows.map((r) => r.type).filter((t): t is string => Boolean(t && t.trim()))
}

export async function countLogsSince(userId: string, since: ISODate): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), gte(dailyLogs.logDate, since)))
  return rows[0]?.count ?? 0
}

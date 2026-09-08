import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { monthlyReviews, weeklyReviews, yearlyReviews } from '@/lib/db/schema'
import type { ReviewMetricsSnapshot } from '@/lib/types'
import type { ISODate } from '@/lib/dates'

export type ReviewPeriod = 'weekly' | 'monthly' | 'yearly'

export type ReviewRow = {
  id: string
  key: string
  whatWorked: string | null
  whatDidnt: string | null
  changeNext: string | null
  topPriority: string | null
  reflection: string | null
  metricsSnapshot: ReviewMetricsSnapshot | null
  finalizedAt: Date | null
}

type WriteValues = {
  whatWorked?: string | null
  whatDidnt?: string | null
  changeNext?: string | null
  topPriority?: string | null
  reflection?: string | null
  metricsSnapshot?: ReviewMetricsSnapshot | null
  snapshotVersion?: number | null
  finalizedAt?: Date | null
}

/** The three review tables share a shape; this keeps one code path over them. */
function tableFor(period: ReviewPeriod) {
  switch (period) {
    case 'weekly':
      return { table: weeklyReviews, keyColumn: weeklyReviews.weekStartDate, keyName: 'weekStartDate' as const }
    case 'monthly':
      return { table: monthlyReviews, keyColumn: monthlyReviews.monthStartDate, keyName: 'monthStartDate' as const }
    case 'yearly':
      return { table: yearlyReviews, keyColumn: yearlyReviews.year, keyName: 'year' as const }
  }
}

function toKey(period: ReviewPeriod, key: string): string | number {
  return period === 'yearly' ? Number(key) : key
}

function toRow(period: ReviewPeriod, row: Record<string, unknown>): ReviewRow {
  const { keyName } = tableFor(period)
  return {
    id: row.id as string,
    key: String(row[keyName]),
    whatWorked: (row.whatWorked as string | null) ?? null,
    whatDidnt: (row.whatDidnt as string | null) ?? null,
    changeNext: (row.changeNext as string | null) ?? null,
    topPriority: (row.topPriority as string | null) ?? null,
    reflection: (row.reflection as string | null) ?? null,
    metricsSnapshot: (row.metricsSnapshot as ReviewMetricsSnapshot | null) ?? null,
    finalizedAt: (row.finalizedAt as Date | null) ?? null,
  }
}

export async function findReview(
  userId: string,
  period: ReviewPeriod,
  key: string,
): Promise<ReviewRow | null> {
  const { table, keyColumn } = tableFor(period)
  const rows = await db
    .select()
    .from(table)
    .where(and(eq(table.userId, userId), eq(keyColumn, toKey(period, key) as never)))
    .limit(1)
  const row = rows[0]
  return row ? toRow(period, row) : null
}

export async function findRecentReviews(
  userId: string,
  period: ReviewPeriod,
  limit = 12,
): Promise<ReviewRow[]> {
  const { table, keyColumn } = tableFor(period)
  const rows = await db
    .select()
    .from(table)
    .where(eq(table.userId, userId))
    .orderBy(desc(keyColumn))
    .limit(limit)
  return rows.map((row) => toRow(period, row))
}

export async function upsertReview(
  userId: string,
  period: ReviewPeriod,
  key: string,
  values: WriteValues,
): Promise<ReviewRow> {
  const { table, keyColumn, keyName } = tableFor(period)

  const rows = await db
    .insert(table)
    .values({ userId, [keyName]: toKey(period, key), ...values } as never)
    .onConflictDoUpdate({
      target: [table.userId, keyColumn],
      set: { ...values, updatedAt: new Date() } as never,
    })
    .returning()

  const row = rows[0]
  if (!row) throw new Error('failed to upsert review')
  return toRow(period, row)
}

export type ReviewKey = { period: ReviewPeriod; key: ISODate | string }

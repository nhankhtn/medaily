import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { aiReports } from '@/lib/db/schema'
import type { AiReport } from '@/lib/db/schema'

/** Repositories hold every SQL statement; who is writing is the caller's job. */
export async function insertAiReport(
  values: typeof aiReports.$inferInsert,
): Promise<AiReport> {
  const rows = await db.insert(aiReports).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert ai report')
  return row
}

export async function findLatestAiReport(
  userId: string,
  kind: 'weekly' | 'monthly',
  periodStart: string,
): Promise<AiReport | null> {
  const rows = await db
    .select()
    .from(aiReports)
    .where(
      and(
        eq(aiReports.userId, userId),
        eq(aiReports.kind, kind),
        eq(aiReports.periodStart, periodStart),
      ),
    )
    .orderBy(desc(aiReports.createdAt))
    .limit(1)

  return rows[0] ?? null
}

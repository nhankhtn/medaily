import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { insights } from '@/lib/db/schema'
import type { Insight } from '@/lib/db/schema'
import type { ISODate } from '@/lib/dates'
import type { GeneratedInsight } from '@/lib/insights/rules'

/**
 * Generated insights are persisted keyed by `dedupe_key` so that dismissing or
 * snoozing one survives the next regeneration (spec 18.4). `onConflictDoNothing`
 * is deliberate: re-running the rules must not resurrect a dismissed card.
 */
export async function recordInsights(
  userId: string,
  generated: GeneratedInsight[],
): Promise<void> {
  if (generated.length === 0) return
  await db
    .insert(insights)
    .values(
      generated.map((insight) => ({
        userId,
        kind: insight.kind,
        severity: insight.severity,
        dedupeKey: insight.dedupeKey,
        payload: insight.payload,
      })),
    )
    .onConflictDoNothing({ target: [insights.userId, insights.dedupeKey] })
}

export async function findActiveInsights(
  userId: string,
  dedupeKeys: string[],
  today: ISODate,
): Promise<Insight[]> {
  if (dedupeKeys.length === 0) return []
  return db
    .select()
    .from(insights)
    .where(
      and(
        eq(insights.userId, userId),
        inArray(insights.dedupeKey, dedupeKeys),
        isNull(insights.dismissedAt),
        or(isNull(insights.snoozedUntil), sql`${insights.snoozedUntil} <= ${today}`),
      ),
    )
    .orderBy(desc(insights.generatedAt))
}

export async function dismissInsight(userId: string, insightId: string): Promise<void> {
  await db
    .update(insights)
    .set({ dismissedAt: new Date() })
    .where(and(eq(insights.userId, userId), eq(insights.id, insightId)))
}

export async function snoozeInsight(
  userId: string,
  insightId: string,
  until: ISODate,
): Promise<void> {
  await db
    .update(insights)
    .set({ snoozedUntil: until })
    .where(and(eq(insights.userId, userId), eq(insights.id, insightId)))
}

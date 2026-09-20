import { cache } from 'react'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { aiReports } from '@/lib/db/schema'
import type { AiReport } from '@/lib/db/schema'
import type { ReviewMetricsSnapshot } from '@/lib/types'
import { ServiceError } from '@/server/service-client'
import { aiClient, aiServiceConfigured } from '@/server/services/ai-service'

/**
 * Spec 35 §14 — opt-in, off unless the service is configured, and grounded
 * strictly in the aggregates handed to it. Only the numbers below ever leave
 * the machine: no notes, no journal entries, no names.
 *
 * A long piece of writing rather than an extraction, so it is the one thing
 * asked of a different provider. Which one is no longer this app's business.
 */
const TIMEOUT_MS = 180_000

export type AiContext = {
  period: 'weekly' | 'monthly'
  periodStart: string
  periodEnd: string
  locale: 'en' | 'vi'
  metrics: ReviewMetricsSnapshot
  previousMetrics: ReviewMetricsSnapshot | null
  insights: { kind: string; values: Record<string, string | number> }[]
}

/**
 * The writing is `medaily-ai`'s — the prompt lives there, at
 * `src/services/report.ts`, with every other prompt, and so does the
 * Anthropic key. What comes back is the review plus which model wrote it and
 * which prompt it came from, because both are filed alongside it here: a
 * change of prompt has to be visible in the table afterwards.
 *
 * `disabled` rather than a failure when that deploy has no Anthropic key.
 * Gemini and Anthropic are configured separately over there, so everything
 * else can work while this one thing does not.
 */
export class NarrativeDisabledError extends Error {}

export async function generateNarrative(
  context: AiContext,
): Promise<{ text: string; model: string; promptVersion: string }> {
  try {
    return await aiClient('report', TIMEOUT_MS).request('/api/report/narrative', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(context),
    })
  } catch (error) {
    if (error instanceof ServiceError && error.status === 503) {
      throw new NarrativeDisabledError('the service has no key for this')
    }
    throw error
  }
}

export async function saveReport(values: {
  kind: 'weekly' | 'monthly'
  periodStart: string
  periodEnd: string
  contentMd: string
  model: string
  promptVersion: string
}): Promise<AiReport> {
  const rows = await db
    .insert(aiReports)
    .values({
      userId: await getCurrentUserId(),
      kind: values.kind,
      periodStart: values.periodStart,
      periodEnd: values.periodEnd,
      model: values.model,
      promptVersion: values.promptVersion,
      contentMd: values.contentMd,
    })
    .returning()

  const row = rows[0]
  if (!row) throw new Error('failed to save report')
  return row
}

export const findLatestReport = cache(
  async (kind: 'weekly' | 'monthly', periodStart: string): Promise<AiReport | null> => {
    const rows = await db
      .select()
      .from(aiReports)
      .where(
        and(
          eq(aiReports.userId, await getCurrentUserId()),
          eq(aiReports.kind, kind),
          eq(aiReports.periodStart, periodStart),
        ),
      )
      .orderBy(desc(aiReports.createdAt))
      .limit(1)

    return rows[0] ?? null
  },
)

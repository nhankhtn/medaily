'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { addDays, addMonthsISO } from '@/lib/dates'
import { getSettings } from '@/server/services/settings'
import { aiEnabled, generateNarrative, saveReport } from '@/server/services/ai'
import { getReviewView } from '@/server/services/reviews'
import { getDashboardData } from '@/server/services/dashboard'

export type GenerateResult =
  | { ok: true; contentMd: string }
  | { ok: false; error: 'disabled' | 'invalid_input' | 'failed'; detail?: string }

/**
 * Spec 29 — nothing is sent anywhere unless the user configured a key, and the
 * payload is limited to period aggregates plus rule-generated observations.
 */
export async function generateReview(input: unknown): Promise<GenerateResult> {
  if (!aiEnabled()) return { ok: false, error: 'disabled' }

  const parsed = z
    .object({ period: z.enum(['weekly', 'monthly']), key: z.string().min(4).max(10) })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }

  const settings = await getSettings()
  const view = await getReviewView(parsed.data.period, parsed.data.key)

  const previousKey =
    parsed.data.period === 'weekly'
      ? addDays(parsed.data.key, -7)
      : addMonthsISO(parsed.data.key, -1)
  const previousView = await getReviewView(parsed.data.period, previousKey)
  const dashboard = await getDashboardData()

  try {
    const contentMd = await generateNarrative({
      period: parsed.data.period,
      periodStart: view.range.start,
      periodEnd: view.range.end,
      locale: settings.locale,
      metrics: view.metrics,
      previousMetrics: previousView.metrics,
      insights: dashboard.insights.map((insight) => ({
        kind: insight.kind,
        values: insight.payload.values,
      })),
    })

    await saveReport({
      kind: parsed.data.period,
      periodStart: view.range.start,
      periodEnd: view.range.end,
      contentMd,
    })

    revalidatePath('/reviews')
    return { ok: true, contentMd }
  } catch (error) {
    return {
      ok: false,
      error: 'failed',
      detail: error instanceof Error ? error.message : undefined,
    }
  }
}

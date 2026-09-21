import { cache } from 'react'
import { getLocale } from 'next-intl/server'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { addDays, addMonthsISO } from '@/lib/dates'
import type { AiReport } from '@/lib/db/schema'
import type { ReviewMetricsSnapshot } from '@/lib/types'
import { isLocale } from '@/i18n/config'
import { insertAiReport, findLatestAiReport } from '@/server/repositories/ai'
import { ServiceError } from '@/server/service-client'
import { aiClient, aiServiceConfigured } from '@/server/services/ai-service'
import { getDashboardData } from '@/server/services/dashboard'
import { getReviewView } from '@/server/services/reviews'
import { getSettings } from '@/server/services/settings'

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
 * `src/services/report.ts`, with every other prompt, on the same Gemini chain.
 * What comes back is the review plus which model wrote it and which prompt it
 * came from, because both are filed alongside it here: a change of prompt has
 * to be visible in the table afterwards.
 *
 * `disabled` rather than a failure when that deploy has no Gemini key.
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
  return insertAiReport({
    userId: await getCurrentUserId(),
    kind: values.kind,
    periodStart: values.periodStart,
    periodEnd: values.periodEnd,
    model: values.model,
    promptVersion: values.promptVersion,
    contentMd: values.contentMd,
  })
}

export const findLatestReport = cache(
  async (kind: 'weekly' | 'monthly', periodStart: string): Promise<AiReport | null> =>
    findLatestAiReport(await getCurrentUserId(), kind, periodStart),
)

/**
 * Spec 29 — assemble the period aggregates, ask `medaily-ai` to write, and
 * file the result. The action only validates input and revalidates the page.
 */
export async function generatePeriodNarrative(
  period: 'weekly' | 'monthly',
  key: string,
): Promise<string> {
  if (!aiServiceConfigured()) {
    throw new NarrativeDisabledError('AI_SERVICE is not configured')
  }

  const [settings, uiLocale] = await Promise.all([getSettings(), getLocale()])
  const view = await getReviewView(period, key)

  const previousKey = period === 'weekly' ? addDays(key, -7) : addMonthsISO(key, -1)
  const previousView = await getReviewView(period, previousKey)
  const dashboard = await getDashboardData()

  // Prefer the locale the UI is showing now (cookie), not only the settings
  // row — so a switcher change is what the model writes in.
  const locale = isLocale(uiLocale) ? uiLocale : settings.locale

  const review = await generateNarrative({
    period,
    periodStart: view.range.start,
    periodEnd: view.range.end,
    locale,
    metrics: view.metrics,
    previousMetrics: previousView.metrics,
    insights: dashboard.insights.map((insight) => ({
      kind: insight.kind,
      values: insight.payload.values,
    })),
  })

  await saveReport({
    kind: period,
    periodStart: view.range.start,
    periodEnd: view.range.end,
    contentMd: review.text,
    model: review.model,
    promptVersion: review.promptVersion,
  })

  return review.text
}

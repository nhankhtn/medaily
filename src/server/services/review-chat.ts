import { db } from '@/lib/db'
import { aiReports } from '@/lib/db/schema'
import type { ISODate } from '@/lib/dates'
import type { ReviewMetricsSnapshot } from '@/lib/types'
import { aiClient } from '@/server/services/ai-service'
import { getDashboardData } from '@/server/services/dashboard'
import { getReviewView, previousKey } from '@/server/services/reviews'
import { getSettings } from '@/server/services/settings'

/**
 * A conversation about a period of the user's own life.
 *
 * Grounded in that period's aggregates plus the lines the user wrote in their
 * own daily logs — the wins, the problems, the lessons. Journal entries, notes
 * and other people's names stay on the machine.
 *
 * The gathering is this app's and the reading is `medaily-ai`'s: the prompt
 * lives there, at `src/services/review.ts`, with every other prompt. The
 * thread does not — a review keyed only by its period would resume a
 * month-old argument the next time the panel opened, so what is on screen is
 * sent back with each turn and nothing is stored under a thread id.
 *
 * Kept in step with the version the prompt is filed under over there; it is
 * written onto every saved turn, so a change of prompt is visible in the
 * table afterwards.
 */
export const PROMPT_VERSION = 'review-chat-v1'

const TIMEOUT_MS = 90_000

export type ReviewContext = {
  locale: 'en' | 'vi'
  period: 'weekly' | 'monthly'
  range: { start: ISODate; end: ISODate }
  reviewing: ReviewMetricsSnapshot
  comparedWith: ReviewMetricsSnapshot | null
  observations: { kind: string; values: Record<string, string | number> }[]
  /** The person's own lines from this period's daily logs. */
  writtenByYou: { wins: string[]; problems: string[]; lessons: string[] }
}

export async function buildContext(
  period: 'weekly' | 'monthly',
  key: string,
): Promise<ReviewContext> {
  const settings = await getSettings()
  const [view, previous, dashboard] = await Promise.all([
    getReviewView(period, key),
    getReviewView(period, previousKey(period, key)),
    getDashboardData(),
  ])

  return {
    locale: settings.locale,
    period,
    range: view.range,
    reviewing: view.metrics,
    comparedWith: previous.metrics,
    observations: dashboard.insights.map((insight) => ({
      kind: insight.kind,
      values: insight.payload.values,
    })),
    writtenByYou: {
      wins: view.suggestedWins,
      problems: view.suggestedProblems,
      lessons: view.lessonGroups.flatMap((group) => group.lessons.map((lesson) => lesson.title)),
    },
  }
}

/**
 * The conversation as it stands on screen. It is not reloaded from the table:
 * a thread keyed only by period would replay every exchange ever had about
 * that week, so opening the panel tomorrow would resume a month-old argument
 * instead of starting a review.
 */
export type Exchange = { question: string; answer: string }

export async function ask(input: {
  context: ReviewContext
  history: Exchange[]
  message: string
  intent: 'open' | 'suggest' | 'follow_up'
}): Promise<{ text: string; model: string }> {
  return aiClient('review', TIMEOUT_MS).request('/api/review/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
}

/**
 * Rewrites the answer already on screen in another language.
 *
 * Deliberately given no period data: translating is a transformation of text
 * that already exists, so re-deriving the aggregates would spend a database
 * round trip and a large payload to produce a *different* review rather than
 * the same one in another language.
 */
export async function translate(input: {
  text: string
  target: 'en' | 'vi'
}): Promise<{ text: string; model: string }> {
  return aiClient('review', TIMEOUT_MS).request('/api/review/translate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function saveTurn(values: {
  userId: string
  kind: 'weekly' | 'monthly' | 'question'
  range: { start: ISODate; end: ISODate }
  question: string
  contentMd: string
  model: string
}): Promise<void> {
  await db.insert(aiReports).values({
    userId: values.userId,
    kind: values.kind,
    periodStart: values.range.start,
    periodEnd: values.range.end,
    question: values.question,
    model: values.model,
    promptVersion: PROMPT_VERSION,
    contentMd: values.contentMd,
  })
}

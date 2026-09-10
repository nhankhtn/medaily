import Anthropic from '@anthropic-ai/sdk'
import { cache } from 'react'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { aiReports } from '@/lib/db/schema'
import type { AiReport } from '@/lib/db/schema'
import type { ReviewMetricsSnapshot } from '@/lib/types'

/**
 * Spec 35 §14 — opt-in, off unless a key is configured, and grounded strictly in
 * the aggregates handed to it. Only the numbers below ever leave the machine:
 * no notes, no journal entries, no names.
 */
export const AI_MODEL = 'claude-opus-5'
export const PROMPT_VERSION = 'v1'

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

export type AiContext = {
  period: 'weekly' | 'monthly'
  periodStart: string
  periodEnd: string
  locale: 'en' | 'vi'
  metrics: ReviewMetricsSnapshot
  previousMetrics: ReviewMetricsSnapshot | null
  insights: { kind: string; values: Record<string, string | number> }[]
}

const SYSTEM_PROMPT = `You are a careful personal-analytics assistant inside a private life-tracking app.

You will receive aggregate numbers for one period, the previous period for comparison, and a list of rule-generated observations. Write a short review of the period.

Hard rules:
- Ground every statement in the numbers provided. Never invent a number, a habit, an event or a cause.
- These are associations recorded on the same days. Never claim one metric produced, caused, improved, boosted or led to another. Describe what co-occurred, and attach the numbers.
- Say plainly when the data is thin (few logged days) rather than reading a trend into it.
- No praise inflation and no scolding. This is an operational signal, not a judgement of the person.
- Do not suggest medical, psychiatric or pharmacological interventions.

Format: GitHub-flavoured Markdown, at most 250 words, in this shape:
1. One paragraph on how the period went, with the two or three numbers that matter.
2. "What changed" — up to three bullets comparing against the previous period.
3. "Worth watching" — up to three bullets, each an observation plus the number behind it.
4. One short closing line naming a single concrete thing to try next period.

Write in ENGLISH if locale is "en" and in VIETNAMESE if locale is "vi".`

export async function generateNarrative(context: AiContext): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    // Adaptive thinking: the model decides how much reasoning this needs.
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    messages: [
      {
        role: 'user',
        content: `Here is the data. Return only the review.\n\n${JSON.stringify(context, null, 2)}`,
      },
    ],
  })

  if (response.stop_reason === 'refusal') {
    throw new Error('the model declined to answer this request')
  }

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

export async function saveReport(values: {
  kind: 'weekly' | 'monthly'
  periodStart: string
  periodEnd: string
  contentMd: string
}): Promise<AiReport> {
  const rows = await db
    .insert(aiReports)
    .values({
      userId: await getCurrentUserId(),
      kind: values.kind,
      periodStart: values.periodStart,
      periodEnd: values.periodEnd,
      model: AI_MODEL,
      promptVersion: PROMPT_VERSION,
      contentMd: values.contentMd,
    })
    .returning()

  const row = rows[0]
  if (!row) throw new Error('failed to save report')
  return row
}

export const findLatestReport = cache(async (
  kind: 'weekly' | 'monthly',
  periodStart: string,
): Promise<AiReport | null> => {
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
})

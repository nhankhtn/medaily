'use server'

import { z } from 'zod'
import { log } from '@/lib/log'
import { today as todayOf, type ISODate } from '@/lib/dates'
import { classify } from '@/lib/reviews/intent'
import { parsePeriodPhrase } from '@/lib/reviews/period-phrase'
import { geminiEnabled } from '@/server/services/gemini'
import {
  ask,
  buildContext,
  saveTurn,
  translate,
  type Exchange,
} from '@/server/services/review-chat'
import { rangeOf } from '@/server/services/reviews'
import { dayContextOf, getSettings } from '@/server/services/settings'
import { createLimit } from '@/lib/rate-limit'

/**
 * Spec 35 §14 — a conversation about the user's own period, grounded in that
 * period's aggregates and the lines they wrote themselves. Opt-in, and off
 * entirely without a key.
 *
 * A conversation, so a little tighter: eight messages a minute.
 */
const questions = createLimit({ capacity: 8, refillMs: 60 * 1000 })

export type ReviewChatResult =
  | {
      ok: true
      answer: string
      /** Named back so a misread phrase is visible rather than silent. */
      period: 'weekly' | 'monthly'
      /** The UI names the period itself, so the dates are formatted per locale. */
      range: { start: ISODate; end: ISODate }
      /** True on the first message of a period, so the UI can say it opened one. */
      opened: boolean
    }
  | { ok: false; error: 'disabled' | 'invalid_input' | 'rate_limited' | 'failed' }

export async function askReview(input: unknown): Promise<ReviewChatResult> {
  if (!geminiEnabled()) return { ok: false, error: 'disabled' }

  const parsed = z
    .object({
      message: z.string().trim().min(2).max(1000),
      /*
       * Sent once the conversation has a period, so a follow-up like "tháng
       * này thì sao" is a question about the period on screen rather than a
       * silent jump to a different one.
       */
      period: z.enum(['weekly', 'monthly']).optional(),
      key: z.string().min(4).max(10).optional(),
      /*
       * The panel's own transcript. Capped because it is replayed to the model
       * on every turn, and because it arrives from the browser.
       */
      history: z
        .array(z.object({ question: z.string().max(1000), answer: z.string().max(8000) }))
        .max(12)
        .default([]),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }

  const settings = await getSettings()
  if (!questions.take(settings.userId).allowed) return { ok: false, error: 'rate_limited' }

  const history: Exchange[] = parsed.data.history
  const lastAnswer = history.at(-1)?.answer ?? null

  /*
   * Decided before anything is sent: "dịch sang tiếng Việt" is a rewrite of
   * the answer on screen, and running it through the reviewer would rebuild
   * the whole period and hand back a different review in another language
   * instead of the same one translated.
   */
  const intent = classify(parsed.data.message, {
    hasAnswer: lastAnswer !== null,
    locale: settings.locale,
  })

  // Translating needs the period only to file the row; it never reads it, so a
  // conversation somehow without one falls through to the reviewer instead.
  const pinned =
    parsed.data.period && parsed.data.key
      ? { period: parsed.data.period, key: parsed.data.key }
      : null

  const ref =
    pinned ??
    parsePeriodPhrase(parsed.data.message, todayOf(dayContextOf(settings)), settings.weekStart)

  const range = rangeOf(ref.period, ref.key)

  try {
    const { text, model } =
      intent.kind === 'translate' && lastAnswer && pinned
        ? await translate({ text: lastAnswer, target: intent.target })
        : await ask({
            context: await buildContext(ref.period, ref.key),
            history,
            message: parsed.data.message,
            intent: intent.kind === 'translate' ? 'follow_up' : intent.kind,
          })

    await saveTurn({
      userId: settings.userId,
      // The first turn of a period is that period's review; the rest are questions.
      kind: history.length === 0 ? ref.period : 'question',
      range,
      question: parsed.data.message,
      contentMd: text,
      model,
    })

    return {
      ok: true,
      answer: text,
      period: ref.period,
      range,
      opened: history.length === 0,
    }
  } catch (error) {
    await log.error('reviews', 'could not answer', error)
    return { ok: false, error: 'failed' }
  }
}

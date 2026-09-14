import { db } from '@/lib/db'
import { aiReports } from '@/lib/db/schema'
import type { ISODate } from '@/lib/dates'
import type { ReviewMetricsSnapshot } from '@/lib/types'
import { generateText, type Turn } from '@/server/services/gemini'
import { getDashboardData } from '@/server/services/dashboard'
import { getReviewView, previousKey } from '@/server/services/reviews'
import { getSettings } from '@/server/services/settings'

export const PROMPT_VERSION = 'review-chat-v1'

/**
 * A conversation about a period of the user's own life.
 *
 * Grounded in that period's aggregates plus the lines the user wrote in their
 * own daily logs — the wins, the problems, the lessons. Journal entries, notes
 * and other people's names stay on the machine.
 *
 * The model is told to describe, not prescribe: advice arrives only when it is
 * asked for, because an unrequested lecture attached to every number is exactly
 * what makes a tracker unpleasant to open (spec 18.3).
 */
const SYSTEM_PROMPT = `You are a careful personal-analytics assistant inside a private life-tracking app. You are talking to the person whose data this is, about one period of their own life.

You will be given that period's aggregate numbers, the previous period for comparison, rule-generated observations, and the lines the person wrote themselves in their daily logs.

Hard rules:
- Ground every statement in what you were given. Never invent a number, a habit, an event or a cause.
- These are things recorded on the same days. Never say one metric produced, caused, improved, boosted or led to another. Say what co-occurred, and attach the numbers.
- Say plainly when the data is thin. Four logged days is four logged days, not a trend.
- No praise inflation and no scolding. This is an operational signal, not a verdict on the person.
- Never suggest medical, psychiatric or pharmacological interventions, and never diagnose.
- Quote the person's own words when they are the point. They wrote them; reflect them back rather than paraphrasing them into blandness.

Advice: do NOT offer suggestions, plans or things to try unless the person asks for them in their message. When they do ask, give at most three, each tied to a number or a line they wrote, each small enough to start this week.

Length: answer in at most 200 words unless asked for more. GitHub-flavoured Markdown. No headings on a short answer; use short paragraphs and, where a list genuinely helps, bullets.`

/*
 * Stated as an instruction rather than left for the model to read off a
 * `locale` field in the data: buried in the JSON it was ignored, and the reply
 * came back in English to a Vietnamese user.
 */
const LANGUAGE: Record<'en' | 'vi', string> = {
  en: 'Reply in English.',
  vi: 'Reply in Vietnamese. Write what a Vietnamese speaker would actually say, not a translation of an English sentence. No administrative vocabulary.',
}

function systemPromptFor(locale: 'en' | 'vi'): string {
  return `${SYSTEM_PROMPT}\n\n${LANGUAGE[locale]}`
}

/*
 * Named for what each part is, not for the variable it came from. With
 * `metrics` and `previousMetrics` side by side the model described the wrong
 * one — reporting an empty comparison week as though it were the week asked
 * about — so the subject is now spelled out in the prose above the data too.
 */
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

/*
 * What the first message of a period actually asks for. On its own, "Tuần
 * trước" is a phrase rather than a question, and the model answered it with a
 * fragment; the shape of a review is stated here instead.
 */
const OPENING_REQUEST = [
  'Write the review of this period:',
  '- how it went, with the two or three numbers that matter',
  '- what changed against the comparison period',
  '- what is worth watching, each point with its number',
  'If I wrote wins, problems or lessons, work them in and quote them.',
  'End with nothing prescriptive — no advice unless I ask for it.',
].join('\n')

/**
 * The conversation as it stands on screen. It is not reloaded from the table:
 * a thread keyed only by period would replay every exchange ever had about
 * that week, so opening the panel tomorrow would resume a month-old argument
 * instead of starting a review.
 */
export type Exchange = { question: string; answer: string }

/**
 * Rewrites the answer already on screen in another language.
 *
 * Deliberately given no period data: translating is a transformation of text
 * that already exists, so re-deriving the aggregates would spend a database
 * round trip and a large payload to produce a *different* review rather than
 * the same one in another language.
 */
const TRANSLATE_PROMPT = `You translate one message from a personal-analytics assistant.

Return only the translation. Keep the Markdown, keep every number, date and quoted line exactly as it is — a quoted line the person wrote themselves stays in the language they wrote it in. Do not summarise, add, explain or comment.

Write what a native speaker would say, not a word-for-word rendering.`

export async function translate({
  text,
  target,
}: {
  text: string
  target: 'en' | 'vi'
}): Promise<{ text: string; model: string }> {
  return generateText({
    systemInstruction: `${TRANSLATE_PROMPT}\n\nTranslate into ${target === 'vi' ? 'VIETNAMESE' : 'ENGLISH'}.`,
    turns: [{ role: 'user', text }],
  })
}

export async function ask({
  context,
  history,
  message,
  intent,
}: {
  context: ReviewContext
  history: Exchange[]
  message: string
  intent: 'open' | 'suggest' | 'follow_up'
}): Promise<{ text: string; model: string }> {
  const turns: Turn[] = [
    // The data goes in the first user turn rather than the system prompt, so a
    // long conversation keeps re-sending the same grounded facts alongside it.
    {
      role: 'user',
      text: [
        `The period under review is ${context.range.start} to ${context.range.end} (${context.period}).`,
        'Everything under "comparedWith" is the period immediately before it, given only for contrast. Never describe it as though it were the period under review.',
        '',
        JSON.stringify(context, null, 2),
      ].join('\n'),
    },
    { role: 'model', text: 'Understood. What would you like to know about it?' },
  ]

  for (const exchange of history) {
    turns.push({ role: 'user', text: exchange.question })
    turns.push({ role: 'model', text: exchange.answer })
  }
  const REQUEST: Record<'open' | 'suggest' | 'follow_up', string> = {
    open: `\n\n${OPENING_REQUEST}`,
    // Stated here rather than left to the wording of the question, so "gợi ý"
    // and "tôi nên làm gì" both lift the same rule in the system prompt.
    suggest:
      '\n\n(I am asking for advice. At most three, each tied to a number or a line I wrote, each small enough to start this week.)',
    follow_up: '',
  }
  turns.push({ role: 'user', text: `${message}${REQUEST[intent]}` })

  return generateText({ systemInstruction: systemPromptFor(context.locale), turns })
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

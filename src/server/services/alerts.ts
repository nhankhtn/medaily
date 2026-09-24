import { createGate } from '@/lib/alerts/gate'
import { log } from '@/lib/log'
import {
  reportKey,
  reportText,
  supportText,
  type ErrorReport,
  type SupportMessage,
} from '@/lib/alerts/report'
import { env } from '@/lib/env'

/**
 * Tells a Telegram chat that something broke.
 *
 * Off unless both variables are set, like every other optional service here.
 * Set them on the deploy rather than in `.env.local`, or every typo on your own
 * machine buzzes your phone.
 *
 * Plain `fetch` — one POST to one endpoint does not earn a dependency. It is
 * deliberately edge-safe: `onRequestError` runs in whichever runtime threw.
 */
const ENDPOINT = 'https://api.telegram.org'
const TIMEOUT_MS = 4_000

const gate = createGate()

/**
 * A separate gate, and a much tighter one. The error gate exists to turn a
 * failing route's flood into a trickle; this one guards a path a stranger can
 * reach on purpose, and the same person sending twenty notes an hour is not a
 * person with twenty problems.
 */
const supportGate = createGate({ gapMs: 30_000, maxPerHour: 30 })

export function alertsEnabled(): boolean {
  return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID)
}

/**
 * Never throws and never rejects. Reporting a failure must not become a second
 * failure inside the handler that was already failing.
 */
export async function reportError(report: ErrorReport): Promise<'sent' | 'skipped' | 'failed'> {
  if (!alertsEnabled()) return 'skipped'
  if (!gate.allow(reportKey(report), Date.now())) return 'skipped'

  return post(reportText(report), 'alerts')
}

/**
 * The one place that talks to Telegram. Both callers already decided they are
 * allowed to send; this only carries the text and never throws.
 */
async function post(text: string, scope: string): Promise<'sent' | 'failed'> {
  try {
    const response = await fetch(`${ENDPOINT}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })

    if (!response.ok) {
      // The body carries Telegram's own reason — a wrong chat id, a bot that
      // was never started. Worth seeing once, in the console, not on the phone.
      await log.error(
        scope,
        'telegram refused the message:',
        response.status,
        await response.text(),
      )
      return 'failed'
    }
    return 'sent'
  } catch (error) {
    await log.error(scope, 'could not reach telegram', error)
    return 'failed'
  }
}

/**
 * Passes on a note somebody wrote from inside the app.
 *
 * Shares the pipe with error reports — one bot, one chat, one place to look —
 * and nothing else. Silent when the chat is not configured, so the button that
 * calls this is never offered in a deploy that has nowhere to send it.
 *
 * Like `reportError`, it never throws: a support form that returns an error
 * because the support channel is down is the worst moment to be unhelpful.
 */
export async function sendSupportMessage(
  message: SupportMessage,
): Promise<'sent' | 'skipped' | 'failed'> {
  if (!alertsEnabled()) return 'skipped'
  // Keyed by sender rather than by content: two different questions from one
  // person in one minute is still one person typing fast.
  if (!supportGate.allow(`support|${message.from ?? message.replyTo ?? '-'}`, Date.now())) {
    return 'skipped'
  }

  return post(supportText(message), 'support')
}

/** What deploy this is, for the first line of the message. */
export function environmentName(): string {
  return process.env.VERCEL_ENV ?? env.NODE_ENV
}

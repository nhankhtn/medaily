import { createGate } from '@/lib/alerts/gate'
import { log } from '@/lib/log'
import { reportKey, reportText, type ErrorReport } from '@/lib/alerts/report'
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

  try {
    const response = await fetch(`${ENDPOINT}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: reportText(report),
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })

    if (!response.ok) {
      // The body carries Telegram's own reason — a wrong chat id, a bot that
      // was never started. Worth seeing once, in the console, not on the phone.
      await log.error('alerts', 'telegram refused the message:', response.status, await response.text())
      return 'failed'
    }
    return 'sent'
  } catch (error) {
    await log.error('alerts', 'could not reach telegram', error)
    return 'failed'
  }
}

/** What deploy this is, for the first line of the message. */
export function environmentName(): string {
  return process.env.VERCEL_ENV ?? env.NODE_ENV
}

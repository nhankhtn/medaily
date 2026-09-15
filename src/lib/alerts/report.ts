import { redact } from '@/lib/alerts/redact'

/** Telegram refuses a `sendMessage` body longer than this. */
export const TELEGRAM_LIMIT = 4096

const STACK_LINES = 6

export type ErrorReport = {
  /** Where it was caught: a render, a server action, the browser. */
  source: 'render' | 'route' | 'action' | 'proxy' | 'browser'
  message: string
  /** Which deploy — so a local run is never mistaken for production. */
  environment: string
  digest?: string | null
  /** The id the console lines for this request also carry. */
  requestId?: string | null
  method?: string | null
  path?: string | null
  stack?: string | null
}

/**
 * What two reports must share to count as the same incident. Deliberately not
 * the stack: the same failure from two routes is two things worth knowing,
 * the same failure fifty times in a minute is one.
 */
export function reportKey(report: ErrorReport): string {
  return [report.source, report.path ?? '-', report.message].join('|')
}

/**
 * The chat message. Plain text on purpose — Telegram's Markdown needs a dozen
 * characters escaped, and an exception message is exactly where they turn up.
 */
export function reportText(report: ErrorReport): string {
  const where = [report.method, report.path].filter(Boolean).join(' ')
  const head = `⚠️ medaily (${report.environment})`

  const lines = [
    head,
    [report.source, where].filter(Boolean).join(' · '),
    '',
    redact(report.message) || 'an error with no message',
  ]

  const marks = [
    report.requestId ? `req ${report.requestId}` : null,
    report.digest ? `digest ${report.digest}` : null,
  ].filter(Boolean)
  if (marks.length) lines.push(marks.join('  ·  '))

  const stack = report.stack
    ?.split('\n')
    .slice(1, 1 + STACK_LINES)
    .map((line) => line.trim())
    .filter(Boolean)

  if (stack?.length) lines.push('', redact(stack.join('\n')))

  return truncate(lines.join('\n'), TELEGRAM_LIMIT)
}

export function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text
  return `${text.slice(0, limit - 1)}…`
}

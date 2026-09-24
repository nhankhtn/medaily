import { redact } from '@/lib/alerts/redact'

/** Telegram refuses a `sendMessage` body longer than this. */
export const TELEGRAM_LIMIT = 4096

const STACK_LINES = 6

export type ErrorReport = {
  /**
   * Where it was caught: a render, a server action, the browser. `handled` is
   * the odd one out — a failure the code caught and dealt with itself, which
   * never reaches Next's error hook and so has to report itself.
   */
  source: 'render' | 'route' | 'action' | 'proxy' | 'browser' | 'handled'
  /** For a handled failure, the part of the app that logged it. */
  scope?: string | null
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
 * Someone writing in from inside the app.
 *
 * A type of its own rather than an `ErrorReport` with prose in `message`: the
 * two are read differently at the other end — a crash is triaged, a person is
 * answered — and they are throttled by different rules. Sharing the shape
 * would mean one of them wearing fields that never apply.
 */
export type SupportMessage = {
  /** What they wrote. The only field the app did not fill in itself. */
  body: string
  /** Where to answer. Absent when whoever wrote it was not signed in. */
  replyTo?: string | null
  /** Who, if there was a session: a name is easier to answer than an id. */
  from?: string | null
  /** Which page they were on when they gave up and wrote. */
  path?: string | null
  environment: string
  requestId?: string | null
}

/**
 * The chat message for a support note.
 *
 * `redact` runs over the body for the same reason it runs over an exception:
 * a person describing a problem pastes whatever was on their screen, and that
 * is sometimes a connection string.
 */
export function supportText(message: SupportMessage): string {
  const who = [message.from, message.replyTo].filter(Boolean).join(' · ')

  const lines = [
    `💬 medaily (${message.environment})`,
    [who || 'not signed in', message.path].filter(Boolean).join(' · '),
    '',
    redact(message.body),
  ]

  if (message.requestId) lines.push('', `req ${message.requestId}`)

  return truncate(lines.join('\n'), TELEGRAM_LIMIT)
}

/**
 * What two reports must share to count as the same incident. Deliberately not
 * the stack: the same failure from two routes is two things worth knowing,
 * the same failure fifty times in a minute is one.
 */
export function reportKey(report: ErrorReport): string {
  return [report.source, report.scope ?? report.path ?? '-', report.message].join('|')
}

/**
 * The chat message. Plain text on purpose — Telegram's Markdown needs a dozen
 * characters escaped, and an exception message is exactly where they turn up.
 */
export function reportText(report: ErrorReport): string {
  // A handled failure knows its scope and not its route; an uncaught one is
  // the other way round.
  const where = [report.scope, report.method, report.path].filter(Boolean).join(' ')
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

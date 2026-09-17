import { headers } from 'next/headers'
import { after } from 'next/server'
import { REQUEST_ID_HEADER } from '@/lib/request-id'

/**
 * Server logging that always says which request it came from.
 *
 * `[finance] [req 3f9a1c07] could not parse the note: …`
 *
 * The id is the same one the response header carries and the same one a
 * Telegram alert quotes, so three views of one failure line up.
 */
export async function currentRequestId(): Promise<string | null> {
  try {
    return (await headers()).get(REQUEST_ID_HEADER)
  } catch {
    // Outside a request — a script, a build, a background job. There is no id
    // to report and that is not itself worth reporting.
    return null
  }
}

/**
 * Scopes that must never raise an alert.
 *
 * `alerts` is the reporter itself: it logs when Telegram refuses a message, and
 * alerting on that would try to tell Telegram that Telegram is unreachable.
 */
const SILENT = new Set(['alerts'])

async function write(
  level: 'error' | 'warn',
  scope: string,
  message: string,
  details: unknown[],
): Promise<void> {
  const id = await currentRequestId()
  const prefix = id ? `[${scope}] [req ${id}]` : `[${scope}]`
  console[level](`${prefix} ${message}`, ...details)

  // Warnings are the ordinary noise of a working app — a model falling back to
  // the next one in the chain is a warning. Only errors are worth a phone.
  if (level === 'error' && !SILENT.has(scope)) alert(scope, message, details, id)
}

/**
 * Sends a handled failure to the same Telegram chat as an uncaught one.
 *
 * `instrumentation.ts` sees only what escapes a request, and a failure this app
 * catches and turns into `{ ok: false }` leaves the request looking successful.
 * Those are the ones worth knowing about: the AI said nothing, settings would
 * not load, a sign-in blew up. Without this they lived in a log nobody reads.
 *
 * Only the caught `Error` goes with it. The rest of `details` is whatever the
 * call site found useful — a request body, a parsed note — and that is the
 * user's own writing, which does not belong in a chat message.
 */
function alert(scope: string, message: string, details: unknown[], requestId: string | null): void {
  const cause = details.find((detail): detail is Error => detail instanceof Error)

  const send = async () => {
    try {
      // Imported here rather than at the top: the alert service logs through
      // this module, and at the top that is a cycle.
      const { environmentName, reportError } = await import('@/server/services/alerts')
      await reportError({
        source: 'handled',
        scope,
        environment: environmentName(),
        message: cause ? `${message}: ${cause.message}` : message,
        requestId,
        stack: cause?.stack ?? null,
      })
    } catch {
      // Reporting a failure must never become a second one. The console line
      // above has already been written, which is the part that matters.
    }
  }

  try {
    // The failure has already been handled and the answer is ready to go. The
    // person waiting on it must not also wait on Telegram, so the send happens
    // after the response — which on a serverless platform also keeps the
    // invocation alive long enough to finish it.
    after(send)
  } catch {
    // No response to come after: a script, a build, a background job. Send it
    // inline and let the promise settle on its own.
    void send()
  }
}

export const log = {
  error: (scope: string, message: string, ...details: unknown[]) =>
    write('error', scope, message, details),
  warn: (scope: string, message: string, ...details: unknown[]) =>
    write('warn', scope, message, details),
}

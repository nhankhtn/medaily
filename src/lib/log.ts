import { headers } from 'next/headers'
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

async function write(
  level: 'error' | 'warn',
  scope: string,
  message: string,
  details: unknown[],
): Promise<void> {
  const id = await currentRequestId()
  const prefix = id ? `[${scope}] [req ${id}]` : `[${scope}]`
  console[level](`${prefix} ${message}`, ...details)
}

export const log = {
  error: (scope: string, message: string, ...details: unknown[]) =>
    write('error', scope, message, details),
  warn: (scope: string, message: string, ...details: unknown[]) =>
    write('warn', scope, message, details),
}

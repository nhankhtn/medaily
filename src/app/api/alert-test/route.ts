import { headers } from 'next/headers'
import { REQUEST_ID_HEADER } from '@/lib/request-id'

/**
 * Throws on purpose, so the alert chain can be proved on the deploy that
 * matters rather than hoped about.
 *
 * It sits behind the session check like every other private route, and it
 * touches nothing: the only thing it does is fail.
 *
 * The request id goes in the message deliberately. Alerts are de-duplicated by
 * route and message, so without it a second test within five minutes would be
 * silently swallowed and read as "it stopped working".
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const id = (await headers()).get(REQUEST_ID_HEADER)
  throw new Error(`alert test (req ${id ?? 'no id'})`)
}

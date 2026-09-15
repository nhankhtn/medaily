/**
 * One id per request, stamped by the proxy and carried everywhere after it.
 *
 * It exists so a line in the console, a message on a phone and a failed
 * request in devtools can be matched to each other without guessing from
 * timestamps.
 */
export const REQUEST_ID_HEADER = 'x-request-id'

/** Long enough not to collide in a day's traffic, short enough to read aloud. */
const LENGTH = 8

/**
 * Prefers an id the request already carries, so a trace that starts at a load
 * balancer or at Vercel stays one trace rather than two halves.
 */
export function requestIdFrom(headers: { get(name: string): string | null }): string {
  const given = headers.get(REQUEST_ID_HEADER)
  if (given) return normalize(given)

  // Vercel stamps every request with its own; `::` separates its parts and the
  // last one is what its logs are searched by.
  const vercel = headers.get('x-vercel-id')
  if (vercel) return normalize(vercel.split('::').pop() ?? vercel)

  return newRequestId()
}

export function newRequestId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, LENGTH)
}

/** Whatever arrives is going into log lines, so it is kept short and boring. */
function normalize(value: string): string {
  const safe = value.replace(/[^\w.-]/g, '').slice(0, 64)
  return safe === '' ? newRequestId() : safe
}

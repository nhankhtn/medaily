import type { Snapshot } from './types'
import { describeDevice } from './device'

/**
 * What a sign-in records about the request it arrived on.
 *
 * Only what answers one question: *was that me?* A device that either matches
 * a machine you own or does not, and a place that either matches where you
 * were or does not. Nothing here identifies the request any further — the IP
 * address it was worked out from is never stored, and the user-agent string is
 * summarised before it lands.
 */
export function signInSnapshot(requestHeaders: Headers): Snapshot | null {
  const fields: Snapshot = {}

  const device = describeDevice(requestHeaders.get('user-agent'))
  if (device) fields.device = device

  const location = describeLocation(requestHeaders)
  if (location) fields.location = location

  return Object.keys(fields).length > 0 ? fields : null
}

/**
 * `Hà Nội, VN` — worked out at the edge from the IP, which is why the IP
 * itself never has to be kept.
 *
 * Vercel sets these; nothing else does, so locally and behind any other host
 * this answers `null` and the row simply has no place on it. They are treated
 * as untrusted input even so: a request that reaches the origin directly
 * carries whatever headers its sender wrote, and these go on to be shown to a
 * person as a fact about their own account.
 */
export function describeLocation(requestHeaders: Headers): string | null {
  // Checked at full length, never truncated first: cutting "Vietnam" down to
  // two characters would make it pass as the country code "VI".
  const country = clean(requestHeaders.get('x-vercel-ip-country'), 64)
  if (!country || !/^[A-Za-z]{2}$/.test(country)) return null

  const city = clean(decode(requestHeaders.get('x-vercel-ip-city')), 60)
  return city ? `${city}, ${country.toUpperCase()}` : country.toUpperCase()
}

/** Vercel percent-encodes the city, so `Ho%20Chi%20Minh` arrives as one token. */
function decode(value: string | null): string | null {
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    // Malformed encoding: keep the raw token rather than lose the place.
    return value
  }
}

function clean(value: string | null, max: number): string | null {
  if (!value) return null
  // Control characters and anything that would read as markup or a second
  // header line; this string is rendered back to a person.
  const safe = value.replace(/[\u0000-\u001f<>]/g, '').trim()
  return safe === '' ? null : safe.slice(0, max)
}

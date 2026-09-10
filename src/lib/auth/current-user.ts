import { cookies } from 'next/headers'
import { cache } from 'react'
import { readAuthConfig } from './config'
import { SESSION_COOKIE, verifySession, type SessionPayload } from './session'

/**
 * Spec 29 — the row seeded by migration with a fixed id. It owns everything
 * written while the app was single-user, so the env credential pair and the
 * owner's Google account both resolve to it rather than to a new workspace.
 */
export const OWNER_USER_ID = '00000000-0000-4000-8000-000000000001'

export class UnauthenticatedError extends Error {
  constructor() {
    super('no valid session')
    this.name = 'UnauthenticatedError'
  }
}

/**
 * The session cookie, verified.
 *
 * `proxy.ts` already checked it before routing, but middleware and the React
 * tree share no state, so the signature is checked again here. That is
 * deliberate: trusting a header the middleware set would mean trusting
 * anything upstream that can set the same header. The signature is the only
 * thing worth trusting, and one HMAC over ~120 bytes is cheap.
 *
 * `cache()` makes it once per request no matter how many callers ask.
 */
export const readSession = cache(async (): Promise<SessionPayload | null> => {
  const { secret } = readAuthConfig()
  if (!secret) return null

  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return verifySession(token, secret)
})

/**
 * The user every repository filters by. Throws rather than falling back to an
 * owner id: behind the proxy this cannot fail, and if it ever did, serving
 * someone else's data is far worse than a 500.
 */
export const getCurrentUserId = cache(async (): Promise<string> => {
  const session = await readSession()
  if (!session) throw new UnauthenticatedError()
  return session.uid
})

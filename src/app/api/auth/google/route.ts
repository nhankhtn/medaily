import { NextResponse } from 'next/server'
import { log } from '@/lib/log'
import { z } from 'zod'
import { readAuthConfig, readGoogleConfig } from '@/lib/auth/config'
import { FirebaseVerifyError, verifyFirebaseIdToken } from '@/lib/auth/firebase-verify'
import { sessionCookieOptions, SESSION_COOKIE, signSession } from '@/lib/auth/session'
import { resolveGoogleIdentity } from '@/server/services/auth'
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from '@/i18n/config'
import { clientKey } from '@/lib/client-ip'
import { createLimit } from '@/lib/rate-limit'

/**
 * Exchanges a Firebase ID token for this app's own session cookie.
 *
 * This is the only place a Firebase token is ever verified. Afterwards the
 * token is discarded and every subsequent request is authenticated by the
 * HMAC cookie instead, which is what keeps `proxy.ts` runnable at the edge
 * and free of any dependency on Google being reachable.
 *
 * The route is public (see `PUBLIC_PATHS`) because it is how a visitor
 * becomes authenticated in the first place — the ID token is the credential.
 */
export const runtime = 'nodejs'

const bodySchema = z.object({ idToken: z.string().min(1).max(8192) })

/** Shares the shape of the credential login errors so the form can reuse them. */
type Failure = 'not_configured' | 'invalid_token' | 'not_allowed' | 'rate_limited' | 'server_error'

/**
 * A forged token cannot pass verification, so this exists to bound the cost of
 * someone hammering the endpoint, not to stop a break-in. Looser than the
 * credential login for that reason.
 */
const signIns = createLimit({ capacity: 20, refillMs: 15 * 60 * 1000 })

function fail(error: Failure, status: number, retryAfterMs = 0) {
  const headers: Record<string, string> = { ...nostore }
  // Seconds, and never zero — `Retry-After: 0` reads as "come straight back".
  if (retryAfterMs > 0) headers['retry-after'] = String(Math.max(1, Math.ceil(retryAfterMs / 1000)))
  return NextResponse.json({ ok: false, error }, { status, headers })
}

const nostore = { 'cache-control': 'no-store' } as const

/**
 * What the visitor was reading the sign-in page in, for the starter rows.
 * Read off the header rather than `cookies()`, because this handler takes a
 * plain `Request` and there is no reason for a locale to change that.
 */
function localeOf(headers: Headers): Locale {
  for (const part of (headers.get('cookie') ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name !== LOCALE_COOKIE) continue
    const value = decodeURIComponent(rest.join('='))
    return isLocale(value) ? value : DEFAULT_LOCALE
  }
  return DEFAULT_LOCALE
}

export async function POST(request: Request) {
  const auth = readAuthConfig()
  const google = readGoogleConfig()

  // The cookie is signed with AUTH_SECRET whichever door was used, so Google
  // sign-in still needs it configured.
  if (!google.configured || auth.secret.length < 16) return fail('not_configured', 503)

  const allowance = signIns.take(clientKey(request.headers))
  if (!allowance.allowed) return fail('rate_limited', 429, allowance.retryAfterMs)

  let idToken: string
  try {
    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) return fail('invalid_token', 400)
    idToken = parsed.data.idToken
  } catch {
    return fail('invalid_token', 400)
  }

  try {
    const identity = await verifyFirebaseIdToken(idToken, google.projectId)
    const resolved = await resolveGoogleIdentity(identity, localeOf(request.headers))

    // `not_allowed` and `signup_closed` are reported identically on purpose:
    // telling a stranger which addresses exist is a free directory.
    if (!resolved.ok) return fail('not_allowed', 403)

    const token = await signSession(
      { uid: resolved.userId, sub: identity.email, provider: 'google' },
      auth.secret,
    )

    const response = NextResponse.json(
      { ok: true, created: resolved.created },
      { headers: nostore },
    )
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
    return response
  } catch (error) {
    if (error instanceof FirebaseVerifyError) {
      return fail(error.reason === 'not_configured' ? 'not_configured' : 'invalid_token', 401)
    }
    await log.error('auth/google', 'sign-in failed', error)
    return fail('server_error', 500)
  }
}

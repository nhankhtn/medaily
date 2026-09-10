import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readAuthConfig, readGoogleConfig } from '@/lib/auth/config'
import { FirebaseVerifyError, verifyFirebaseIdToken } from '@/lib/auth/firebase-verify'
import { sessionCookieOptions, SESSION_COOKIE, signSession } from '@/lib/auth/session'
import { resolveGoogleIdentity } from '@/server/services/auth'

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
type Failure =
  | 'not_configured'
  | 'invalid_token'
  | 'not_allowed'
  | 'rate_limited'
  | 'server_error'

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 20
const attempts = new Map<string, { count: number; firstAt: number }>()

/**
 * Per process, like the credential login's limiter (spec 29). A forged token
 * cannot pass verification, so this exists to bound the cost of someone
 * hammering the endpoint, not to stop a break-in.
 */
function rateLimit(key: string): boolean {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || now - entry.firstAt > ATTEMPT_WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now })
    return true
  }
  entry.count += 1
  return entry.count <= MAX_ATTEMPTS
}

function fail(error: Failure, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers: nostore })
}

const nostore = { 'cache-control': 'no-store' } as const

export async function POST(request: Request) {
  const auth = readAuthConfig()
  const google = readGoogleConfig()

  // The cookie is signed with AUTH_SECRET whichever door was used, so Google
  // sign-in still needs it configured.
  if (!google.configured || auth.secret.length < 16) return fail('not_configured', 503)

  const key = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
  if (!rateLimit(key)) return fail('rate_limited', 429)

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
    const resolved = await resolveGoogleIdentity(identity)

    // `not_allowed` and `signup_closed` are reported identically on purpose:
    // telling a stranger which addresses exist is a free directory.
    if (!resolved.ok) return fail('not_allowed', 403)

    const token = await signSession(
      { uid: resolved.userId, sub: identity.email, provider: 'google' },
      auth.secret,
    )

    const response = NextResponse.json({ ok: true, created: resolved.created }, { headers: nostore })
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
    return response
  } catch (error) {
    if (error instanceof FirebaseVerifyError) {
      return fail(error.reason === 'not_configured' ? 'not_configured' : 'invalid_token', 401)
    }
    console.error('[auth/google] sign-in failed:', error)
    return fail('server_error', 500)
  }
}

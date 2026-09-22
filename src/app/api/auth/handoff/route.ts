import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readAuthConfig } from '@/lib/auth/config'
import {
  sessionCookieOptions,
  SESSION_COOKIE,
  signSession,
  verifySession,
} from '@/lib/auth/session'
import { clientKey } from '@/lib/client-ip'
import { createLimit } from '@/lib/rate-limit'
import { log } from '@/lib/log'
import { claimAuthHandoff, createAuthHandoff } from '@/server/services/auth-handoff'

export const runtime = 'nodejs'

const nostore = { 'cache-control': 'no-store' } as const
const claims = createLimit({ capacity: 20, refillMs: 15 * 60 * 1000 })

/**
 * POST { } with an existing session cookie → { code } for the PWA to type.
 * POST { code } → sets the session cookie in this browser (the home-screen app).
 */
export async function POST(request: Request) {
  const auth = readAuthConfig()
  if (auth.secret.length < 16) {
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503, headers: nostore })
  }

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const asClaim = z.object({ code: z.string().min(4).max(12) }).safeParse(body)
  if (asClaim.success) {
    const allowance = claims.take(clientKey(request.headers))
    if (!allowance.allowed) {
      return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429, headers: nostore })
    }

    try {
      const handoff = await claimAuthHandoff(asClaim.data.code)
      if (!handoff) {
        return NextResponse.json({ ok: false, error: 'invalid_code' }, { status: 400, headers: nostore })
      }

      const token = await signSession(
        { uid: handoff.userId, sub: handoff.email, provider: 'google' },
        auth.secret,
      )
      const response = NextResponse.json({ ok: true }, { headers: nostore })
      response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
      return response
    } catch (error) {
      await log.error('auth/handoff', 'claim failed', error)
      return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500, headers: nostore })
    }
  }

  // Mint a code from the Safari session that just finished Google sign-in.
  const jar = await cookies()
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value, auth.secret)
  if (!session || session.provider !== 'google') {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401, headers: nostore })
  }

  try {
    const code = await createAuthHandoff(session.uid, session.sub)
    return NextResponse.json({ ok: true, code }, { headers: nostore })
  } catch (error) {
    await log.error('auth/handoff', 'create failed', error)
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500, headers: nostore })
  }
}

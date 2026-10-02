import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { log } from '@/lib/log'

/**
 * The one check every scheduled route makes before doing anything.
 *
 * Those routes are in `PUBLIC_PATHS` — they never meet the session gate,
 * because the scheduler has no session — so this is the only thing standing
 * between the open internet and a run that touches every account.
 *
 * Answers with the refusal to send back, or nothing when the caller is
 * allowed. `job` only names the run in the log line.
 */
export async function refuseUnlessCron(
  request: Request,
  job: string,
): Promise<NextResponse | null> {
  const userAgent = request.headers.get('user-agent') ?? ''
  const caller = userAgent.startsWith('vercel-cron') ? 'the scheduler' : 'an unknown caller'
  const secret = env.CRON_SECRET
  if (!secret) {
    await log.error('cron', `the ${job} run cannot start: CRON_SECRET is not set`, { userAgent })
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }
  if (!sameSecret(request.headers.get('authorization'), `Bearer ${secret}`)) {
    await log.error('cron', `the ${job} run refused ${caller}: wrong or missing secret`, {
      userAgent,
    })
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  return null
}

/** Constant-time, so the response time says nothing about how much of the secret matched. */
function sameSecret(given: string | null, expected: string): boolean {
  if (given === null) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

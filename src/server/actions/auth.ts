'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { readAuthConfig } from '@/lib/auth/config'
import { safeEqual, SESSION_COOKIE, sessionCookieOptions, signSession } from '@/lib/auth/session'
import { resolvePasswordIdentity } from '@/server/services/auth'
import { PATHS, safeNextPath } from '@/lib/paths'
import { createLimit } from '@/lib/rate-limit'

const credentialsSchema = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(400),
  next: z.string().optional(),
})

/** Spec 17/29 — eight tries, then one more every couple of minutes. */
const signIns = createLimit({ capacity: 8, refillMs: 15 * 60 * 1000 })

export type LoginState = { error: 'invalid' | 'rate_limited' | 'not_configured' | null }

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentialsSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
    next: formData.get('next') ?? undefined,
  })
  if (!parsed.success) return { error: 'invalid' }

  const auth = readAuthConfig()
  if (!auth.configured) return { error: 'not_configured' }

  const headerList = await headers()
  const key = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
  if (!signIns.take(key).allowed) return { error: 'rate_limited' }

  const okUser = safeEqual(parsed.data.username, auth.username)
  const okPassword = safeEqual(parsed.data.password, auth.password)
  // Both comparisons always run, so a wrong username costs the same as a wrong password.
  if (!okUser || !okPassword) return { error: 'invalid' }

  // A correct password says this caller was never the one being kept out.
  signIns.refill(key)


  const userId = await resolvePasswordIdentity(auth.username)

  const token = await signSession(
    { uid: userId, sub: auth.username, provider: 'password' },
    auth.secret,
  )
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions())

  redirect(safeNextPath(parsed.data.next))
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
  redirect(PATHS.login)
}

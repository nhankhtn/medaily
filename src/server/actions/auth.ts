'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { LOGIN_PATH, readAuthConfig } from '@/lib/auth/config'
import { safeEqual, SESSION_COOKIE, signSession } from '@/lib/auth/session'

const credentialsSchema = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(400),
  next: z.string().optional(),
})

/**
 * Spec 17/29 — sign-in is rate limited. This counter is per process and resets
 * on restart, which is the honest trade for a single-user app with no Redis:
 * it stops casual brute force, not a determined attacker with a fresh deploy.
 */
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 8
const attempts = new Map<string, { count: number; firstAt: number }>()

function rateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = attempts.get(key)

  if (!entry || now - entry.firstAt > ATTEMPT_WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now })
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 }
  }

  entry.count += 1
  return { allowed: entry.count <= MAX_ATTEMPTS, remaining: Math.max(0, MAX_ATTEMPTS - entry.count) }
}

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
  if (!rateLimit(key).allowed) return { error: 'rate_limited' }

  const okUser = safeEqual(parsed.data.username, auth.username)
  const okPassword = safeEqual(parsed.data.password, auth.password)
  // Both comparisons always run, so a wrong username costs the same as a wrong password.
  if (!okUser || !okPassword) return { error: 'invalid' }

  attempts.delete(key)

  const token = await signSession({ sub: auth.username }, auth.secret)
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })

  const target = parsed.data.next
  redirect(target && target.startsWith('/') && !target.startsWith('//') ? target : '/')
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
  redirect(LOGIN_PATH)
}

'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { readAuthConfig } from '@/lib/auth/config'
import { safeEqual, SESSION_COOKIE, sessionCookieOptions, signSession } from '@/lib/auth/session'
import { eraseAccount, resolvePasswordIdentity } from '@/server/services/auth'
import { readSession } from '@/lib/auth/current-user'
import { PATHS, safeNextPath } from '@/lib/paths'
import { clientKey } from '@/lib/client-ip'
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

  const key = clientKey(await headers())
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

/**
 * Erasure, not archival. Everything this account holds — the journal, the
 * ledger, the health log, the people and the photos — goes, and nothing is
 * kept to make coming back easy.
 *
 * Confirmed by typing the account's own name, because there is no undo and no
 * copy left behind afterwards to restore from. Whoever wants one takes it
 * first, through the export on this same page.
 */
export async function deleteMyAccount(input: unknown) {
  const parsed = z.object({ confirmation: z.string().max(400) }).safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const session = await readSession()
  if (!session) return { ok: false as const, error: 'not_signed_in' as const }

  if (parsed.data.confirmation.trim().toLowerCase() !== session.sub.trim().toLowerCase()) {
    return { ok: false as const, error: 'confirmation_mismatch' as const }
  }

  await eraseAccount(session.uid)

  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
  return { ok: true as const }
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
  redirect(PATHS.login)
}

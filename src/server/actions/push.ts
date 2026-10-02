'use server'

import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { log } from '@/lib/log'
import { deletePushDevice, upsertPushDevice } from '@/server/repositories/push'

/**
 * Where a browser leaves its address. The token is not a credential — the
 * session is here to decide *whose* device it is.
 */

const tokenSchema = z.string().trim().min(16).max(4096)

export async function registerPushDevice(input: unknown) {
  const parsed = z
    .object({ token: tokenSchema, userAgent: z.string().trim().max(400).optional() })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const }

  const userId = await getCurrentUserId()
  try {
    await upsertPushDevice({
      userId,
      token: parsed.data.token,
      userAgent: parsed.data.userAgent ?? null,
    })
    return { ok: true as const }
  } catch (error) {
    await log.error('push', 'could not register a device', error)
    return { ok: false as const }
  }
}

/**
 * No owner check: knowing a token only buys the ability to stop that browser
 * being notified, and requiring a match would strand a device after somebody
 * else signed in on it.
 */
export async function forgetPushDevice(input: unknown) {
  const parsed = z.object({ token: tokenSchema }).safeParse(input)
  if (!parsed.success) return { ok: false as const }

  // Still requires a session: this is reachable only from inside the app.
  await getCurrentUserId()
  try {
    await deletePushDevice(parsed.data.token)
    return { ok: true as const }
  } catch (error) {
    await log.error('push', 'could not forget a device', error)
    return { ok: false as const }
  }
}

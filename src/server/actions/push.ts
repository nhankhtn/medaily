'use server'

import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { log } from '@/lib/log'
import { deletePushDevice, upsertPushDevice } from '@/server/repositories/push'

/**
 * Where a browser leaves its address, and takes it back.
 *
 * The token is not a secret and not a credential: holding one lets you send a
 * notification to that browser, not read anything from this account. What the
 * session does here is decide *whose* device it is — which matters, because
 * registering somebody else's token against your account would send them your
 * notifications.
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
 * Turning notifications off, and signing out.
 *
 * No owner check before deleting. The token is the name of a browser, and the
 * only thing knowing one buys is the ability to stop it being notified — which
 * is a thing whoever is holding that browser is entitled to do. Requiring it
 * to match the session would mean a device could not be unregistered after
 * somebody else had signed in on it, which is exactly when it should be.
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

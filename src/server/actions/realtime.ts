'use server'

import { getCurrentUserId, UnauthenticatedError } from '@/lib/auth/current-user'
import { mintRealtimeToken } from '@/server/services/firebase-custom-token'

/**
 * A Firebase custom token for the session making this call.
 *
 * The session cookie is the credential — `proxy.ts` has already refused anyone
 * without one — and the uid in the token is chosen server side, so a browser
 * cannot ask to be somebody else. Null when this deploy holds no service
 * account, which is the same answer as "no live updates here".
 */
export async function realtimeToken(): Promise<{ token: string } | null> {
  let userId: string
  try {
    userId = await getCurrentUserId()
  } catch (error) {
    if (error instanceof UnauthenticatedError) return null
    throw error
  }

  const token = await mintRealtimeToken(userId)
  return token ? { token } : null
}

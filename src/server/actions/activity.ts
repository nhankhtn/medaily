'use server'

import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import type { ActivityEntry } from '@/lib/activity/types'
import { activityLogEnabled, findActivity } from '@/server/services/activity'

/**
 * One more page of the trail, read from where the last one stopped.
 *
 * The cursor is opaque and comes back from the client, so it is checked for
 * shape rather than trusted: the store decodes it, and a decode that fails
 * there would read the newest page again instead of the older one — a button
 * that silently loops. The user is read from the session here, never sent,
 * so a cursor from someone else's list still only ever pages this account.
 */
export async function loadActivityPage(
  input: unknown,
): Promise<{ ok: true; items: ActivityEntry[]; nextCursor: string | null } | { ok: false }> {
  if (!activityLogEnabled()) return { ok: false }

  const parsed = z.object({ cursor: z.string().min(1).max(200) }).safeParse(input)
  if (!parsed.success) return { ok: false }

  const page = await findActivity(await getCurrentUserId(), { cursor: parsed.data.cursor })
  return { ok: true, items: page.items, nextCursor: page.nextCursor }
}

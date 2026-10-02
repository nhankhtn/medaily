import { and, eq, inArray, lt } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { pushDevices } from '@/lib/db/schema'
import type { PushDevice } from '@/lib/db/schema'

/** Filter for {@link listPushDevices}; every field optional so one method serves each caller. */
export type PushDeviceFilter = {
  userIds?: string[]
  /** Everything last confirmed before this instant — what the sweep asks for. */
  staleBefore?: Date
}

/** `userIds` is a list because a room is asked for at once, not member by member. */
export async function listPushDevices(
  filter: PushDeviceFilter = {},
  tx: DbOrTx = db,
): Promise<PushDevice[]> {
  if (filter.userIds?.length === 0) return []

  const where = [
    filter.userIds ? inArray(pushDevices.userId, filter.userIds) : undefined,
    filter.staleBefore ? lt(pushDevices.lastSeenAt, filter.staleBefore) : undefined,
  ].filter((clause) => clause !== undefined)

  return (
    tx
      .select()
      .from(pushDevices)
      .where(where.length > 0 ? and(...where) : undefined)
      // Total by the primary key, so two runs of the same filter agree.
      .orderBy(pushDevices.id)
  )
}

/**
 * Keyed by the token, not `(user, token)`: FCM returns the same string to
 * whoever registers the same browser, so the row changes owner after a
 * sign-out rather than gaining a sibling.
 */
export async function upsertPushDevice(
  values: { userId: string; token: string; userAgent: string | null },
  tx: DbOrTx = db,
): Promise<void> {
  await tx
    .insert(pushDevices)
    .values(values)
    .onConflictDoUpdate({
      target: pushDevices.token,
      set: { userId: values.userId, userAgent: values.userAgent, lastSeenAt: new Date() },
    })
}

/** No user id: a token FCM rejected is dead for everyone. */
export async function deletePushDevice(token: string, tx: DbOrTx = db): Promise<void> {
  await tx.delete(pushDevices).where(eq(pushDevices.token, token))
}

/** Every device one person has, for the settings list and for signing out. */
export async function deletePushDevicesOfUser(userId: string, tx: DbOrTx = db): Promise<void> {
  await tx.delete(pushDevices).where(eq(pushDevices.userId, userId))
}

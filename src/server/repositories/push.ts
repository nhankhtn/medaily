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

/**
 * Devices matching a filter.
 *
 * `userIds` is a list because the only caller that matters asks for a whole
 * room at once: one query per member would be one query per member on every
 * message sent.
 */
export async function listPushDevices(
  filter: PushDeviceFilter = {},
  tx: DbOrTx = db,
): Promise<PushDevice[]> {
  if (filter.userIds?.length === 0) return []

  const where = [
    filter.userIds ? inArray(pushDevices.userId, filter.userIds) : undefined,
    filter.staleBefore ? lt(pushDevices.lastSeenAt, filter.staleBefore) : undefined,
  ].filter((clause) => clause !== undefined)

  return tx
    .select()
    .from(pushDevices)
    .where(where.length > 0 ? and(...where) : undefined)
    // Total by the primary key, so two runs of the same filter agree.
    .orderBy(pushDevices.id)
}

/**
 * Records a device, or moves an existing one to this account.
 *
 * The token is the key rather than `(user, token)`: FCM hands the same string
 * back to whoever registers the same browser, so after a sign-out and a
 * sign-in by somebody else the row has to change owner rather than be joined
 * by a second one. Getting that wrong sends one person's notifications to the
 * other's phone.
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

/**
 * Forgets a token.
 *
 * Called when FCM refuses it and when somebody turns notifications off. No
 * user id: a token FCM has rejected is dead for everyone, and asking whose it
 * was before deleting it would be a lookup to answer a question with one
 * answer.
 */
export async function deletePushDevice(token: string, tx: DbOrTx = db): Promise<void> {
  await tx.delete(pushDevices).where(eq(pushDevices.token, token))
}

/** Every device one person has, for the settings list and for signing out. */
export async function deletePushDevicesOfUser(userId: string, tx: DbOrTx = db): Promise<void> {
  await tx.delete(pushDevices).where(eq(pushDevices.userId, userId))
}

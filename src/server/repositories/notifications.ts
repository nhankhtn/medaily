import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { notifications, type StoredNotification } from '@/lib/db/schema'

/** How many the bell keeps. Older than this stays in the table and out of the panel. */
const SHOWN = 40

export type NewNotification = {
  userId: string
  kind: string
  payload: Record<string, unknown>
  /** Absent rows do not collide. A key is what makes two announcements one row. */
  dedupeKey?: string | null
}

/**
 * One statement for the whole list. A key that is already stored is left as it
 * was — announcing the same event twice must not grow a second row.
 */
export async function insertNotifications(
  rows: NewNotification[],
  tx: DbOrTx = db,
): Promise<void> {
  if (rows.length === 0) return
  await tx
    .insert(notifications)
    .values(rows.map((row) => ({ ...row, dedupeKey: row.dedupeKey ?? null })))
    .onConflictDoNothing({ target: [notifications.userId, notifications.dedupeKey] })
}

/** Newest first. `userIds` is a list so a caller with one still passes an array of one. */
export async function listNotifications(
  userIds: string[],
  tx: DbOrTx = db,
): Promise<StoredNotification[]> {
  if (userIds.length === 0) return []
  return tx
    .select()
    .from(notifications)
    .where(inArray(notifications.userId, userIds))
    .orderBy(desc(notifications.createdAt))
    .limit(SHOWN)
}

export async function countUnreadNotifications(userIds: string[], tx: DbOrTx = db): Promise<number> {
  if (userIds.length === 0) return 0
  const [row] = await tx
    .select({ total: count() })
    .from(notifications)
    .where(and(inArray(notifications.userId, userIds), isNull(notifications.readAt)))
  return Number(row?.total ?? 0)
}

/** Only the caller's own rows, and only the ones still unread. */
export async function markNotificationsRead(
  userId: string,
  ids: string[],
  tx: DbOrTx = db,
): Promise<void> {
  if (ids.length === 0) return
  await tx
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, userId),
        inArray(notifications.id, ids),
        isNull(notifications.readAt),
      ),
    )
}

export async function markAllNotificationsRead(userId: string, tx: DbOrTx = db): Promise<void> {
  await tx
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
}

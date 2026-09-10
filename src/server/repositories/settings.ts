import { eq } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { userSettings } from '@/lib/db/schema'
import type { UserSettingsRow } from '@/lib/db/schema'

/** Repositories hold every SQL statement and always filter by owner (spec 26.1). */
export async function findSettings(
  userId: string,
  tx: DbOrTx = db,
): Promise<UserSettingsRow | null> {
  const rows = await tx.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1)
  return rows[0] ?? null
}

/**
 * Creates the settings row for a user that already exists.
 *
 * It deliberately does **not** create the `users` row any more. When the app
 * was single-user, doing both here was self-healing: a database made with
 * `drizzle-kit push` had empty tables and every page died on a missing
 * settings row. Multi-user turns that same convenience into a hole — a still
 * valid cookie belonging to a deleted account would recreate the account on
 * the next request. User rows are now created only by the sign-in flow.
 */
export async function insertUserSettings(
  userId: string,
  tx: DbOrTx = db,
): Promise<UserSettingsRow> {
  const rows = await tx.insert(userSettings).values({ userId }).onConflictDoNothing().returning()
  const created = rows[0]
  if (created) return created

  // Lost the race with a concurrent insert: read back what the winner wrote.
  const existing = await findSettings(userId, tx)
  if (!existing) throw new Error('failed to create user settings')
  return existing
}

export async function updateSettings(
  userId: string,
  patch: Partial<Omit<UserSettingsRow, 'userId' | 'createdAt' | 'updatedAt'>>,
): Promise<UserSettingsRow> {
  const rows = await db
    .update(userSettings)
    .set(patch)
    .where(eq(userSettings.userId, userId))
    .returning()
  const updated = rows[0]
  if (!updated) throw new Error('user settings not found')
  return updated
}

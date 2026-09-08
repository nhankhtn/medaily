import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { userSettings, users } from '@/lib/db/schema'
import type { UserSettingsRow } from '@/lib/db/schema'

/** Repositories hold every SQL statement and always filter by owner (spec 26.1). */
export async function findSettings(userId: string): Promise<UserSettingsRow | null> {
  const rows = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1)
  return rows[0] ?? null
}

/**
 * Creates the owner row and its settings if they are absent.
 *
 * Migrations seed them (drizzle/views.sql), but a database created with
 * `drizzle-kit push` has the tables and nothing in them — and then every page
 * fails on a missing settings row. Self-healing here means a fresh database
 * works on first request instead of returning an opaque server error.
 */
export async function insertDefaultSettings(userId: string): Promise<UserSettingsRow> {
  return db.transaction(async (tx) => {
    await tx.insert(users).values({ id: userId }).onConflictDoNothing()

    const rows = await tx.insert(userSettings).values({ userId }).onConflictDoNothing().returning()
    const created = rows[0]
    if (created) return created

    const existing = await tx
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
    const row = existing[0]
    if (!row) throw new Error('failed to create user settings')
    return row
  })
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

export async function findUser(userId: string) {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  return rows[0] ?? null
}

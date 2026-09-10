import { and, eq, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { authIdentities, users } from '@/lib/db/schema'
import type { AuthIdentity, AuthIdentityInsert, User } from '@/lib/db/schema'

/** Repositories hold every SQL statement; transactions are opened by services. */
export async function findIdentity(
  provider: 'password' | 'google',
  providerUid: string,
  tx: DbOrTx = db,
): Promise<AuthIdentity | null> {
  const rows = await tx
    .select()
    .from(authIdentities)
    .where(and(eq(authIdentities.provider, provider), eq(authIdentities.providerUid, providerUid)))
    .limit(1)
  return rows[0] ?? null
}

export async function insertIdentity(
  values: AuthIdentityInsert,
  tx: DbOrTx = db,
): Promise<AuthIdentity> {
  const rows = await tx.insert(authIdentities).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert auth identity')
  return row
}

/**
 * Records a successful sign-in. Deliberately not part of the sign-in
 * transaction: failing to stamp a timestamp must never cost someone a session.
 */
export async function touchIdentityLogin(id: string, tx: DbOrTx = db): Promise<void> {
  await tx
    .update(authIdentities)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(authIdentities.id, id))
}

/** Case-insensitive, matching the partial unique index on `lower(email)`. */
export async function findUserByEmail(email: string, tx: DbOrTx = db): Promise<User | null> {
  const rows = await tx
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`)
    .limit(1)
  return rows[0] ?? null
}

export async function findUserById(userId: string, tx: DbOrTx = db): Promise<User | null> {
  const rows = await tx.select().from(users).where(eq(users.id, userId)).limit(1)
  return rows[0] ?? null
}

export async function insertUser(
  values: typeof users.$inferInsert,
  tx: DbOrTx = db,
): Promise<User> {
  const rows = await tx.insert(users).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert user')
  return row
}

/**
 * Fills in profile fields the owner row was seeded without, and keeps a
 * changed Google display name or avatar current. Never clears an existing
 * value with a null.
 */
export async function updateUserProfile(
  userId: string,
  patch: { email?: string | null; displayName?: string | null; imageUrl?: string | null },
  tx: DbOrTx = db,
): Promise<void> {
  const set: Partial<typeof users.$inferInsert> = { updatedAt: new Date() }
  if (patch.email) set.email = patch.email
  if (patch.displayName) set.displayName = patch.displayName
  if (patch.imageUrl) set.imageUrl = patch.imageUrl
  if (Object.keys(set).length === 1) return

  await tx.update(users).set(set).where(eq(users.id, userId))
}

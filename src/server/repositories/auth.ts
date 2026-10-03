import { and, eq, inArray, notInArray, or, sql } from 'drizzle-orm'
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

/** Filter for {@link listIdentities}; every field optional so one method serves each caller. */
export type IdentityFilter = {
  userIds?: string[]
  provider?: 'password' | 'google'
}

/**
 * Identities matching a filter.
 *
 * The chat typing indicator wants the Firebase uid behind each member, so that
 * Firestore can vouch for who is typing instead of the payload claiming it.
 * A filter rather than a `findGoogleUidsByUserIds`: the next caller wants a
 * different pair of these columns, not a fourth near-identical function.
 */
export async function listIdentities(
  filter: IdentityFilter = {},
  tx: DbOrTx = db,
): Promise<AuthIdentity[]> {
  const where = [
    filter.userIds ? inArray(authIdentities.userId, filter.userIds) : undefined,
    filter.provider ? eq(authIdentities.provider, filter.provider) : undefined,
  ].filter((clause) => clause !== undefined)

  if (filter.userIds?.length === 0) return []

  return tx
    .select()
    .from(authIdentities)
    .where(where.length > 0 ? and(...where) : undefined)
    // Total by the primary key, so two runs of the same filter agree.
    .orderBy(authIdentities.id)
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

/**
 * Several users at once, for a chat room's roster. Read per room rather than
 * per page of messages: everyone who ever spoke in a room is on it, so one
 * query covers every page that follows.
 */
export async function findUsersByIds(ids: string[], tx: DbOrTx = db): Promise<User[]> {
  if (ids.length === 0) return []
  return tx.select().from(users).where(inArray(users.id, ids))
}

/**
 * People a room owner might mean.
 *
 * An address is exact: a prefix would hand over every mailbox that starts the
 * same way. A username matches exactly first, then as a prefix, and only once
 * two characters have been typed.
 */
export async function searchUsers(
  query: string,
  exceptIds: string[],
  tx: DbOrTx = db,
): Promise<User[]> {
  const needle = query.trim().toLowerCase()
  if (needle.length < 2) return []

  const handle = needle.replace(/[%_\\]/g, '')
  if (!needle.includes('@') && handle.length < 2) return []

  const where = needle.includes('@')
    ? sql`lower(${users.email}) = ${needle}`
    : or(
        sql`lower(${users.username}) = ${handle}`,
        sql`lower(${users.username}) like ${`${handle}%`}`,
      )

  return tx
    .select()
    .from(users)
    .where(and(where, exceptIds.length > 0 ? notInArray(users.id, exceptIds) : undefined))
    .orderBy(
      sql`case when lower(${users.username}) = ${needle} then 0 else 1 end`,
      users.displayName,
    )
    .limit(8)
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
/**
 * Erases the account. Every one of the 39 tables that names a user cascades
 * from here, so one delete takes the journal, the ledger, the health log and
 * the identities with it. Nothing is archived: this is the request to be
 * forgotten, not to be hidden.
 */
/** Every account, for work that is nobody's request in particular. */
export async function findAllUserIds(tx: DbOrTx = db): Promise<string[]> {
  const rows = await tx.select({ id: users.id }).from(users)
  return rows.map((row) => row.id)
}

export async function deleteUser(userId: string, tx: DbOrTx = db): Promise<void> {
  await tx.delete(users).where(eq(users.id, userId))
}

export async function updateUserProfile(
  userId: string,
  patch: {
    email?: string | null
    displayName?: string | null
    imageUrl?: string | null
    username?: string | null
  },
  tx: DbOrTx = db,
): Promise<void> {
  const set: Partial<typeof users.$inferInsert> = { updatedAt: new Date() }
  if (patch.email) set.email = patch.email
  if (patch.displayName) set.displayName = patch.displayName
  if (patch.imageUrl) set.imageUrl = patch.imageUrl
  if (patch.username) set.username = patch.username
  if (Object.keys(set).length === 1) return

  await tx.update(users).set(set).where(eq(users.id, userId))
}

/** Avatar upload may clear as well as set — unlike updateUserProfile. */
export async function setUserImageUrl(
  userId: string,
  imageUrl: string | null,
  tx: DbOrTx = db,
): Promise<void> {
  await tx.update(users).set({ imageUrl, updatedAt: new Date() }).where(eq(users.id, userId))
}

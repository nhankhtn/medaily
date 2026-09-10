import { db } from '@/lib/db'
import { OWNER_USER_ID } from '@/lib/auth/current-user'
import { emailIsPermitted, readAccessPolicy } from '@/lib/auth/config'
import type { FirebaseIdentity } from '@/lib/auth/firebase-verify'
import {
  findIdentity,
  findUserById,
  findUserByEmail,
  insertIdentity,
  insertUser,
  touchIdentityLogin,
  updateUserProfile,
} from '@/server/repositories/auth'
import { findSettings, insertUserSettings } from '@/server/repositories/settings'

export type ResolveFailure = 'not_allowed' | 'signup_closed'

export type ResolveResult =
  | { ok: true; userId: string; created: boolean }
  | { ok: false; error: ResolveFailure }

/**
 * Turns a verified Google account into the `users.id` its session will act as,
 * creating the workspace on a first sign-in.
 *
 * The order matters. Linking to an existing user is tried before provisioning,
 * so signing in with Google for the first time lands in the workspace that
 * already holds your data instead of an empty one beside it.
 */
export async function resolveGoogleIdentity(identity: FirebaseIdentity): Promise<ResolveResult> {
  const existing = await findIdentity('google', identity.uid)
  if (existing) {
    await afterSignIn(existing.id, existing.userId, identity)
    return { ok: true, userId: existing.userId, created: false }
  }

  const policy = readAccessPolicy()
  if (!emailIsPermitted(identity.email, policy)) return { ok: false, error: 'not_allowed' }

  // The owner row is seeded by migration and owns every record written while
  // the app was single-user. Claiming it by email is what makes Google
  // sign-in a change of door, not a change of house.
  if (policy.ownerEmail && identity.email === policy.ownerEmail) {
    const userId = await linkTo(OWNER_USER_ID, identity)
    return { ok: true, userId, created: false }
  }

  const byEmail = await findUserByEmail(identity.email)
  if (byEmail) {
    const userId = await linkTo(byEmail.id, identity)
    return { ok: true, userId, created: false }
  }

  if (!policy.allowSignup) return { ok: false, error: 'signup_closed' }

  return provision(identity)
}

/**
 * The env credential pair always signs in as the owner row, which keeps it a
 * usable way back in when Firebase is misconfigured or unreachable.
 */
export async function resolvePasswordIdentity(username: string): Promise<string> {
  const existing = await findIdentity('password', username)
  if (existing) {
    await touchIdentityLogin(existing.id)
    return existing.userId
  }

  await ensureUserExists(OWNER_USER_ID, 'Me')
  const identity = await insertIdentity({
    userId: OWNER_USER_ID,
    provider: 'password',
    providerUid: username,
    lastLoginAt: new Date(),
  })
  return identity.userId
}

/** Attaches a Google account to a user row that already exists. */
async function linkTo(userId: string, identity: FirebaseIdentity): Promise<string> {
  await ensureUserExists(userId, identity.displayName ?? 'Me')

  try {
    const row = await insertIdentity({
      userId,
      provider: 'google',
      providerUid: identity.uid,
      email: identity.email,
      lastLoginAt: new Date(),
    })
    await afterSignIn(row.id, userId, identity)
    return userId
  } catch (error) {
    // Two first sign-ins at once: the unique constraint on
    // (provider, provider_uid) settles it, and the loser reads the winner's row.
    const row = await findIdentity('google', identity.uid)
    if (!row) throw error
    await afterSignIn(row.id, row.userId, identity)
    return row.userId
  }
}

/**
 * A brand new workspace: user, settings and identity in one transaction, so a
 * failure halfway cannot leave a user that every page then fails to render.
 */
async function provision(identity: FirebaseIdentity): Promise<ResolveResult> {
  try {
    const userId = await db.transaction(async (tx) => {
      const user = await insertUser(
        {
          displayName: identity.displayName ?? identity.email.split('@')[0] ?? 'Me',
          email: identity.email,
          imageUrl: identity.photoUrl,
        },
        tx,
      )
      await insertUserSettings(user.id, tx)
      await insertIdentity(
        {
          userId: user.id,
          provider: 'google',
          providerUid: identity.uid,
          email: identity.email,
          lastLoginAt: new Date(),
        },
        tx,
      )
      return user.id
    })

    return { ok: true, userId, created: true }
  } catch (error) {
    const row = await findIdentity('google', identity.uid)
    if (!row) throw error
    await afterSignIn(row.id, row.userId, identity)
    return { ok: true, userId: row.userId, created: false }
  }
}

/**
 * Restores the owner row if a database was built with `drizzle-kit push`,
 * which creates the tables but runs none of the seed SQL in views.sql.
 */
async function ensureUserExists(userId: string, displayName: string): Promise<void> {
  const user = await findUserById(userId)
  if (!user) {
    await db.transaction(async (tx) => {
      await insertUser({ id: userId, displayName }, tx)
      await insertUserSettings(userId, tx)
    })
    return
  }

  if (!(await findSettings(userId))) await insertUserSettings(userId)
}

async function afterSignIn(
  identityId: string,
  userId: string,
  identity: FirebaseIdentity,
): Promise<void> {
  await touchIdentityLogin(identityId)
  await updateUserProfile(userId, {
    email: identity.email,
    displayName: identity.displayName,
    imageUrl: identity.photoUrl,
  })
}

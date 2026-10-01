import { importPKCS8, SignJWT } from 'jose'
import { log } from '@/lib/log'
import { listIdentities } from '@/server/repositories/auth'
import { type FirestoreAdminConfig, readFirestoreAdminConfig } from './firestore-rest'

/**
 * A Firebase identity for a session that signed in with a password.
 *
 * Live updates used to belong to whoever arrived through Google, because that
 * is the only path that leaves a Firebase session behind. Which device you
 * happened to use then decided whether you saw somebody typing — and on an
 * iPhone, where One Tap never draws, the password form is the path of least
 * resistance. Here the server vouches for the session it already trusts.
 *
 * This hands out no authority the project did not already give away. The rules
 * read `request.auth != null`, and the project's sign-in is not gated by the
 * app's allowlists, so that already means any Google account on the internet.
 * What keeps a room private is the 122-bit channel key, not who is signed in.
 */
const AUDIENCE =
  'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit'

/** An hour is the ceiling Firebase enforces; staying under it leaves room for clock skew. */
const TTL = '55m'

/**
 * The name Firestore knows this person by.
 *
 * Their Firebase uid when Google sign-in has ever minted one, so the two paths
 * land on the same Firebase user rather than two half-people, and the uid on a
 * typing document keeps matching the one `speakersOf` reports. Otherwise their
 * id here, which is a uuid and therefore cannot collide with a Firebase uid.
 */
export async function realtimeUidFor(userId: string): Promise<string> {
  const [identity] = await listIdentities({ userIds: [userId], provider: 'google' })
  return identity?.providerUid ?? userId
}

/** The assertion itself, taking its inputs rather than reading them, so it can be tested. */
export async function signCustomToken(config: FirestoreAdminConfig, uid: string): Promise<string> {
  const key = await importPKCS8(config.privateKey, 'RS256')
  return new SignJWT({ uid })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(config.clientEmail)
    .setSubject(config.clientEmail)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(key)
}

/**
 * A token for this person, or `null` when the deploy cannot mint one.
 *
 * Null rather than a throw: live updates are an optimisation, and a chat page
 * that will not render because a credential is missing is a worse outcome than
 * a message arriving on the slow floor. A misconfiguration is still said out
 * loud, server side, because the alternative is it staying invisible.
 */
export async function mintRealtimeToken(userId: string): Promise<string | null> {
  let config: FirestoreAdminConfig | null
  try {
    config = readFirestoreAdminConfig()
  } catch (error) {
    await log.error(
      'realtime/token',
      'FIREBASE_SERVICE_ACCOUNT is set but unusable',
      error instanceof Error ? error.message : error,
    )
    return null
  }
  if (!config) return null

  return signCustomToken(config, await realtimeUidFor(userId))
}

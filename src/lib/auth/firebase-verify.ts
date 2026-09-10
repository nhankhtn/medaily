import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'

/**
 * Verifies a Firebase ID token without the Admin SDK.
 *
 * Firebase signs ID tokens with RS256 using rotating Google keys published at
 * the URL below, so verification needs the project id and nothing else — no
 * service account JSON, no second secret to store or leak.
 *
 * This runs once per sign-in. Every subsequent request is authenticated by our
 * own HMAC cookie instead, which is why the JWKS round trip here is affordable.
 */
const JWKS_URL = new URL(
  'https://www.googleapis.com/service_accounts/v1/jwks/securetoken@system.gserviceaccount.com',
)

/**
 * Module scope on purpose: `createRemoteJWKSet` caches the fetched keys and
 * honours their cache headers, so repeated sign-ins reuse one key set instead
 * of hitting Google every time.
 */
const jwks = createRemoteJWKSet(JWKS_URL, {
  cacheMaxAge: 6 * 60 * 60 * 1000,
  timeoutDuration: 5_000,
})

export type FirebaseIdentity = {
  /** Firebase `uid` — stable per account, and the key we store. */
  uid: string
  email: string
  emailVerified: boolean
  displayName: string | null
  photoUrl: string | null
  signInProvider: string | null
}

export type VerifyFailure =
  | 'not_configured'
  | 'invalid_token'
  | 'wrong_audience'
  | 'email_missing'
  | 'email_unverified'

export class FirebaseVerifyError extends Error {
  constructor(readonly reason: VerifyFailure) {
    super(`firebase id token rejected: ${reason}`)
    this.name = 'FirebaseVerifyError'
  }
}

type FirebaseClaims = JWTPayload & {
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
  auth_time?: number
  firebase?: { sign_in_provider?: string }
}

/**
 * Throws `FirebaseVerifyError` rather than returning null, so a caller cannot
 * accidentally treat a rejected token as an anonymous visitor.
 */
export async function verifyFirebaseIdToken(
  idToken: string,
  projectId: string,
): Promise<FirebaseIdentity> {
  if (!projectId) throw new FirebaseVerifyError('not_configured')
  if (!idToken || idToken.length > 8192) throw new FirebaseVerifyError('invalid_token')

  let claims: FirebaseClaims
  try {
    // `jwtVerify` checks the signature, `exp`, `nbf`, plus the issuer and
    // audience given here. Firebase scopes both to the project, so a token
    // minted for a different Firebase project cannot be replayed at this one.
    const result = await jwtVerify<FirebaseClaims>(idToken, jwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
      clockTolerance: 60,
    })
    claims = result.payload
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') throw new FirebaseVerifyError('wrong_audience')
    throw new FirebaseVerifyError('invalid_token')
  }

  // `sub` is the Firebase uid. Firebase always sets it, but a token whose
  // subject is empty must never be allowed to key an identity row.
  const uid = typeof claims.sub === 'string' ? claims.sub.trim() : ''
  if (uid.length === 0) throw new FirebaseVerifyError('invalid_token')

  const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : ''
  if (email.length === 0) throw new FirebaseVerifyError('email_missing')

  // An unverified address can be attacker-controlled, and this app matches
  // accounts by email. Refuse rather than link the wrong workspace.
  if (claims.email_verified !== true) throw new FirebaseVerifyError('email_unverified')

  return {
    uid,
    email,
    emailVerified: true,
    displayName: typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim() : null,
    photoUrl: typeof claims.picture === 'string' && claims.picture ? claims.picture : null,
    signInProvider: claims.firebase?.sign_in_provider ?? null,
  }
}

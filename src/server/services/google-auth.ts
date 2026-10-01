import { importPKCS8, SignJWT } from 'jose'
import { env } from '@/lib/env'

/**
 * The one service account this app holds, and the access tokens it buys.
 *
 * **Not `firebase-admin`.** `firebase-verify.ts` makes the same choice for the
 * same reason: the Admin SDK is a large dependency with a gRPC transport, and
 * what is needed is a signed assertion and an HTTP call. `jose` is already in
 * the tree for verifying ID tokens, and it signs the assertion Google wants.
 *
 * Two things reach for this now — the nightly sweep of orphaned doorbell
 * documents, and sending a push — and each asks for its own scope. A token is
 * minted per scope rather than once with both, so a bug in one cannot act as
 * the other.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

/** The powers this app asks for, each where it is used and nowhere else. */
export const SCOPES = {
  /** Reading and deleting the doorbell documents. */
  datastore: 'https://www.googleapis.com/auth/datastore',
  /** Sending one notification. */
  messaging: 'https://www.googleapis.com/auth/firebase.messaging',
} as const

export type GoogleScope = (typeof SCOPES)[keyof typeof SCOPES]

export type ServiceAccount = {
  projectId: string
  clientEmail: string
  privateKey: string
}

export class GoogleAuthError extends Error {}

/**
 * The service account, or `null` when nothing that needs it is configured.
 *
 * The project id is checked against the one the browser signs in to. A
 * credential for a different project would let a background job act somewhere
 * nobody is looking — a staging key left in a production environment is
 * exactly how that happens — so a mismatch is refused rather than trusted.
 */
export function readServiceAccount(): ServiceAccount | null {
  const raw = env.FIREBASE_SERVICE_ACCOUNT?.trim()
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new GoogleAuthError('FIREBASE_SERVICE_ACCOUNT is not valid JSON')
  }

  const account = parsed as { project_id?: unknown; client_email?: unknown; private_key?: unknown }
  if (
    typeof account.project_id !== 'string' ||
    typeof account.client_email !== 'string' ||
    typeof account.private_key !== 'string'
  ) {
    throw new GoogleAuthError(
      'FIREBASE_SERVICE_ACCOUNT needs project_id, client_email and private_key',
    )
  }

  const expected = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  if (expected && account.project_id !== expected) {
    throw new GoogleAuthError(
      `FIREBASE_SERVICE_ACCOUNT is for ${account.project_id}, but this deploy signs in to ${expected}`,
    )
  }

  return {
    projectId: account.project_id,
    clientEmail: account.client_email,
    privateKey: account.private_key,
  }
}

/**
 * Trades a self-signed assertion for an access token.
 *
 * Not cached. The jobs that ask run once a night or once per message sent, and
 * a cache would be a lifetime to get wrong for a saving nobody would notice.
 */
export async function accessToken(
  account: ServiceAccount,
  scope: GoogleScope,
): Promise<string> {
  const key = await importPKCS8(account.privateKey, 'RS256')
  const assertion = await new SignJWT({ scope })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(account.clientEmail)
    .setSubject(account.clientEmail)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(key)

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  if (!response.ok) {
    throw new GoogleAuthError(`could not get an access token: ${response.status}`)
  }

  const body = (await response.json()) as { access_token?: unknown }
  if (typeof body.access_token !== 'string') {
    throw new GoogleAuthError('the token response carried no access_token')
  }
  return body.access_token
}

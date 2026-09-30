import { importPKCS8, SignJWT } from 'jose'
import { env } from '@/lib/env'

/**
 * Enough of the Firestore REST API to list and delete documents, as the
 * service account.
 *
 * **Not `firebase-admin`.** `firebase-verify.ts` next door makes the same
 * choice for the same reason: the Admin SDK is a large dependency with a gRPC
 * transport, and what is needed here is three HTTP calls. `jose` is already in
 * the tree for verifying ID tokens, and it signs the assertion Google wants in
 * exchange for an access token.
 *
 * This is the only thing in the app that holds a Firebase credential with any
 * power. Everything else — sign-in, the doorbell, the typing indicator — runs
 * on public keys and security rules. Keeping it in one small file, reachable
 * only from the nightly job, is the containment.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/datastore'
const API = 'https://firestore.googleapis.com/v1'

export type FirestoreAdminConfig = {
  projectId: string
  clientEmail: string
  privateKey: string
}

export class FirestoreRestError extends Error {}

/**
 * The service account, or `null` when the sweep is simply not configured.
 *
 * The project id is checked against the one the browser signs in to. A
 * credential for a different project would let the nightly job delete from
 * somewhere nobody was looking — a staging key left in a production
 * environment is exactly how that happens — so a mismatch is refused rather
 * than trusted.
 */
export function readFirestoreAdminConfig(): FirestoreAdminConfig | null {
  const raw = env.FIREBASE_SERVICE_ACCOUNT?.trim()
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new FirestoreRestError('FIREBASE_SERVICE_ACCOUNT is not valid JSON')
  }

  const account = parsed as { project_id?: unknown; client_email?: unknown; private_key?: unknown }
  if (
    typeof account.project_id !== 'string' ||
    typeof account.client_email !== 'string' ||
    typeof account.private_key !== 'string'
  ) {
    throw new FirestoreRestError(
      'FIREBASE_SERVICE_ACCOUNT needs project_id, client_email and private_key',
    )
  }

  const expected = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  if (expected && account.project_id !== expected) {
    throw new FirestoreRestError(
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
 * Not cached. The job runs once a night and asks once; a cache would be a
 * lifetime to get wrong for no saving at all.
 */
async function accessToken(config: FirestoreAdminConfig): Promise<string> {
  const key = await importPKCS8(config.privateKey, 'RS256')
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(config.clientEmail)
    .setSubject(config.clientEmail)
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
    throw new FirestoreRestError(`could not get an access token: ${response.status}`)
  }

  const body = (await response.json()) as { access_token?: unknown }
  if (typeof body.access_token !== 'string') {
    throw new FirestoreRestError('the token response carried no access_token')
  }
  return body.access_token
}

/** One document as the REST API returns it, narrowed to what the sweep reads. */
export type RestDocument = { name: string; fields?: unknown }

export type FirestoreRest = {
  /** Every document in a collection, following pages to the end. */
  list: (collectionPath: string) => Promise<RestDocument[]>
  /** Removes one document. Its sub-collections are **not** touched. */
  remove: (documentPath: string) => Promise<void>
}

/** Opens a client. One access token serves the whole run. */
export async function firestoreRest(config: FirestoreAdminConfig): Promise<FirestoreRest> {
  const token = await accessToken(config)
  const root = `projects/${config.projectId}/databases/(default)/documents`
  const authorized = { authorization: `Bearer ${token}` }

  return {
    list: async (collectionPath) => {
      const documents: RestDocument[] = []
      let pageToken: string | undefined

      do {
        const url = new URL(`${API}/${root}/${collectionPath}`)
        url.searchParams.set('pageSize', '300')
        // Only the field the decision reads. Without this the sweep downloads
        // every field of every document to look at one number.
        url.searchParams.append('mask.fieldPaths', 'at')
        if (pageToken) url.searchParams.set('pageToken', pageToken)

        const response = await fetch(url, { headers: authorized })
        // An empty collection is a 200 with no `documents`; a missing parent is
        // a 404, which here means the same thing.
        if (response.status === 404) return documents
        if (!response.ok) {
          throw new FirestoreRestError(`listing ${collectionPath} failed: ${response.status}`)
        }

        const body = (await response.json()) as {
          documents?: RestDocument[]
          nextPageToken?: string
        }
        documents.push(...(body.documents ?? []))
        pageToken = body.nextPageToken
      } while (pageToken)

      return documents
    },

    remove: async (documentPath) => {
      const response = await fetch(`${API}/${documentPath}`, {
        method: 'DELETE',
        headers: authorized,
      })
      // Already gone is the outcome asked for.
      if (response.ok || response.status === 404) return
      throw new FirestoreRestError(`deleting ${documentPath} failed: ${response.status}`)
    },
  }
}

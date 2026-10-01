import {
  accessToken,
  GoogleAuthError,
  readServiceAccount,
  SCOPES,
  type ServiceAccount,
} from './google-auth'

/**
 * Enough of the Firestore REST API to list and delete documents, as the
 * service account.
 *
 * The credential and the token exchange live in `google-auth.ts`, shared with
 * the push sender. What is here is only the three calls the sweep makes.
 */

const API = 'https://firestore.googleapis.com/v1'

export type FirestoreAdminConfig = ServiceAccount
export const FirestoreRestError = GoogleAuthError

/** The service account, or `null` when the sweep is simply not configured. */
export function readFirestoreAdminConfig(): FirestoreAdminConfig | null {
  return readServiceAccount()
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
  const token = await accessToken(config, SCOPES.datastore)
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
          throw new GoogleAuthError(`listing ${collectionPath} failed: ${response.status}`)
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
      throw new GoogleAuthError(`deleting ${documentPath} failed: ${response.status}`)
    },
  }
}

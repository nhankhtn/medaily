import {
  deliveryUrl,
  folderFor,
  readCloudinaryConfig,
  signParams,
  type MediaKind,
} from '@/lib/media/cloudinary'
import { findPersonPhotos } from '@/server/repositories/media'

export type PhotoView = {
  id: string
  personId: string
  thumbUrl: string
  fullUrl: string
  caption: string | null
  takenOn: string | null
  createdAt: string
}

export function mediaEnabled(): boolean {
  return readCloudinaryConfig().configured
}

export async function getPersonPhotos(
  userId: string,
  personIds: string[],
): Promise<Map<string, PhotoView[]>> {
  const config = readCloudinaryConfig()
  const grouped = new Map<string, PhotoView[]>()
  if (!config.configured) return grouped

  for (const row of await findPersonPhotos(userId, personIds)) {
    const view: PhotoView = {
      id: row.id,
      personId: row.personId,
      thumbUrl: deliveryUrl(config.cloudName, row.publicId, 'thumb'),
      fullUrl: deliveryUrl(config.cloudName, row.publicId, 'full'),
      caption: row.caption,
      takenOn: row.takenOn,
      createdAt: row.createdAt.toISOString(),
    }
    grouped.set(row.personId, [...(grouped.get(row.personId) ?? []), view])
  }

  return grouped
}

export type UploadTicket = {
  cloudName: string
  apiKey: string
  timestamp: number
  folder: string
  signature: string
}

/**
 * A ticket authorises one upload into one folder. The secret stays here; the
 * browser gets only a signature it cannot alter without invalidating.
 */
export function createUploadTicket(
  kind: MediaKind,
  userId: string,
  ownerId: string,
): UploadTicket | null {
  const config = readCloudinaryConfig()
  if (!config.configured) return null

  const timestamp = Math.floor(Date.now() / 1000)
  const folder = folderFor(config.baseFolder, kind, userId, ownerId)

  return {
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    timestamp,
    folder,
    signature: signParams({ folder, timestamp }, config.apiSecret),
  }
}

/** Removing the row without this would leave the asset paid for and orphaned. */
export async function destroyAsset(publicId: string): Promise<void> {
  const config = readCloudinaryConfig()
  if (!config.configured) return

  const timestamp = Math.floor(Date.now() / 1000)
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: config.apiKey,
    signature: signParams({ public_id: publicId, timestamp }, config.apiSecret),
  })

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`,
    { method: 'POST', body },
  )
  if (!response.ok) {
    throw new Error(`cloudinary destroy failed: ${response.status}`)
  }
}

export type StoredAsset = { publicId: string; bytes: number; createdAt: Date }

/** Basic auth is what the Admin API takes; the upload API takes a signature. */
function adminAuth(apiKey: string, apiSecret: string): string {
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`
}

/** Everything stored under one folder, following Cloudinary's paging. */
export async function listAssets(prefix: string): Promise<StoredAsset[]> {
  const config = readCloudinaryConfig()
  if (!config.configured) return []

  const found: StoredAsset[] = []
  let cursor: string | undefined

  do {
    const url = new URL(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/resources/image/upload`,
    )
    url.searchParams.set('prefix', prefix)
    url.searchParams.set('max_results', '500')
    if (cursor) url.searchParams.set('next_cursor', cursor)

    const response = await fetch(url, {
      headers: { Authorization: adminAuth(config.apiKey, config.apiSecret) },
    })
    if (!response.ok) throw new Error(`cloudinary list failed: ${response.status}`)

    const page = (await response.json()) as {
      resources?: { public_id: string; bytes: number; created_at: string }[]
      next_cursor?: string
    }
    for (const row of page.resources ?? []) {
      found.push({
        publicId: row.public_id,
        bytes: row.bytes,
        createdAt: new Date(row.created_at),
      })
    }
    cursor = page.next_cursor
  } while (cursor)

  return found
}

/**
 * Empties a folder. Used where there is nothing left to compare against —
 * erasing an account — so no reference check applies.
 *
 * Cloudinary deletes up to a thousand at a time and says when more remain.
 */
export async function destroyByPrefix(prefix: string): Promise<number> {
  const config = readCloudinaryConfig()
  if (!config.configured) return 0

  let removed = 0
  for (;;) {
    const url = new URL(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/resources/image/upload`,
    )
    url.searchParams.set('prefix', prefix)

    const response = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: adminAuth(config.apiKey, config.apiSecret) },
    })
    if (!response.ok) throw new Error(`cloudinary delete failed: ${response.status}`)

    const body = (await response.json()) as {
      deleted?: Record<string, string>
      partial?: boolean
    }
    removed += Object.keys(body.deleted ?? {}).length
    if (!body.partial) return removed
  }
}

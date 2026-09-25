import { createHash } from 'node:crypto'

export { deliveryUrl, publicIdFromDeliveryUrl, type ImageVariant } from './image-url'

/**
 * Signed direct uploads: the browser sends the file to Cloudinary and only the
 * signature comes from here, so image bytes never pass through the app and
 * never meet the serverless request-body limit.
 */
export type CloudinaryConfig = {
  cloudName: string
  apiKey: string
  apiSecret: string
  baseFolder: string
  configured: boolean
}

export function readCloudinaryConfig(): CloudinaryConfig {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? ''
  const apiKey = process.env.CLOUDINARY_API_KEY ?? ''
  const apiSecret = process.env.CLOUDINARY_API_SECRET ?? ''
  return {
    cloudName,
    apiKey,
    apiSecret,
    baseFolder: process.env.CLOUDINARY_FOLDER || 'medaily',
    configured: cloudName.length > 0 && apiKey.length > 0 && apiSecret.length > 0,
  }
}

export const MEDIA_KINDS = ['people', 'avatars', 'notes'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]

/** One predictable path per owner, so a second kind of asset needs no rethink. */
export function folderFor(
  baseFolder: string,
  kind: MediaKind,
  userId: string,
  ownerId: string,
): string {
  return `${baseFolder}/${userId}/${kind}/${ownerId}`
}

/**
 * A profile photo we uploaded ourselves. Google avatars live on another host;
 * afterSignIn must leave these alone or the next login wipes the upload.
 */
export function isUploadedAvatar(imageUrl: string | null | undefined, userId: string): boolean {
  if (!imageUrl) return false
  return imageUrl.includes(`/${userId}/avatars/`)
}

/**
 * Cloudinary signs the alphabetically sorted parameters, excluding the file,
 * the api key and the signature itself.
 */
export function signParams(params: Record<string, string | number>, apiSecret: string): string {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
  return createHash('sha1').update(`${canonical}${apiSecret}`).digest('hex')
}

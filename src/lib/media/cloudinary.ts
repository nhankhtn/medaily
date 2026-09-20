import { createHash } from 'node:crypto'

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

export const MEDIA_KINDS = ['people', 'avatars'] as const
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

export type ImageVariant = 'thumb' | 'full'

/**
 * One stored original, two deliveries: a grid of thumbnails must not pull
 * full-resolution bytes, and a photo opened on purpose must not look soft.
 */
const TRANSFORMS: Record<ImageVariant, string> = {
  thumb: 'f_auto,q_auto:eco,c_fill,g_auto,w_400,h_400,dpr_auto',
  full: 'f_auto,q_auto:good,c_limit,w_2000',
}

export function deliveryUrl(
  cloudName: string,
  publicId: string,
  variant: ImageVariant = 'thumb',
): string {
  return `https://res.cloudinary.com/${cloudName}/image/upload/${TRANSFORMS[variant]}/${publicId}`
}

/** Undo `deliveryUrl` for an asset we built, so a replace can destroy the old one. */
export function publicIdFromDeliveryUrl(url: string, cloudName: string): string | null {
  for (const transform of Object.values(TRANSFORMS)) {
    const prefix = `https://res.cloudinary.com/${cloudName}/image/upload/${transform}/`
    if (url.startsWith(prefix)) return decodeURIComponent(url.slice(prefix.length))
  }
  return null
}

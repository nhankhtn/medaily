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

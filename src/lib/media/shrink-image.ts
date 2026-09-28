/**
 * The longest edge worth uploading. `deliveryUrl` serves every note image
 * through `c_limit,w_2000`, so anything past this is carried over the network
 * once and then thrown away on the way back out.
 */
const LONGEST_EDGE = 2000
const QUALITY = 0.85

/** Formats a canvas cannot redraw without losing what makes them what they are. */
const LEAVE_ALONE = ['image/gif', 'image/svg+xml']

/**
 * A smaller copy of a picture, or the original when shrinking would not help.
 *
 * A phone hands over eight to twelve megapixels for a photo the page will
 * never show above 2000px wide. Sending the original costs the whole wait and
 * buys nothing a viewer can see.
 *
 * Every failure path returns the file untouched: a slow upload is a worse
 * outcome than no upload only until it becomes no upload.
 */
export async function shrinkImage(file: File): Promise<File> {
  if (LEAVE_ALONE.includes(file.type)) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height)
    // Already within the cap: re-encoding here can end up larger than the
    // original, which is the one thing this must not do.
    if (longest <= LONGEST_EDGE) return file

    const scale = LONGEST_EDGE / longest
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, width, height)

    const blob = await encode(canvas)
    if (!blob || blob.size >= file.size) return file

    return new File([blob], renamed(file.name, blob.type), { type: blob.type })
  } catch {
    return file
  } finally {
    bitmap.close?.()
  }
}

/** WebP where it exists, JPEG where it does not — `toBlob` falls back to PNG. */
async function encode(canvas: HTMLCanvasElement): Promise<Blob | null> {
  for (const type of ['image/webp', 'image/jpeg']) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, QUALITY),
    )
    if (blob && blob.type === type) return blob
  }
  return null
}

function renamed(name: string, type: string): string {
  const extension = type === 'image/webp' ? 'webp' : 'jpg'
  const stem = name.replace(/\.[^.]+$/, '') || 'image'
  return `${stem}.${extension}`
}

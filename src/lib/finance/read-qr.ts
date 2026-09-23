import jsQR from 'jsqr'

/**
 * The string inside a QR image, or null when there is no readable code.
 *
 * Reading the picture rather than keeping it is the point: a payload is text,
 * so it can be redrawn at any size, and a Napas one can be inspected for the
 * account it names. A stored PNG answers neither.
 */
export async function readQrFromFile(file: File): Promise<string | null> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return null
  }

  /*
   * Small first: a phone hands over twelve megapixels and jsQR walks every one
   * of them, while a code only needs a handful of pixels per module. The
   * larger pass is for a dense code in a soft photo, where shrinking blurs one
   * module into the next — rare enough to be worth paying for only on a miss.
   */
  for (const longest of [600, 1400]) {
    const found = scanAt(bitmap, longest)
    if (found !== null) {
      bitmap.close?.()
      return found
    }
  }

  bitmap.close?.()
  return null
}

function scanAt(bitmap: ImageBitmap, longest: number): string | null {
  const scale = Math.min(1, longest / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null

  context.drawImage(bitmap, 0, 0, width, height)
  const pixels = context.getImageData(0, 0, width, height)
  return jsQR(pixels.data, width, height)?.data ?? null
}

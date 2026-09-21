import { ImageResponse } from 'next/og'
import { markSvg } from '@/lib/brand'

/**
 * The Android home-screen icon.
 *
 * Android masks an icon to whatever shape the launcher uses — circle, squircle,
 * teardrop. An icon that does not declare itself maskable is letterboxed inside
 * a white tile instead, which is why an installed PWA so often looks pasted on
 * next to the real apps.
 *
 * The mark suits the mask already: the background bleeds to every edge, so
 * there is nothing to letterbox, and the stroke runs x=16→48 of 64 — the
 * middle half, well inside the 80% a mask is allowed to keep. Unrounded for
 * the same reason iOS gets an unrounded one: our corners inside the launcher's
 * own mask read as a mistake.
 *
 * PNG rather than the SVG the manifest also carries. Maskable support is
 * settled for PNG and patchier for SVG, and this is the file a launcher keeps.
 */
export const size = 512

export function GET() {
  const svg = `data:image/svg+xml;base64,${Buffer.from(markSvg({ rounded: false })).toString('base64')}`

  return new ImageResponse(
    // `next/image` cannot appear here: this tree is rendered by Satori into a
    // PNG, not by a browser. Next's own icon conventions are exempt from the
    // rule; a route at a fixed path, which is what the manifest needs to point
    // at, is not.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={svg} width={size} height={size} alt="" />,
    {
      width: size,
      height: size,
    },
  )
}

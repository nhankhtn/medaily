import { ImageResponse } from 'next/og'
import { markSvg } from '@/lib/brand'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/**
 * iOS wants a PNG and rounds the corners itself, so this one is square to the
 * edge — our own radius inside Apple's mask reads as a mistake.
 */
export default function AppleIcon() {
  const svg = `data:image/svg+xml;base64,${Buffer.from(markSvg({ rounded: false })).toString('base64')}`

  return new ImageResponse(
    (
      <img src={svg} width={size.width} height={size.height} alt="" />
    ),
    size,
  )
}

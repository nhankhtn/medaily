import { ImageResponse } from 'next/og'
import { markSvg, TILE_FROM, TILE_TO } from '@/lib/brand'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Personal OS'

/**
 * The card a pasted link turns into. A PNG because that is the only thing the
 * scrapers agree on — Facebook, Zalo and Slack all skip an SVG and fall back
 * to a blank card, which is what `icon.svg` would have given them.
 *
 * 1200×630 is the ratio every one of them crops to; anything else gets the
 * edges taken off wherever they feel like.
 */
export default function OpengraphImage() {
  const mark = `data:image/svg+xml;base64,${Buffer.from(markSvg()).toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 40,
          // The sign-in page's own wash, so the card and the page it opens
          // look like the same product.
          background: `linear-gradient(135deg, ${TILE_FROM} 0%, #ffffff 55%, ${TILE_TO} 100%)`,
        }}
      >
        <img src={mark} width={180} height={180} alt="" />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 76, fontWeight: 700, color: '#1d1e43', letterSpacing: -1 }}>
            Personal OS
          </div>
          <div style={{ fontSize: 34, color: '#3a3c6b' }}>
            Track daily performance, understand behaviour, manage goals.
          </div>
        </div>
      </div>
    ),
    size,
  )
}

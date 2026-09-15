import {
  MARK_PATH,
  MARK_STROKE,
  TILE_FROM,
  TILE_RADIUS,
  TILE_SIZE,
  TILE_TO,
} from '@/lib/brand'

/**
 * The mark: a day ticked off, whose arm keeps rising.
 *
 * Two readings on purpose — the app is one tick a day, and the point of
 * ticking is the line going up. One stroke, so it survives a 16px favicon.
 *
 * The gradient is fixed rather than themed: a logo that changes colour with
 * the theme is two logos, and neither is remembered.
 */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  const id = 'os-tile'

  return (
    <svg
      viewBox={`0 0 ${TILE_SIZE} ${TILE_SIZE}`}
      width={size}
      height={size}
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient
          id={id}
          x1="0"
          y1="0"
          x2={TILE_SIZE}
          y2={TILE_SIZE}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={TILE_FROM} />
          <stop offset="1" stopColor={TILE_TO} />
        </linearGradient>
      </defs>
      <rect width={TILE_SIZE} height={TILE_SIZE} rx={TILE_RADIUS} fill={`url(#${id})`} />
      <path
        d={MARK_PATH}
        fill="none"
        stroke="#fff"
        strokeWidth={MARK_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

import {
  MARK_PATH,
  MARK_STROKE,
  TILE_RADIUS,
  TILE_SIZE,
} from '@/lib/brand'
import { cn } from '@/lib/utils'

/**
 * The mark: a day ticked off, whose arm keeps rising.
 *
 * Two readings on purpose — the app is one tick a day, and the point of
 * ticking is the line going up. One stroke, so it survives a 16px favicon.
 *
 * The in-app mark is CSS liquid glass (`.logo-mark`). Favicon / home-screen
 * icons bake the same look via `markSvg` in `@/lib/brand` — opaque paint,
 * no backdrop to blur. `frosted` adds real backdrop blur only in open air
 * (login); nested inside another glass panel a second filter washes out.
 */
export function Logo({
  size = 32,
  frosted = false,
  className,
}: {
  size?: number
  /** Real blur — use on login / empty canvas, not inside `glass-chip`. */
  frosted?: boolean
  className?: string
}) {
  const radius = (size * TILE_RADIUS) / TILE_SIZE

  return (
    <span
      className={cn('logo-mark', frosted && 'logo-mark-frosted', className)}
      style={{ width: size, height: size, borderRadius: radius }}
      aria-hidden
    >
      <svg
        viewBox={`0 0 ${TILE_SIZE} ${TILE_SIZE}`}
        width={size}
        height={size}
        className="block"
        focusable="false"
      >
        <path
          d={MARK_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth={MARK_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

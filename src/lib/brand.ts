/**
 * The mark, in one place.
 *
 * It is drawn three times — the favicon file, the React logo, the iOS icon —
 * and three hand-kept copies of a path is how a logo quietly becomes two.
 * `tests/unit/brand.test.ts` holds the static file to these values.
 */

/**
 * Three steps climbing. The app is one day at a time and the point of logging
 * a day is the step it adds — a tick alone would say the first half and be the
 * logo of every to-do app besides.
 *
 * One stroke with round joins, so 16px survives it.
 */
export const MARK_PATH = 'M16 44 26 44 26 32 37 32 37 20 48 20'
export const MARK_STROKE = 8
export const TILE_SIZE = 64
export const TILE_RADIUS = 15

export const TILE_FROM = '#6E79EC'
export const TILE_TO = '#4A3FB5'

/**
 * The whole mark as standalone SVG. `rounded` off for iOS, which applies its
 * own mask and would otherwise show our corners inside its own.
 */
export function markSvg({ rounded = true }: { rounded?: boolean } = {}): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE_SIZE} ${TILE_SIZE}" width="${TILE_SIZE}" height="${TILE_SIZE}">`,
    '<defs>',
    `<linearGradient id="tile" x1="0" y1="0" x2="${TILE_SIZE}" y2="${TILE_SIZE}" gradientUnits="userSpaceOnUse">`,
    `<stop stop-color="${TILE_FROM}"/><stop offset="1" stop-color="${TILE_TO}"/>`,
    '</linearGradient>',
    '</defs>',
    `<rect width="${TILE_SIZE}" height="${TILE_SIZE}"${rounded ? ` rx="${TILE_RADIUS}"` : ''} fill="url(#tile)"/>`,
    `<path d="${MARK_PATH}" fill="none" stroke="#fff" stroke-width="${MARK_STROKE}" stroke-linecap="round" stroke-linejoin="round"/>`,
    '</svg>',
  ].join('')
}

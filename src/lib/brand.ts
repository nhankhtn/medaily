/**
 * The mark, in one place.
 *
 * It is drawn three times — the favicon file, the React logo, the iOS /
 * Android home-screen icons — and three hand-kept copies of a path is how a
 * logo quietly becomes two. `tests/unit/brand.test.ts` holds `app/icon.svg`
 * to `markSvg()` byte-for-byte.
 *
 * In-app `Logo` paints the tile with CSS liquid glass (`.logo-mark`). Home-
 * screen / favicon assets cannot blur a backdrop, so `markSvg` bakes the same
 * look as an opaque gradient + sheen + rim. Change the silhouette or palette
 * here, then rewrite `src/app/icon.svg` from `markSvg()` — apple / maskable
 * routes import this file already.
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

/** Baked glass fill — lighter top, accent mid (mirrors `.logo-mark` wash). */
export const TILE_FROM = '#C5CBF5'
export const TILE_TO = '#6E79EC'
/** Specular rim — `.logo-mark` border mix of white + accent. */
export const TILE_RIM = '#EEF0FA'

/**
 * The whole mark as standalone SVG. `rounded` off for iOS / maskable, which
 * apply their own mask and would otherwise show our corners inside theirs.
 */
export function markSvg({ rounded = true }: { rounded?: boolean } = {}): string {
  const rx = rounded ? ` rx="${TILE_RADIUS}"` : ''
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE_SIZE} ${TILE_SIZE}" width="${TILE_SIZE}" height="${TILE_SIZE}">`,
    '<defs>',
    `<linearGradient id="tile" x1="0" y1="0" x2="0" y2="${TILE_SIZE}" gradientUnits="userSpaceOnUse">`,
    `<stop stop-color="${TILE_FROM}"/><stop offset="1" stop-color="${TILE_TO}"/>`,
    '</linearGradient>',
    `<linearGradient id="sheen" x1="0" y1="0" x2="0" y2="${TILE_SIZE * 0.5}" gradientUnits="userSpaceOnUse">`,
    '<stop stop-color="#ffffff" stop-opacity="0.5"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>',
    '</linearGradient>',
    '</defs>',
    `<rect width="${TILE_SIZE}" height="${TILE_SIZE}"${rx} fill="url(#tile)"/>`,
    `<rect width="${TILE_SIZE}" height="${TILE_SIZE}"${rx} fill="url(#sheen)"/>`,
    `<rect width="${TILE_SIZE}" height="${TILE_SIZE}"${rx} fill="none" stroke="${TILE_RIM}" stroke-width="1.25"/>`,
    `<path d="${MARK_PATH}" fill="none" stroke="#fff" stroke-width="${MARK_STROKE}" stroke-linecap="round" stroke-linejoin="round"/>`,
    '</svg>',
  ].join('')
}

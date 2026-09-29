/**
 * Home-screen / install detection. Shared by the install UI and the shell
 * chrome, which both have to know whether the browser's own controls are there.
 */

/** Already launched from the home-screen icon (no browser chrome). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

/**
 * iPhone or iPad, whichever browser is painted on top.
 *
 * Every browser on iOS is WebKit underneath, so a capability Safari lacks is
 * one Chrome and Firefox lack there too — which is why this asks about the
 * device and `isIosSafari` asks about the browser.
 */
export function isIos(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  if (/iphone|ipod|ipad/i.test(ua)) return true
  // iPadOS reports itself as a Mac; the touch count is what separates a tablet
  // from a desktop.
  return /macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1
}

/**
 * A phone or a tablet — somewhere an app can be installed and handed a link.
 *
 * Asked before offering anything that opens another app. A laptop has no
 * bank app to open, and VietQR says as much: on a desktop its deeplink page
 * answers `Deeplink not support on your os: mac os` and nothing else.
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false
  return isIos() || /android/i.test(window.navigator.userAgent)
}

/** iPhone and iPad Safari specifically — not Chrome or Firefox painted on it. */
export function isIosSafari(): boolean {
  if (!isIos()) return false
  return !/crios|fxios|edgios/i.test(window.navigator.userAgent)
}

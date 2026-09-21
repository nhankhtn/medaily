/**
 * Home-screen / install detection. Shared by install UI, shell chrome, and
 * auth — Firebase popups break in standalone WebKit, so sign-in needs this too.
 */

/** Already launched from the home-screen icon (no browser chrome). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

/**
 * iPhone and iPad Safari. iPadOS reports itself as a Mac, so the touch count
 * is what separates a tablet from a desktop.
 */
export function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const iPhone = /iphone|ipod/i.test(ua)
  const iPad = /ipad/i.test(ua) || (/macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1)
  if (!iPhone && !iPad) return false
  return !/crios|fxios|edgios/i.test(ua)
}

/**
 * Popup Google sign-in opens ASWebAuthenticationSession on iOS (sheet with
 * Done) where the soft keyboard often never appears. Full-page redirect on
 * the app origin — with authDomain = page host — is the path that works.
 */
export function needsAuthRedirect(): boolean {
  return isStandalone() || isIosSafari()
}

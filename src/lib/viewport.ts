/**
 * Which layout a page was built for, remembered between visits.
 *
 * The server has to commit to one before any window exists. Guessing from the
 * user agent gets an iPad wrong — it reports itself as a Mac — and never
 * notices a desktop window dragged narrow. So the client writes down what it
 * actually measured, and the next render starts from that instead of a guess.
 *
 * The first visit on a device has nothing to go on and may correct itself once.
 */
export const VIEWPORT_COOKIE = 'medaily.viewport'

/** Tailwind's `sm`, the width every layout in this app already splits on. */
export const DESKTOP_QUERY = '(min-width: 640px)'

export function isDesktopCookie(value: string | undefined): boolean {
  return value === 'desktop'
}

export function viewportCookieValue(desktop: boolean): string {
  return desktop ? 'desktop' : 'mobile'
}

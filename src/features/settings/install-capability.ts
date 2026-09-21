/**
 * Shared install-to-home-screen capability.
 *
 * Chromium hands one `beforeinstallprompt` event per eligibility window, and
 * both Settings and the post-tour dialog need it, so the deferred event lives
 * here rather than in either component.
 */

export type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallMode =
  /** Already on the home screen, or nothing useful to offer. */
  | 'hidden'
  /** Chromium deferred a real install prompt. */
  | 'prompt'
  /** iOS Safari — only instructions, no API. */
  | 'guide'

let deferred: InstallPrompt | null = null
const listeners = new Set<() => void>()

function announce(): void {
  for (const listener of listeners) listener()
}

export function getDeferredInstallPrompt(): InstallPrompt | null {
  return deferred
}

export function clearDeferredInstallPrompt(): void {
  deferred = null
  announce()
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Wire once from a client component that always mounts in the signed-in shell. */
export function bindInstallPromptListeners(): () => void {
  if (typeof window === 'undefined') return () => {}

  const onPrompt = (event: Event) => {
    event.preventDefault()
    deferred = event as InstallPrompt
    announce()
  }
  const onInstalled = () => {
    deferred = null
    announce()
  }

  window.addEventListener('beforeinstallprompt', onPrompt)
  window.addEventListener('appinstalled', onInstalled)
  return () => {
    window.removeEventListener('beforeinstallprompt', onPrompt)
    window.removeEventListener('appinstalled', onInstalled)
  }
}

export function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

/**
 * iPhone and iPad. iPadOS reports itself as a Mac, so the touch count is what
 * separates a tablet from a desktop.
 */
export function isIosSafari(): boolean {
  const ua = window.navigator.userAgent
  const iPhone = /iphone|ipod/i.test(ua)
  const iPad = /ipad/i.test(ua) || (/macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1)
  if (!iPhone && !iPad) return false
  return !/crios|fxios|edgios/i.test(ua)
}

export function resolveInstallMode(hasPrompt: boolean): InstallMode {
  if (isStandalone()) return 'hidden'
  if (hasPrompt) return 'prompt'
  if (isIosSafari()) return 'guide'
  return 'hidden'
}

/** Fired when the welcome tour is finished or skipped. */
export const TOUR_FINISHED_EVENT = 'medaily:tour-finished'

/** Device-local: the install ask is per phone, not per account. */
export const INSTALL_OFFER_KEY = 'medaily.installOffer.seen'

export function markInstallOfferSeen(): void {
  try {
    localStorage.setItem(INSTALL_OFFER_KEY, '1')
  } catch {
    /* private mode */
  }
}

export function hasSeenInstallOffer(): boolean {
  try {
    return localStorage.getItem(INSTALL_OFFER_KEY) === '1'
  } catch {
    return true
  }
}

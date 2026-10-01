import { firebaseApp, firebaseConfigured } from '@/lib/auth/firebase-client'
import { isIos, isStandalone } from '@/lib/pwa'

/**
 * Asking a browser for permission to notify, and getting the address back.
 *
 * The whole file sits behind one question with an uncomfortable answer on the
 * platform this app is mostly used from: **iOS delivers web push only to a web
 * app added to the Home Screen.** Not Safari, not Chrome — those are the same
 * WebKit underneath and neither gets a token. So on an iPhone the choice is
 * offered only once the app is installed, and the settings card says why
 * rather than showing a button that quietly does nothing.
 */

export type PushAvailability =
  /** Offered, and not yet answered. */
  | 'available'
  /** Already on for this browser. */
  | 'granted'
  /** Refused. Only the browser's own settings can undo this, not a button here. */
  | 'denied'
  /** An iPhone that has not installed the app — the one fixable case. */
  | 'needs-install'
  /** No push at all: an old browser, or a deploy with no Firebase project. */
  | 'unsupported'

function vapidKey(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? ''
}

/**
 * Whether this app is using the permission, as opposed to merely having it.
 *
 * Two different facts, and conflating them breaks both directions. The browser
 * permission is granted once and a page cannot take it back, so without a
 * record of its own "turn off" would leave a button that still says turn off,
 * and the silent refresh on the next load would register the device again —
 * undoing what somebody just asked for, with nothing to see.
 *
 * Per browser, so it belongs in `localStorage` rather than on the account: the
 * same person saying yes on a phone has not said yes on their laptop.
 */
const ENABLED_KEY = 'medaily.push.enabled'

export function pushEnabledHere(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1'
  } catch {
    // Private window, or storage refused. Treated as off, which is the
    // answer that cannot surprise anybody.
    return false
  }
}

export function setPushEnabledHere(on: boolean): void {
  try {
    if (on) localStorage.setItem(ENABLED_KEY, '1')
    else localStorage.removeItem(ENABLED_KEY)
  } catch {
    /* The server still holds the token; this only costs a wrong button. */
  }
}

export function pushAvailability(): PushAvailability {
  if (typeof window === 'undefined') return 'unsupported'
  if (!firebaseConfigured() || !vapidKey()) return 'unsupported'
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'
  if (!('Notification' in window)) return 'unsupported'

  // Checked before the permission, because an iPhone in Safari reports
  // `default` and then refuses to deliver anything — telling somebody to allow
  // notifications there sends them to do something that cannot work.
  if (isIos() && !isStandalone()) return 'needs-install'

  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return 'available'
}

/**
 * The token for this browser, asking for permission first when needed.
 *
 * `null` when the answer was no, or when no token could be had. The caller
 * reports that as "not on" rather than as a failure: a browser that will not
 * issue a token will not deliver either, and there is nothing to store.
 */
async function tokenFor(ask: boolean): Promise<string | null> {
  if (ask) {
    // Must come from a tap. Safari refuses a prompt no gesture asked for, and
    // iOS counts it against the site.
    if ((await Notification.requestPermission()) !== 'granted') return null
  }

  // The worker already running the offline cache, rather than letting the SDK
  // register `firebase-messaging-sw.js` beside it: two workers on one origin
  // means two scopes racing for the same fetch events.
  const registration = await navigator.serviceWorker.ready

  const { getMessaging, getToken, isSupported } = await import('firebase/messaging')
  if (!(await isSupported())) return null

  try {
    return await getToken(getMessaging(firebaseApp()), {
      vapidKey: vapidKey(),
      serviceWorkerRegistration: registration,
    })
  } catch {
    // Blocked, offline, or the project has no Web Push certificate. None of
    // them is worth an error on a settings page.
    return null
  }
}

/** Turns notifications on for this browser. Call it from a tap. */
export async function enablePush(): Promise<string | null> {
  const state = pushAvailability()
  if (state === 'unsupported' || state === 'needs-install' || state === 'denied') return null

  const token = await tokenFor(state !== 'granted')
  if (token) setPushEnabledHere(true)
  return token
}

/**
 * The token for a browser that has already said yes.
 *
 * Called on every load of the shell, because FCM rotates tokens on its own —
 * there are reports of it doing so on iOS after a handful of notifications,
 * and a token stored once and never refreshed is a device that quietly stops
 * being reachable.
 */
export async function refreshPushToken(): Promise<string | null> {
  if (pushAvailability() !== 'granted') return null
  return tokenFor(false)
}

/**
 * The token to re-register on a load, or `null`.
 *
 * Gated on this app's own record rather than on the permission alone, so a
 * device somebody turned off is not turned back on by the next page load.
 */
export async function tokenToRefresh(): Promise<string | null> {
  if (!pushEnabledHere()) return null
  return refreshPushToken()
}

import { firebaseApp, firebaseConfigured } from '@/lib/auth/firebase-client'
import { isIos, isStandalone } from '@/lib/pwa'

/**
 * Permission, and the token it buys. **iOS delivers web push only to a Home
 * Screen app** — not Safari, not Chrome — so an iPhone is asked to install
 * before it is asked for permission. See docs/reference/realtime/push-notifications.md.
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
 * The other half of the configuration, and the half that is easy to miss.
 *
 * A deploy can carry a Web Push certificate and still have no sender id, and
 * then the card appears, the browser asks, somebody says yes — and `getToken`
 * throws. Checked here so the offer is never made.
 */
function senderId(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? ''
}

/**
 * The third of them, and the least obvious.
 *
 * Messaging asks Installations for an identity for this browser before it will
 * issue a token, and Installations refuses without an app id — nothing about
 * the message says push, it arrives as
 * `installations/missing-app-config-values`. Everywhere else in this app the
 * app id is an analytics detail that nothing misses.
 */
function appId(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? ''
}

/**
 * Using the permission, as opposed to having it — a page cannot take a browser
 * permission back, so without this "turn off" would be undone by the next
 * load's silent refresh. Per browser, hence `localStorage`.
 */
const ENABLED_KEY = 'medaily.push.enabled'

export function pushEnabledHere(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1'
  } catch {
    // Private window, or storage refused. Off is the answer that cannot
    // surprise anybody.
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

/**
 * Whether this browser has already been asked, once, on arriving.
 *
 * Asked once and never again: somebody who said no said it about the feature,
 * not about today, and a second ask is the kind of thing people turn a whole
 * app off over. Settings still offers it for as long as they want it.
 *
 * A browser that refuses storage reads as already asked. The alternative is
 * asking on every single load of a private window, which is the worst of both.
 */
const OFFERED_KEY = 'medaily.push.offered'

export function pushOfferedHere(): boolean {
  try {
    return localStorage.getItem(OFFERED_KEY) === '1'
  } catch {
    return true
  }
}

export function markPushOffered(): void {
  try {
    localStorage.setItem(OFFERED_KEY, '1')
  } catch {
    /* private mode — nothing to remember with, and nothing to be done */
  }
}

/** Dispatched after the answer changes, so anything showing it re-reads. */
export const PUSH_CHANGED = 'medaily:push-changed'

/** The permission is not a React value; this is how the app notices. */
export function announcePushChange(): void {
  window.dispatchEvent(new Event(PUSH_CHANGED))
}

export function pushAvailability(): PushAvailability {
  if (typeof window === 'undefined') return 'unsupported'
  if (!firebaseConfigured() || !vapidKey() || !senderId() || !appId()) return 'unsupported'
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'
  if (!('Notification' in window)) return 'unsupported'

  // Before the permission: an iPhone in Safari reports `default` and then
  // delivers nothing.
  if (isIos() && !isStandalone()) return 'needs-install'

  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return 'available'
}

/** `null` when refused or when no token could be had — both mean "not on". */
async function tokenFor(ask: boolean): Promise<string | null> {
  // Must come from a tap: Safari refuses a prompt no gesture asked for.
  if (ask && (await Notification.requestPermission()) !== 'granted') return null

  // The worker already running the offline cache, so the SDK does not register
  // a second one racing it for fetch events. Asked for before waiting, because
  // `ready` never settles where no worker was ever registered — which is every
  // dev build, and any browser whose registration failed.
  if (!(await navigator.serviceWorker.getRegistration())) {
    console.info('[push] no service worker here, so there is nothing to receive on')
    return null
  }
  const registration = await navigator.serviceWorker.ready

  const { getMessaging, getToken, isSupported } = await import('firebase/messaging')
  if (!(await isSupported())) return null

  try {
    return await getToken(getMessaging(firebaseApp()), {
      vapidKey: vapidKey(),
      serviceWorkerRegistration: registration,
    })
  } catch (error) {
    // Blocked, offline, or messaging not configured. The screen can only say
    // "could not register this device", so the reason goes to the console.
    console.info('[push] no token for this browser', error)
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

/** FCM rotates tokens on its own, so this is asked on every load. */
export async function refreshPushToken(): Promise<string | null> {
  if (pushAvailability() !== 'granted') return null
  return tokenFor(false)
}

/** Gated on our own record, so a device turned off stays off. */
export async function tokenToRefresh(): Promise<string | null> {
  if (!pushEnabledHere()) return null
  return refreshPushToken()
}

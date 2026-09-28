import { isIos } from '@/lib/pwa'

/**
 * Google One Tap — the card Google draws in the top corner offering the
 * accounts already signed in to the browser.
 *
 * **It does not work on iOS.** Google made FedCM mandatory for One Tap in
 * August 2025, Safari has no FedCM implementation planned, and every browser
 * on iOS is Safari underneath; Google's own support table lists One Tap as
 * unsupported there, webviews included. An installed home-screen app is the
 * furthest case of all. So this is a shortcut for desktop and Android, and the
 * remembered-account chips are what carries the same idea everywhere else.
 *
 * The token it hands back is Google's, not Firebase's. `signInWithGoogleCredential`
 * is where that is reconciled; nothing here talks to this app's server.
 */

/** The OAuth web client id. Its origins must be allowed in Google Cloud Console. */
export function googleClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''
}

/**
 * Whether it is worth loading Google's script at all.
 *
 * Asking first rather than letting it fail quietly: the script is ~50KB and a
 * third-party request on a page that has not authenticated anyone yet, and on
 * the platform where this app is mostly used it could never draw anything.
 */
export function oneTapAvailable(): boolean {
  if (typeof window === 'undefined') return false
  if (googleClientId().length === 0) return false
  return !isIos()
}

type CredentialResponse = { credential?: string }

type GoogleIdentity = {
  accounts: {
    id: {
      initialize(config: {
        client_id: string
        callback: (response: CredentialResponse) => void
        auto_select?: boolean
        cancel_on_tap_outside?: boolean
        context?: 'signin' | 'signup' | 'use'
        use_fedcm_for_prompt?: boolean
      }): void
      prompt(): void
      cancel(): void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdentity
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

/**
 * Loads Google's script once and resolves when its API is reachable.
 *
 * Keyed on the tag already being in the document rather than a module flag:
 * React runs an effect twice in development, and two copies of this script
 * initialise two One Tap instances that then fight over the same corner.
 */
function loadGis(): Promise<GoogleIdentity> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve(window.google)
      return
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    const script = existing ?? document.createElement('script')

    const done = () => {
      if (window.google?.accounts?.id) resolve(window.google)
      else reject(new Error('one tap: script loaded without the identity API'))
    }

    script.addEventListener('load', done, { once: true })
    script.addEventListener(
      'error',
      () => reject(new Error('one tap: script failed to load')),
      { once: true },
    )

    if (existing) return
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  })
}

/**
 * Shows the card, and returns how to take it away again.
 *
 * `auto_select` stays off. It would sign somebody in with the last account
 * used in this browser without them touching anything, which is the same
 * surprise the account chooser is forced to avoid elsewhere in this file's
 * neighbour — a shared machine opening a private journal on its own.
 */
export async function showOneTap(onCredential: (idToken: string) => void): Promise<() => void> {
  const google = await loadGis()

  google.accounts.id.initialize({
    client_id: googleClientId(),
    callback: (response) => {
      if (response.credential) onCredential(response.credential)
    },
    auto_select: false,
    cancel_on_tap_outside: true,
    context: 'signin',
    // Mandatory since August 2025; without it Chrome refuses to show anything.
    use_fedcm_for_prompt: true,
  })

  google.accounts.id.prompt()

  return () => {
    try {
      google.accounts.id.cancel()
    } catch {
      /* already gone, or the script was torn out from under us */
    }
  }
}

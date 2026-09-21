import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  browserPopupRedirectResolver,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
} from 'firebase/auth'
import { needsAuthRedirect } from '@/lib/pwa'

/**
 * Browser-side Firebase, used for exactly one thing: obtaining a Google ID
 * token to hand to `/api/auth/google`. Nothing else in the app talks to
 * Firebase, and no Firebase state is trusted for authorization.
 *
 * These values are public by design — Firebase web config is not a secret,
 * it identifies the project. What protects the app is the server verifying
 * the token's signature and the allowlist.
 *
 * `authDomain` is the **page host**, not `*.firebaseapp.com`. Safari and
 * Chromium block the cross-site storage `signInWithRedirect` needs when the
 * helper lives on another origin. `next.config` already proxies `/__/auth/*`
 * to the Firebase project, so same-origin authDomain is Option 3 from
 * https://firebase.google.com/docs/auth/web/redirect-best-practices
 */
function firebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain:
      typeof window !== 'undefined'
        ? window.location.host
        : (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? ''),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  }
}

/** Survives the Google redirect round-trip so we land on the intended page. */
const NEXT_PATH_KEY = 'medaily.auth.next'

/** False when the deploy has no Firebase project: the button then stays hidden. */
export function firebaseConfigured(): boolean {
  const config = firebaseConfig()
  return config.apiKey.length > 0 && config.projectId.length > 0
}

function firebaseApp(): FirebaseApp {
  const config = firebaseConfig()
  if (getApps().length > 0) return getApp()
  return initializeApp(config)
}

function firebaseAuth(): Auth {
  return getAuth(firebaseApp())
}

export type GoogleSignInFailure = 'cancelled' | 'popup_blocked' | 'failed'

export class GoogleSignInError extends Error {
  constructor(readonly reason: GoogleSignInFailure) {
    super(`google sign-in failed: ${reason}`)
    this.name = 'GoogleSignInError'
  }
}

function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider()
  // Always show the chooser: on a shared machine, silently reusing the last
  // Google account is a surprising way to open someone's private journal.
  provider.setCustomParameters({ prompt: 'select_account' })
  return provider
}

export function rememberAuthNext(next: string | undefined): void {
  try {
    if (next) sessionStorage.setItem(NEXT_PATH_KEY, next)
    else sessionStorage.removeItem(NEXT_PATH_KEY)
  } catch {
    /* private mode */
  }
}

export function takeAuthNext(): string | undefined {
  try {
    const value = sessionStorage.getItem(NEXT_PATH_KEY) ?? undefined
    sessionStorage.removeItem(NEXT_PATH_KEY)
    return value
  } catch {
    return undefined
  }
}

/**
 * Returns a fresh ID token, or `null` when a full-page redirect was started
 * (iOS / standalone — the page is about to leave).
 *
 * Do **not** pass `browserPopupRedirectResolver` into `signInWithRedirect`:
 * that resolver opens ASWebAuthenticationSession (the sheet with "Done"),
 * where iOS often focuses the email field and never raises the keyboard.
 */
export async function signInWithGoogle(): Promise<string | null> {
  const auth = firebaseAuth()
  const provider = googleProvider()

  if (needsAuthRedirect()) {
    await signInWithRedirect(auth, provider)
    return null
  }

  try {
    const credential = await signInWithPopup(auth, provider, browserPopupRedirectResolver)
    return await credential.user.getIdToken()
  } catch (error) {
    const code = (error as { code?: string }).code ?? ''
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw new GoogleSignInError('cancelled')
    }
    if (code === 'auth/popup-blocked') throw new GoogleSignInError('popup_blocked')
    throw new GoogleSignInError('failed')
  }
}

/**
 * After `signInWithRedirect` returns to `/login`, pull the credential once.
 * Resolves `null` on a normal visit with no pending redirect.
 */
export async function completeGoogleRedirect(): Promise<string | null> {
  if (!firebaseConfigured()) return null
  try {
    const credential = await getRedirectResult(firebaseAuth())
    if (!credential) return null
    return await credential.user.getIdToken()
  } catch (error) {
    const code = (error as { code?: string }).code ?? ''
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw new GoogleSignInError('cancelled')
    }
    throw new GoogleSignInError('failed')
  }
}

/**
 * Clears the Firebase session in this browser. Our own cookie is what governs
 * access, but leaving Firebase signed in means the next visitor gets straight
 * back in without a chooser.
 */
export async function signOutFirebase(): Promise<void> {
  if (!firebaseConfigured()) return
  try {
    await signOut(firebaseAuth())
  } catch {
    // Signing out locally must never block signing out of the app itself.
  }
}

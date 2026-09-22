import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  browserPopupRedirectResolver,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type Auth,
} from 'firebase/auth'

/**
 * Browser-side Firebase, used for exactly one thing: obtaining a Google ID
 * token to hand to `/api/auth/google`. Nothing else in the app talks to
 * Firebase, and no Firebase state is trusted for authorization.
 *
 * These values are public by design — Firebase web config is not a secret,
 * it identifies the project. What protects the app is the server verifying
 * the token's signature and the allowlist.
 *
 * `authDomain` is the **page host**, not `*.firebaseapp.com`. The popup loads
 * Firebase's helper from authDomain, so on the default domain it is reading
 * and writing storage cross-site — the thing Safari's ITP and Chromium's
 * partitioning keep narrowing. `next.config` proxies `/__/auth/*` to the
 * project, which is Option 3 from
 * https://firebase.google.com/docs/auth/web/redirect-best-practices
 * It also puts the app's own domain on Google's consent screen rather than a
 * firebaseapp.com address nobody recognises.
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

/** False when the deploy has no Firebase project: the button then stays hidden. */
export function firebaseConfigured(): boolean {
  const config = firebaseConfig()
  return config.apiKey.length > 0 && config.projectId.length > 0
}

function firebaseApp(): FirebaseApp {
  if (getApps().length > 0) return getApp()
  return initializeApp(firebaseConfig())
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

/**
 * Returns a fresh ID token. The token is short-lived and used once — the
 * server trades it for a session cookie and never stores it.
 */
export async function signInWithGoogle(): Promise<string> {
  const auth = firebaseAuth()
  const provider = new GoogleAuthProvider()
  // Always show the chooser: on a shared machine, silently reusing the last
  // Google account is a surprising way to open someone's private journal.
  provider.setCustomParameters({ prompt: 'select_account' })

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

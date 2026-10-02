import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  browserPopupRedirectResolver,
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type Auth,
} from 'firebase/auth'

/**
 * Browser-side Firebase: an ID token for `/api/auth/google`, and analytics
 * where a measurement id is set. No Firebase state is trusted for
 * authorization, and this config is public by design.
 *
 * `authDomain` is the **page host**, not `*.firebaseapp.com`, so the auth
 * helper is same-site rather than fighting ITP — `next.config` proxies
 * `/__/auth/*`. Option 3 of
 * https://firebase.google.com/docs/auth/web/redirect-best-practices
 */
function firebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: authDomain(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    /*
     * Messaging will not issue a token without the sender id — it is the
     * number the push service registers the subscription against, and leaving
     * it out failed every registration with nothing on screen but "could not
     * register this device". `appId` is wanted by messaging too.
     *
     * The rest only matters to analytics. Firebase ignores what it is not
     * asked for, so all of it sits in the one config rather than in a second
     * one that would initialise a second app for the same project.
     */
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? '',
  }
}

/**
 * The page's own host where that can work, the project's own domain where it
 * cannot.
 *
 * Firebase builds its helper address itself, always as
 * `https://<authDomain>/__/auth/handler` — the scheme is not ours to choose.
 * `next dev` serves plain http, so handing it `localhost:3000` produces
 * `https://localhost:3000/__/auth/handler`, and the popup dies on
 * `ERR_SSL_PROTOCOL_ERROR` before Google is ever reached.
 *
 * Asking about the scheme rather than the hostname: a tunnelled or
 * self-signed https dev server can use the same-origin trick and should, and
 * anything served over http cannot, whatever it is called.
 */
function authDomain(): string {
  const configured = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? ''
  if (typeof window === 'undefined') return configured
  return window.location.protocol === 'https:' ? window.location.host : configured
}

/** False when the deploy has no Firebase project: the button then stays hidden. */
export function firebaseConfigured(): boolean {
  const config = firebaseConfig()
  return config.apiKey.length > 0 && config.projectId.length > 0
}

/**
 * Analytics needs an app id and a measurement id on top of what signing in
 * needs, so it is configured separately and can be off while sign-in is on.
 */
export function firebaseAnalyticsConfigured(): boolean {
  const config = firebaseConfig()
  return firebaseConfigured() && config.appId.length > 0 && config.measurementId.length > 0
}

/** Shared, so analytics and sign-in never initialise two apps for one project. */
export function firebaseApp(): FirebaseApp {
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
 * A fresh ID token, used once for the session cookie and never stored.
 *
 * `hint` is an address already picked by tapping a remembered account, so
 * Google opens straight into it. Without one the chooser is forced: silently
 * reusing the last account on a shared machine opens a private journal.
 */
export async function signInWithGoogle(hint?: string): Promise<string> {
  const auth = firebaseAuth()
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters(hint ? { login_hint: hint } : { prompt: 'select_account' })

  try {
    const credential = await signInWithPopup(auth, provider, browserPopupRedirectResolver)
    return await credential.user.getIdToken()
  } catch (error) {
    throw asSignInError(error)
  }
}

/**
 * One Tap's token is Google's; the server verifies Firebase's. Exchanging here
 * means One Tap needs no server change at all.
 *
 * No nonce: `GoogleAuthProvider.credential` takes no raw nonce to check one
 * against, so sending one returns `auth/invalid-credential`. The token is
 * still bound by its audience and the origin Google delivers it to.
 */
export async function signInWithGoogleCredential(idToken: string): Promise<string> {
  const auth = firebaseAuth()

  try {
    const credential = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken))
    return await credential.user.getIdToken()
  } catch (error) {
    throw asSignInError(error)
  }
}

function asSignInError(error: unknown): GoogleSignInError {
  const code = (error as { code?: string }).code ?? ''
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return new GoogleSignInError('cancelled')
  }
  if (code === 'auth/popup-blocked') return new GoogleSignInError('popup_blocked')
  return new GoogleSignInError('failed')
}

/** All three ways in end with a Firebase user; only it knows the name and photo. */
export function currentAccount(): {
  email: string
  name: string | null
  photoUrl: string | null
} | null {
  const user = firebaseAuth().currentUser
  if (!user?.email) return null
  return { email: user.email, name: user.displayName, photoUrl: user.photoURL }
}

/** Our cookie governs access; this stops the next visitor skipping the chooser. */
export async function signOutFirebase(): Promise<void> {
  if (!firebaseConfigured()) return
  try {
    await signOut(firebaseAuth())
  } catch {
    // Signing out locally must never block signing out of the app itself.
  }
}

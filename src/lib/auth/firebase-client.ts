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
 * Browser-side Firebase. Two things use it: obtaining a Google ID token to
 * hand to `/api/auth/google`, and — where a measurement id is configured —
 * analytics, which shares this app rather than initialising a second one.
 * No Firebase state is trusted for authorization.
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
 * Returns a fresh ID token. The token is short-lived and used once — the
 * server trades it for a session cookie and never stores it.
 *
 * `hint` is an address the visitor has already picked, by tapping a remembered
 * account. Google then opens straight into it instead of asking which one,
 * which is the whole point of the chip. Without a hint the chooser is forced:
 * on a shared machine, silently reusing the last Google account is a
 * surprising way to open someone's private journal. Picking the account *is*
 * the choice that rule exists to require, so a hint does not weaken it.
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
 * Trades a Google ID token — the one One Tap hands back — for a Firebase one.
 *
 * This is what keeps One Tap off the server. The token One Tap issues is
 * Google's, signed by `accounts.google.com`; `/api/auth/google` verifies
 * Firebase's, signed by `securetoken@system`, and every account in the
 * database is keyed by the Firebase uid it carries. Exchanging here means the
 * new door opens onto the same accounts as the old one, and not a line of the
 * server changes.
 *
 * No nonce. GIS can put one in the token, but `GoogleAuthProvider.credential`
 * takes no raw nonce to check it against — that parameter exists on the
 * generic OIDC provider, not this one — so a nonce sent here comes back as
 * `auth/invalid-credential`. What remains binding the token is its audience,
 * which is this app's client id, and the origin Google will only deliver it
 * to.
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

/**
 * Who Firebase says just signed in, in the shape the chip row stores.
 *
 * Read from Firebase rather than passed down from the caller because the three
 * ways in — the button, a chip, One Tap — all end with a Firebase user and
 * none of them otherwise knows the display name or the picture.
 */
export function currentAccount(): {
  email: string
  name: string | null
  photoUrl: string | null
} | null {
  const user = firebaseAuth().currentUser
  if (!user?.email) return null
  return { email: user.email, name: user.displayName, photoUrl: user.photoURL }
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

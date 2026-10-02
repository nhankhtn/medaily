import type { Auth } from 'firebase/auth'
import { NO_REALTIME, NO_TYPING, type RealtimeSignal, type TypingChannel } from './signal'

/**
 * Read from the environment, not the picked provider: every export of a
 * `'use client'` module is a client reference, and reading a property off one
 * from a server component throws.
 */
export function realtimeEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_REALTIME_ENABLED === '1' &&
    Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) &&
    Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
  )
}

/**
 * Browser only, and chat never depends on it: the password path leaves no
 * Firebase session, so a missing transport means "late", not "broken".
 */
export async function pickRealtimeSignal(): Promise<RealtimeSignal> {
  if (await realtimeOff()) return NO_REALTIME

  const { firestoreSignal } = await import('./firestore')
  return firestoreSignal()
}

/**
 * Same gates as the doorbell, separate function: a screen that wants only the
 * doorbell never loads the typing code.
 */
export async function pickTypingChannel(): Promise<TypingChannel> {
  if (await realtimeOff()) return NO_TYPING

  const { firestoreTyping } = await import('./firestore')
  return firestoreTyping()
}

/** Why live updates are not on, in the words somebody would need to act. */
const REASONS = {
  flag: 'NEXT_PUBLIC_REALTIME_ENABLED is not "1" in this build. It is baked in at build time, so setting it needs a restart or a redeploy.',
  firebase: 'this build has no Firebase project configured.',
  session:
    'this session has no Firebase session and one could not be minted. Set FIREBASE_SERVICE_ACCOUNT (see .env.example) so the server can vouch for password sign-ins, or sign in with Google.',
} as const

const said = new Set<keyof typeof REASONS>()

/**
 * Whether to fall back, and says once why.
 *
 * Every gate here used to close in silence. That is right for the app — chat
 * works either way and a toast about transports helps nobody — but it left
 * "typing never shows" and "the flag is unset" looking identical from the
 * outside, which cost an afternoon. One console line, once per reason, names
 * the gate that closed.
 */
async function realtimeOff(): Promise<boolean> {
  if (typeof window === 'undefined') return true

  const missing =
    !process.env.NEXT_PUBLIC_FIREBASE_API_KEY || !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  if (missing) return explain('firebase')
  if (process.env.NEXT_PUBLIC_REALTIME_ENABLED !== '1') return explain('flag')

  const { getAuth } = await import('firebase/auth')
  const { firebaseApp } = await import('@/lib/auth/firebase-client')
  const auth = getAuth(firebaseApp())

  // Firebase restores the session from storage asynchronously, so for the
  // first few hundred milliseconds of a page `currentUser` is null even for
  // somebody who is signed in. Reading it straight away would decide "no
  // session" on a fresh load, and nothing asks again — the room would then sit
  // on the slow poll for as long as it stayed open, with live updates
  // configured and perfectly able to work.
  await auth.authStateReady()
  if (auth.currentUser) return false

  // Nothing in storage. The password path never put a Firebase session there,
  // and on iOS neither did Google: Safari clears site data after a week idle,
  // and a home-screen app keeps its own, while this app's own cookie outlives
  // both. So ask the server to vouch rather than conclude anything about how
  // this person signed in.
  if (await adopt(auth)) return false

  return explain('session')
}

/** One attempt per page. A second would fail for the same reason as the first. */
let adopted: Promise<boolean> | null = null

function adopt(auth: Auth): Promise<boolean> {
  adopted ??= (async () => {
    const [{ signInWithCustomToken }, { realtimeToken }] = await Promise.all([
      import('firebase/auth'),
      import('@/server/actions/realtime'),
    ])

    try {
      const minted = await realtimeToken()
      if (!minted) return false
      await signInWithCustomToken(auth, minted.token)
      return true
    } catch (error) {
      // Logged rather than thrown: chat works without this, and a page that
      // will not render because a transport could not be opened is worse than
      // one that falls back to asking on a timer.
      console.info('[realtime] could not open a Firebase session', error)
      return false
    }
  })()

  return adopted
}

function explain(reason: keyof typeof REASONS): true {
  if (!said.has(reason)) {
    said.add(reason)
    console.info(`[realtime] live updates are off: ${REASONS[reason]}`)
  }
  return true
}

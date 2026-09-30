import { NO_REALTIME, type RealtimeSignal } from './signal'

/**
 * Whether live updates are offered.
 *
 * Read from the environment rather than from the picked provider. Every export
 * of a `'use client'` module is a client reference, and reading a property off
 * one from a server component throws — the analytics seam next door documents
 * the same trap.
 */
export function realtimeEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_REALTIME_ENABLED === '1' &&
    Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) &&
    Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
  )
}

/**
 * Picks the transport, in the browser only.
 *
 * Chat never depends on this. Signing in with a password leaves no Firebase
 * session — and that path exists precisely as the way back in when Firebase is
 * unreachable — so a missing transport has to mean "late", not "broken". The
 * screen falls back to asking on a slow timer.
 */
export async function pickRealtimeSignal(): Promise<RealtimeSignal> {
  if (typeof window === 'undefined' || !realtimeEnabled()) return NO_REALTIME

  const { getAuth } = await import('firebase/auth')
  const { firebaseApp } = await import('@/lib/auth/firebase-client')
  if (!getAuth(firebaseApp()).currentUser) return NO_REALTIME

  const { firestoreSignal } = await import('./firestore')
  return firestoreSignal()
}

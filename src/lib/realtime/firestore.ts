'use client'

import { doc, getFirestore, increment, onSnapshot, setDoc } from 'firebase/firestore'
import { firebaseApp } from '@/lib/auth/firebase-client'
import type { RealtimeSignal } from './signal'

const CHANNELS = 'channels'

/**
 * Firestore as a doorbell.
 *
 * It is the only thing already in this stack that a browser can hold a cheap,
 * authenticated, persistent connection to — which is the entire reason it is
 * here. It is not storing anything: one document per channel holding a counter
 * and a time, and no word anybody typed ever reaches it.
 *
 * That is what makes the security rules small enough to be obviously right.
 * Being signed in to Firebase means very little here — the project's sign-in
 * is not gated by this app's allowlists — so the protection is that a channel
 * key is 122 bits of random and rotates when somebody is removed. The worst a
 * key buys is knowing that a room exists and when it was busy.
 */
export function firestoreSignal(): RealtimeSignal {
  return {
    id: 'firestore',

    ring: async (channel) => {
      await setDoc(
        doc(getFirestore(firebaseApp()), CHANNELS, channel),
        { seq: increment(1), at: Date.now() },
        { merge: true },
      )
    },

    listen: (channel, onRing) =>
      onSnapshot(
        doc(getFirestore(firebaseApp()), CHANNELS, channel),
        // Edge-triggered: any change at all means "ask the server". The
        // contents are never read, so nothing written here can suppress a
        // later ring — a counter comparison could be poisoned once and stay
        // poisoned.
        (snapshot) => {
          if (snapshot.metadata.hasPendingWrites) return
          onRing()
        },
        () => {
          /* Offline, blocked, or refused by rules. The slow poll still runs. */
        },
      ),
  }
}

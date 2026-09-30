'use client'

import { getAuth } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  increment,
  onSnapshot,
  setDoc,
} from 'firebase/firestore'
import { firebaseApp } from '@/lib/auth/firebase-client'
import type { RealtimeSignal, TypingChannel } from './signal'
import type { TypingEntry } from './typing'

const CHANNELS = 'channels'

/** Sub-collection of the channel: one document per person, named by their uid. */
const TYPING = 'typing'

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

/**
 * "Somebody is typing", carried by the same connection as the doorbell.
 *
 * This is the one thing in this file with a payload, and the rules are what
 * make it safe to render. A document is named by a Firebase uid and
 * `request.auth.uid == uid` is enforced on write, so a claim can only ever be
 * made in the claimant's own name — knowing a channel key buys the ability to
 * say "I am typing" as yourself, which is what everyone in the room can do
 * anyway, and nothing else.
 *
 * One document per person, not one field per person on the channel document:
 * Firestore sustains about a write a second per document, and three people
 * typing into one would start dropping each other's.
 *
 * It does mean Firestore now knows something it did not before — that a uid
 * was active in a room at a time. No word anybody typed still reaches it.
 */
export function firestoreTyping(): TypingChannel {
  const typing = (channel: string) =>
    collection(getFirestore(firebaseApp()), CHANNELS, channel, TYPING)

  return {
    id: 'firestore',

    announce: async (channel) => {
      const uid = getAuth(firebaseApp()).currentUser?.uid
      // No Firebase session — signed in with the password. They have no live
      // updates either, so there is nobody to be consistent with but themselves.
      if (!uid) return

      await setDoc(doc(typing(channel), uid), { at: Date.now() })
    },

    retract: async (channel) => {
      const uid = getAuth(firebaseApp()).currentUser?.uid
      if (!uid) return
      // The only delete in this file, and the reason the rules separate
      // `delete` from `create, update`: on a delete `request.resource` is
      // null, so a rule that inspects the written fields would refuse it.
      await deleteDoc(doc(typing(channel), uid))
    },

    watch: (channel, onChange) =>
      onSnapshot(
        typing(channel),
        (snapshot) => {
          const entries: TypingEntry[] = []
          for (const document of snapshot.docs) {
            const at = document.get('at')
            // Written by a client, so the shape is a claim rather than a fact.
            // `activeTypists` decides what to do with the number; this only
            // decides it is a number.
            if (typeof at === 'number') entries.push({ uid: document.id, at })
          }
          onChange(entries)
        },
        () => {
          /* Offline, blocked, or refused by rules. Nobody appears to be typing. */
        },
      ),
  }
}

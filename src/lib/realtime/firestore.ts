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
 * Firestore as a doorbell: one document per channel holding a counter and a
 * time, and no word anybody typed. The protection is the 122-bit channel key,
 * not the Firebase session — see docs/reference/realtime/doorbell.md.
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
        // Edge-triggered. Nothing here reads the contents, so a poisoned
        // counter cannot deafen anyone.
        (snapshot) => {
          if (snapshot.metadata.hasPendingWrites) return
          onRing()
        },
        // Caught, because the slow poll still runs and a chat that interrupts
        // you over a dropped socket is worse than one that is briefly late.
        // Said, because this is the listener that silence is most expensive
        // on: WebChannel logs a bare "transport errored" either way, so
        // without the code there is no telling a reconnect from a refusal.
        complain('doorbell'),
      ),
  }
}

/**
 * "Somebody is typing", on the same connection. Safe to render because the
 * rules tie a write to `request.auth.uid`, so a claim is only ever made in the
 * claimant's own name. One document per person — Firestore sustains about a
 * write a second per document.
 */
export function firestoreTyping(): TypingChannel {
  const typing = (channel: string) =>
    collection(getFirestore(firebaseApp()), CHANNELS, channel, TYPING)

  return {
    id: 'firestore',

    announce: async (channel) => {
      // No Firebase session means the password path, which has no live
      // updates either.
      const uid = getAuth(firebaseApp()).currentUser?.uid
      if (!uid) return

      await setDoc(doc(typing(channel), uid), { at: Date.now() }).catch(complain('typing announce'))
    },

    retract: async (channel) => {
      const uid = getAuth(firebaseApp()).currentUser?.uid
      if (!uid) return
      // The rules separate `delete` from `create, update` because
      // `request.resource` is null here.
      await deleteDoc(doc(typing(channel), uid)).catch(complain('typing retract'))
    },

    watch: (channel, onChange) =>
      onSnapshot(
        typing(channel),
        (snapshot) => {
          const entries: TypingEntry[] = []
          for (const document of snapshot.docs) {
            // Client-written, so this only checks it is a number;
            // `activeTypists` decides what it means.
            const at = document.get('at')
            if (typeof at === 'number') entries.push({ uid: document.id, at })
          }
          onChange(entries)
        },
        // Offline, blocked, or refused by rules: nobody appears to be typing,
        // which is right for the screen and useless for whoever has to work
        // out why. So it is said once, here.
        complain('typing watch'),
      ),
  }
}

const complained = new Set<string>()

/**
 * Says once why a realtime call did nothing.
 *
 * Every one of these is caught on purpose — a chat that interrupts you because
 * a presence write failed is worse than one that quietly stops showing who is
 * typing. But caught and unsaid is how "there are requests and no documents"
 * became a thing nobody could tell apart from "the rules are not deployed".
 * Over WebChannel a refused write still answers 200, so the network tab cannot
 * tell you either.
 */
function complain(where: string) {
  return (error: unknown) => {
    const code = (error as { code?: string })?.code ?? 'unknown'
    if (complained.has(`${where}:${code}`)) return
    complained.add(`${where}:${code}`)

    const hint =
      code === 'permission-denied'
        ? ' — the rules in firestore.rules are not deployed, or not deployed to this project. Run `pnpm firestore:rules`.'
        : ''
    console.info(`[realtime] ${where} was refused: ${code}${hint}`)
  }
}

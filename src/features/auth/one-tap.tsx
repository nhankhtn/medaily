'use client'

import { useEffect, useRef } from 'react'
import { firebaseConfigured, signInWithGoogleCredential } from '@/lib/auth/firebase-client'
import { oneTapAvailable, showOneTap } from '@/lib/auth/one-tap'
import { useGoogleSignIn } from './use-google-sign-in'

/**
 * Mounts Google One Tap on the sign-in page. Renders nothing: the card is
 * drawn by the browser, or by Google's own iframe, and lives outside this
 * tree either way.
 *
 * Silent where it cannot work — on iOS, or with no client id configured —
 * rather than showing a placeholder for a card that will never arrive. The
 * remembered-account chips above the button are what those visitors get, and
 * they are the same one-tap idea by a route that exists everywhere.
 */
export function OneTap({ next }: { next?: string }) {
  const { signIn } = useGoogleSignIn(next)

  // The effect below must not re-run when `signIn` is re-created, or the card
  // is dismissed and re-summoned on every render that touches the hook. Kept
  // current from an effect rather than from the render body, which would be a
  // write during render.
  const signInRef = useRef(signIn)
  useEffect(() => {
    signInRef.current = signIn
  })

  useEffect(() => {
    if (!oneTapAvailable() || !firebaseConfigured()) return

    let cancel: (() => void) | null = null
    let dropped = false

    void showOneTap((idToken) => {
      void signInRef.current(() => signInWithGoogleCredential(idToken))
    })
      .then((dismiss) => {
        // Unmounted while Google's script was still loading: take the card
        // straight back down rather than leaving it over the next page.
        if (dropped) dismiss()
        else cancel = dismiss
      })
      .catch(() => {
        /* offline, blocked, or refused. The button below still works. */
      })

    return () => {
      dropped = true
      cancel?.()
    }
  }, [])

  return null
}

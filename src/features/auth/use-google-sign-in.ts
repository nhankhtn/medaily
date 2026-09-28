'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import {
  currentAccount,
  GoogleSignInError,
  signOutFirebase,
} from '@/lib/auth/firebase-client'
import { localAccountStore, remember } from '@/lib/auth/remembered-accounts'
import { safeNextPath } from '@/lib/paths'

/**
 * Everything that happens after a Google ID token exists, in one place.
 *
 * There are three ways in now — the button, a remembered chip, and One Tap —
 * and they differ only in how the token is obtained. Handing back the cookie,
 * naming the failures, remembering the account and leaving the page are the
 * same every time, and three copies of that would be three copies to keep in
 * step. The caller passes how to get a token; this owns the rest.
 */
export function useGoogleSignIn(next?: string) {
  const t = useTranslations('auth')
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signIn = useCallback(
    async (getToken: () => Promise<string>) => {
      setError(null)
      setPending(true)

      try {
        const idToken = await getToken()

        const response = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ idToken }),
        })
        const result = (await response.json()) as { ok: boolean; error?: string }

        if (!result.ok) {
          // Firebase let them in and we did not. Leaving that session behind
          // would mean the next attempt walks past the chooser into an account
          // this app has already refused.
          await signOutFirebase()
          setError(t(errorKey(result.error)))
          return
        }

        rememberThisAccount()
        router.replace(safeNextPath(next))
        router.refresh()
      } catch (cause) {
        if (cause instanceof GoogleSignInError) {
          // Closing the chooser is an answer, not a fault. Saying "sign-in
          // failed" over it reads as a bug the visitor has to work around.
          if (cause.reason === 'cancelled') return
          setError(t(cause.reason === 'popup_blocked' ? 'popupBlocked' : 'googleFailed'))
          return
        }
        setError(t('googleFailed'))
      } finally {
        setPending(false)
      }
    },
    [next, router, t],
  )

  return { pending, error, signIn }
}

/**
 * Only after the cookie is set: an address that got as far as Google but was
 * turned away here is not one to offer as a shortcut back.
 */
function rememberThisAccount(): void {
  const account = currentAccount()
  if (!account) return

  const store = localAccountStore()
  store.write(remember(store.read(), { ...account, lastUsedAt: Date.now() }))
}

export function errorKey(error: string | undefined): string {
  switch (error) {
    case 'not_allowed':
      return 'notAllowed'
    case 'not_configured':
      return 'notConfigured'
    case 'rate_limited':
      return 'rateLimited'
    default:
      return 'googleFailed'
  }
}

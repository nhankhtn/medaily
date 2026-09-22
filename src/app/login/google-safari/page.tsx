'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { Logo } from '@/components/brand/logo'
import {
  completeGoogleRedirect,
  firebaseConfigured,
  GoogleSignInError,
  signInWithGoogle,
  signOutFirebase,
} from '@/lib/auth/firebase-client'

/**
 * Runs Google sign-in inside Safari (opened from the PWA via target=_blank).
 * Safari raises the keyboard; the system auth sheet inside the PWA does not.
 * After the session cookie is set here, we mint a 6-digit code for the PWA.
 */
export default function GoogleSafariPage() {
  const t = useTranslations('auth')
  const [phase, setPhase] = useState<'working' | 'code' | 'error'>('working')
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    let cancelled = false
    ;(async () => {
      if (!firebaseConfigured()) {
        setError(t('notConfigured'))
        setPhase('error')
        return
      }

      try {
        let idToken = await completeGoogleRedirect()
        if (!idToken) {
          idToken = await signInWithGoogle()
          // Redirect path — page is leaving.
          if (!idToken) return
        }
        if (cancelled) return

        const exchange = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ idToken }),
        })
        const exchanged = (await exchange.json()) as { ok: boolean; error?: string }
        if (!exchanged.ok) {
          await signOutFirebase()
          setError(t(exchanged.error === 'not_allowed' ? 'notAllowed' : 'googleFailed'))
          setPhase('error')
          return
        }

        const handoff = await fetch('/api/auth/handoff', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
        const minted = (await handoff.json()) as { ok: boolean; code?: string }
        if (!minted.ok || !minted.code) {
          setError(t('googleFailed'))
          setPhase('error')
          return
        }

        setCode(minted.code)
        setPhase('code')
      } catch (cause) {
        if (cancelled) return
        if (cause instanceof GoogleSignInError && cause.reason === 'cancelled') {
          setError(t('safariCancelled'))
          setPhase('error')
          return
        }
        setError(t('googleFailed'))
        setPhase('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [t])

  return (
    <div className="login-page relative flex min-h-dvh flex-col items-center justify-center gap-6 overflow-hidden px-6">
      <div aria-hidden className="login-orb login-orb-a" />
      <div aria-hidden className="login-orb login-orb-b" />
      <Logo size={48} frosted className="relative z-10 shadow-[var(--shadow-card)]" />

      <div className="glass-strong relative z-10 w-full max-w-sm space-y-4 rounded-[var(--radius)] px-5 py-6 text-center">
        {phase === 'working' ? (
          <>
            <Loader2 className="mx-auto size-6 animate-spin text-accent" />
            <p className="text-sm text-text-muted">{t('safariWorking')}</p>
          </>
        ) : null}

        {phase === 'code' && code ? (
          <>
            <h1 className="font-brand text-xl font-semibold tracking-tight">{t('safariCodeTitle')}</h1>
            <p className="text-sm text-text-muted">{t('safariCodeHint')}</p>
            <p className="font-brand text-4xl font-semibold tracking-[0.35em] tabular-nums text-accent">
              {code}
            </p>
            <p className="text-xs text-text-subtle">{t('safariCodeExpiry')}</p>
          </>
        ) : null}

        {phase === 'error' && error ? (
          <p role="alert" className="text-sm text-bad">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}

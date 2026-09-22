'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import {
  completeGoogleRedirect,
  firebaseConfigured,
  GoogleSignInError,
  signInWithGoogle,
  signOutFirebase,
} from '@/lib/auth/firebase-client'

/**
 * Google sign-in that runs outside the home-screen PWA.
 *
 * iOS opens `target=_blank` as SFSafariViewController (back label "Personal OS"),
 * not full Safari — that sheet still has a working keyboard, unlike the auth
 * sheet Firebase opens inside the PWA. Auto-starting OAuth on mount produced
 * Google 400 malformed; start only from a tap.
 */
export default function GoogleSafariPage() {
  const t = useTranslations('auth')
  const [phase, setPhase] = useState<'ready' | 'working' | 'code' | 'error'>('working')
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const finishing = useRef(false)

  useEffect(() => {
    if (finishing.current) return
    finishing.current = true

    let cancelled = false
    ;(async () => {
      if (!firebaseConfigured()) {
        setError(t('notConfigured'))
        setPhase('error')
        return
      }

      try {
        const idToken = await completeGoogleRedirect()
        if (cancelled) return
        if (!idToken) {
          setPhase('ready')
          return
        }
        await finishWithToken(idToken)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finishWithToken = async (idToken: string) => {
    setPhase('working')
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
  }

  const start = async () => {
    setError(null)
    setPhase('working')
    try {
      const idToken = await signInWithGoogle()
      if (!idToken) return
      await finishWithToken(idToken)
    } catch (cause) {
      if (cause instanceof GoogleSignInError && cause.reason === 'cancelled') {
        setError(t('safariCancelled'))
        setPhase('error')
        return
      }
      setError(t('googleFailed'))
      setPhase('error')
    }
  }

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

        {phase === 'ready' ? (
          <>
            <h1 className="font-brand text-xl font-semibold tracking-tight">{t('safariReadyTitle')}</h1>
            <p className="text-sm text-text-muted">{t('safariReadyHint')}</p>
            <Button type="button" size="lg" className="w-full" onClick={start}>
              {t('continueWithGoogle')}
            </Button>
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

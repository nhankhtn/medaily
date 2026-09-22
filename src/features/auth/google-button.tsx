'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  completeGoogleRedirect,
  firebaseConfigured,
  GoogleSignInError,
  rememberAuthNext,
  signInWithGoogle,
  signOutFirebase,
  takeAuthNext,
} from '@/lib/auth/firebase-client'
import { isStandalone } from '@/lib/pwa'
import { PATHS, safeNextPath } from '@/lib/paths'

/** Google's mark, inlined: an external image would be blocked and would leak a request. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden className="size-4">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.94v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.94a9 9 0 0 0 0 8.1l3.03-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.95l3.03 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}

export function GoogleButton({ next }: { next?: string }) {
  const configured = firebaseConfigured()
  const t = useTranslations('auth')
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [iosFlow, setIosFlow] = useState(false)
  const [handoffCode, setHandoffCode] = useState('')
  const [claiming, setClaiming] = useState(false)
  const finishingRedirect = useRef(false)

  useEffect(() => {
    // Only the home-screen app needs the Safari detour — iOS Safari itself
    // can complete a full-page redirect with a working keyboard.
    setIosFlow(isStandalone())
  }, [])

  const exchange = async (idToken: string, nextPath: string | undefined) => {
    const response = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
    const result = (await response.json()) as { ok: boolean; error?: string }

    if (!result.ok) {
      await signOutFirebase()
      setError(t(errorKey(result.error)))
      return
    }

    router.replace(safeNextPath(nextPath))
    router.refresh()
  }

  useEffect(() => {
    if (!configured || iosFlow || finishingRedirect.current) return
    finishingRedirect.current = true

    let cancelled = false
    ;(async () => {
      try {
        const idToken = await completeGoogleRedirect()
        if (cancelled || !idToken) return
        setPending(true)
        await exchange(idToken, takeAuthNext() ?? next)
      } catch (cause) {
        if (cancelled) return
        if (cause instanceof GoogleSignInError && cause.reason === 'cancelled') return
        setError(t('googleFailed'))
      } finally {
        if (!cancelled) setPending(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, iosFlow])

  if (!configured) return null

  const startDesktop = async () => {
    setError(null)
    setPending(true)
    rememberAuthNext(next)

    try {
      const idToken = await signInWithGoogle()
      if (!idToken) return
      await exchange(idToken, next)
    } catch (cause) {
      if (cause instanceof GoogleSignInError) {
        if (cause.reason === 'cancelled') return
        setError(t(cause.reason === 'popup_blocked' ? 'popupBlocked' : 'googleFailed'))
        return
      }
      setError(t('googleFailed'))
    } finally {
      setPending(false)
    }
  }

  const claim = async () => {
    setError(null)
    setClaiming(true)
    try {
      const response = await fetch('/api/auth/handoff', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: handoffCode }),
      })
      const result = (await response.json()) as { ok: boolean; error?: string }
      if (!result.ok) {
        setError(t(result.error === 'invalid_code' ? 'handoffInvalid' : 'googleFailed'))
        return
      }
      router.replace(safeNextPath(next))
      router.refresh()
    } catch {
      setError(t('googleFailed'))
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="space-y-3">
      {iosFlow ? (
        <>
          {/*
            A real <a target=_blank> opens Safari from a home-screen PWA.
            Firebase inside the PWA uses ASWebAuthenticationSession (sheet
            with Done) where iOS focuses the email field and never raises
            the keyboard.
          */}
          <Button type="button" variant="outline" size="lg" className="w-full" asChild>
            <a href={PATHS.loginGoogleSafari} target="_blank" rel="noopener noreferrer">
              <GoogleMark />
              {t('continueWithGoogleSafari')}
            </a>
          </Button>
          <p className="text-text-subtle text-center text-xs leading-relaxed">{t('safariOpenHint')}</p>

          <div className="space-y-2 pt-1">
            <label htmlFor="handoff-code" className="text-sm font-medium text-text">
              {t('handoffLabel')}
            </label>
            <div className="flex gap-2">
              <Input
                id="handoff-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={handoffCode}
                onChange={(event) => setHandoffCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className="tabular-nums tracking-widest"
              />
              <Button
                type="button"
                size="lg"
                disabled={claiming || handoffCode.length !== 6}
                onClick={claim}
              >
                {claiming ? <Loader2 className="size-4 animate-spin" /> : t('handoffSubmit')}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={startDesktop}
          disabled={pending}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark />}
          {pending ? t('signingIn') : t('continueWithGoogle')}
        </Button>
      )}

      {error ? (
        <p role="alert" className="rounded-[var(--radius)] bg-bad-soft px-3 py-2 text-sm text-bad">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3 pt-1 text-xs text-text-subtle">
        <span className="h-px flex-1 bg-border-base" />
        {t('or')}
        <span className="h-px flex-1 bg-border-base" />
      </div>
    </div>
  )
}

function errorKey(error: string | undefined): string {
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

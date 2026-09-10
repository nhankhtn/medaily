'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  firebaseConfigured,
  GoogleSignInError,
  signInWithGoogle,
  signOutFirebase,
} from '@/lib/auth/firebase-client'

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
  const t = useTranslations('auth')
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Rendered only when the deploy actually has a Firebase project, so a
  // local run without one shows the credential form alone instead of a
  // button that can only fail.
  if (!firebaseConfigured()) return null

  const start = async () => {
    setError(null)
    setPending(true)

    try {
      const idToken = await signInWithGoogle()

      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })
      const result = (await response.json()) as { ok: boolean; error?: string }

      if (!result.ok) {
        // The Firebase session is useless to us now; drop it so the next
        // attempt starts from the account chooser rather than looping.
        await signOutFirebase()
        setError(t(errorKey(result.error)))
        return
      }

      const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
      router.replace(target)
      // The shell is a Server Component: without this it would re-render from
      // the cached, signed-out tree.
      router.refresh()
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

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={start}
        disabled={pending}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark />}
        {t('continueWithGoogle')}
      </Button>

      {error ? (
        <p role="alert" className="rounded-[var(--radius)] bg-bad-soft px-3 py-2 text-sm text-bad">
          {error}
        </p>
      ) : null}

      {/*
        The separator belongs to this component, not the page: when Firebase
        is unconfigured the button returns null above, and a page that owned
        the divider would leave an "or" hanging over nothing.
      */}
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

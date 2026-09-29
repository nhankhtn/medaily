'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { firebaseConfigured, signInWithGoogle } from '@/lib/auth/firebase-client'
import { GoogleMark } from './google-mark'
import { RememberedAccounts } from './remembered-accounts'
import { useGoogleSignIn } from './use-google-sign-in'

export function GoogleButton({ next }: { next?: string }) {
  const t = useTranslations('auth')
  const { pending, error, signIn } = useGoogleSignIn(next)

  if (!firebaseConfigured()) return null

  return (
    <div className="space-y-3">
      {/*
        Above the button, not below it: whoever has signed in here before is
        looking for their own face, and making them read past the generic
        button to find it defeats the shortcut.
      */}
      <RememberedAccounts
        pending={pending}
        onPick={(email) => signIn(() => signInWithGoogle(email))}
      />

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() => signIn(() => signInWithGoogle())}
        disabled={pending}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark />}
        {pending ? t('signingIn') : t('continueWithGoogle')}
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

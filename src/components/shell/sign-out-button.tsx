'use client'

import { Loader2, LogOut } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useFormStatus } from 'react-dom'
import { clearPendingSaves } from '@/features/daily/pending-saves'
import { clearPendingTransactions } from '@/features/finance/pending-transactions'
import { clearPendingStops } from '@/features/timer/pending-stops'
import { clearDailyDrafts } from '@/features/daily/use-draft'
import { clearOfflineCaches } from '@/features/daily/register-sw'
import { signOutFirebase } from '@/lib/auth/firebase-client'
import { logout } from '@/server/actions/auth'

/** `card` matches the route tiles in the mobile More sheet. */
export function SignOutButton({ variant = 'icon' }: { variant?: 'icon' | 'card' }) {
  const signOut = async () => {
    await Promise.allSettled([
      signOutFirebase(),
      clearOfflineCaches(),
      clearPendingSaves(),
      clearPendingTransactions(),
      clearPendingStops(),
      Promise.resolve().then(clearDailyDrafts),
    ])

    await logout()
  }

  return (
    <form action={signOut}>
      <SignOutTrigger variant={variant} />
    </form>
  )
}

/**
 * Its own component so it can read `useFormStatus`, which only reports on a
 * form above it in the tree.
 *
 * Worth the split: even in parallel this is a Firebase round trip and a
 * redirect, so without it the icon is unchanged after the tap and the tap gets
 * repeated. `pending` from the form covers the whole chain without a
 * `useState` that would have to guess when it is over.
 */
function SignOutTrigger({ variant }: { variant: 'icon' | 'card' }) {
  const t = useTranslations('auth')
  const { pending } = useFormStatus()

  if (variant === 'card') {
    return (
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="glass-chip flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-[1.35rem] p-2 text-center disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-6 animate-spin text-text-subtle" />
        ) : (
          <LogOut className="size-6 text-text-subtle" />
        )}
        <span className="text-xs leading-tight text-text-muted">{t('signOut')}</span>
      </button>
    )
  }

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      title={t('signOut')}
      aria-label={t('signOut')}
      className="flex size-9 items-center justify-center rounded-full text-text-subtle hover:bg-surface-2 hover:text-text disabled:opacity-50 disabled:hover:bg-transparent"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
    </button>
  )
}

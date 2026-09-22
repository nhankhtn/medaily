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
  /**
   * Clear the Firebase session in this browser before dropping our cookie.
   * Our cookie is what governs access, but leaving Firebase signed in means
   * the next "continue with Google" walks straight back in with no chooser.
   */
  const signOut = async () => {
    await signOutFirebase()
    // Three copies of this person's own day live on the device: the cache as
    // a rendered page, the queue as a save not yet sent, and the draft as
    // words typed and not saved. None may be there for whoever signs in next
    // — the queue would deliver a day into their account, and the draft would
    // reappear in their form.
    await clearOfflineCaches()
    await clearPendingSaves()
    await clearPendingTransactions()
    await clearPendingStops()
    clearDailyDrafts()
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
 * Worth the split: signing out is a Firebase round trip, the page cache, and
 * three IndexedDB queues before the cookie is even dropped. Until the redirect
 * lands the icon is unchanged, so the tap reads as ignored and gets repeated —
 * and `pending` from the form covers the whole chain without a `useState` that
 * would have to guess when it is over.
 */
function SignOutTrigger({ variant }: { variant: 'icon' | 'card' }) {
  const t = useTranslations('auth')
  const { pending } = useFormStatus()
  const label = pending ? t('signingOut') : t('signOut')

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
        <span className="text-xs leading-tight text-text-muted">{label}</span>
      </button>
    )
  }

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      title={label}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-full text-text-subtle hover:bg-surface-2 hover:text-text disabled:opacity-50 disabled:hover:bg-transparent"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
    </button>
  )
}

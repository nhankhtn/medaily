'use client'

import { LogOut } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { clearPendingSaves } from '@/features/daily/pending-saves'
import { clearPendingTransactions } from '@/features/finance/pending-transactions'
import { clearDailyDrafts } from '@/features/daily/use-draft'
import { clearOfflineCaches } from '@/features/daily/register-sw'
import { signOutFirebase } from '@/lib/auth/firebase-client'
import { logout } from '@/server/actions/auth'

/** `card` matches the route tiles in the mobile More sheet. */
export function SignOutButton({ variant = 'icon' }: { variant?: 'icon' | 'card' }) {
  const t = useTranslations('auth')

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
    clearDailyDrafts()
    await logout()
  }

  if (variant === 'card') {
    return (
      <form action={signOut}>
        <button
          type="submit"
          className="glass-chip flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-[1.35rem] p-2 text-center"
        >
          <LogOut className="size-6 text-text-subtle" />
          <span className="text-xs leading-tight text-text-muted">{t('signOut')}</span>
        </button>
      </form>
    )
  }

  return (
    <form action={signOut}>
      <button
        type="submit"
        title={t('signOut')}
        aria-label={t('signOut')}
        className="flex size-9 items-center justify-center rounded-full text-text-subtle hover:bg-surface-2 hover:text-text"
      >
        <LogOut className="size-4" />
      </button>
    </form>
  )
}
